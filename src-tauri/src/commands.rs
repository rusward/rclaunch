use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use rclaunch_core::{
    Account, AccountsView, AuthService, Core, CreateInstance, DownloadProgress, InstalledMod,
    Instance, InstanceService, LaunchReporter, ModSearchResult, VersionManifest,
};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::oneshot;
use uuid::Uuid;

/// Состояние, доступное командам Tauri.
pub struct AppState {
    pub core: Core,
    pub instances: InstanceService,
    pub auth: AuthService,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
}

#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME"),
        version: env!("CARGO_PKG_VERSION"),
    }
}

/// Манифест версий Mojang для выбора версии при создании инстанса.
#[tauri::command]
pub async fn versions_manifest(state: State<'_, AppState>) -> Result<VersionManifest, String> {
    state.core.version_manifest().await.map_err(|error| {
        log::error!("failed to load version manifest: {error}");
        error.to_string()
    })
}

#[tauri::command]
pub fn instances_list(state: State<'_, AppState>) -> Vec<Instance> {
    state.instances.list()
}

#[tauri::command]
pub fn instances_create(
    state: State<'_, AppState>,
    request: CreateInstance,
) -> Result<Instance, String> {
    state.instances.create(request).map_err(|error| {
        log::error!("failed to create instance: {error}");
        error.to_string()
    })
}

#[tauri::command]
pub fn instances_delete(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.instances.delete(&id).map_err(|error| {
        log::error!("failed to delete instance {id}: {error}");
        error.to_string()
    })
}

/// Поиск модов на Modrinth под версию и модлоадер инстанса.
#[tauri::command]
pub async fn modrinth_search(
    state: State<'_, AppState>,
    query: String,
    game_version: Option<String>,
    loader: Option<String>,
) -> Result<Vec<ModSearchResult>, String> {
    state
        .core
        .search_mods(&query, game_version.as_deref(), loader.as_deref())
        .await
        .map_err(|error| {
            log::error!("modrinth search failed: {error}");
            error.to_string()
        })
}

/// Устанавливает мод в `mods/` выбранного инстанса.
#[tauri::command]
pub async fn modrinth_install(
    state: State<'_, AppState>,
    instance_id: String,
    project_id: String,
) -> Result<InstalledMod, String> {
    let instance = state
        .instances
        .get(&instance_id)
        .ok_or_else(|| "instance not found".to_string())?;

    let loader = instance
        .loader
        .modrinth_category()
        .ok_or_else(|| "vanilla instance does not support mods".to_string())?;

    let mods_dir = state.core.paths().instance_mods_dir(&instance.id);

    state
        .core
        .install_mod(&project_id, &instance.minecraft_version, loader, &mods_dir)
        .await
        .map_err(|error| {
            log::error!("modrinth install failed: {error}");
            error.to_string()
        })
}

#[tauri::command]
pub fn auth_accounts(state: State<'_, AppState>) -> AccountsView {
    state.auth.accounts_view()
}

#[tauri::command]
pub fn auth_set_active(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state
        .auth
        .set_active(&id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn auth_logout(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.auth.logout(&id).map_err(|error| error.to_string())
}

/// Открывает окно Microsoft и ждёт redirect с кодом.
#[tauri::command]
pub async fn auth_login(app: AppHandle, state: State<'_, AppState>) -> Result<Account, String> {
    let csrf = Uuid::new_v4().to_string();
    let auth_url = state
        .auth
        .authorize_url(&csrf)
        .map_err(|error| error.to_string())?;
    let label = format!("msa-auth-{}", &csrf[..8]);
    let auth_url =
        tauri::Url::parse(&auth_url).map_err(|error| format!("invalid auth url: {error}"))?;

    let (tx, rx) = oneshot::channel::<String>();
    let shared = Arc::new(Mutex::new(Some(tx)));

    let navigation = Arc::clone(&shared);
    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(auth_url))
        .title("Вход Microsoft")
        .inner_size(480.0, 700.0)
        .min_inner_size(420.0, 560.0)
        .center()
        .on_navigation(move |url| {
            if url.as_str().starts_with(rclaunch_core::auth::REDIRECT_URI) {
                if let Some(sender) = navigation
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner())
                    .take()
                {
                    let _ = sender.send(url.to_string());
                }
                return false;
            }
            true
        })
        .build()
        .map_err(|error| format!("failed to open login window: {error}"))?;

    let close = Arc::clone(&shared);
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            if let Some(sender) = close
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .take()
            {
                let _ = sender.send("__closed__".to_string());
            }
        }
    });

    let result = tokio::time::timeout(Duration::from_secs(300), rx).await;
    let _ = window.close();

    let redirect = result
        .map_err(|_| "время входа истекло".to_string())?
        .map_err(|_| "окно входа закрыто".to_string())?;

    if redirect == "__closed__" {
        return Err("вход отменён".to_string());
    }

    let redirect =
        tauri::Url::parse(&redirect).map_err(|error| format!("invalid redirect: {error}"))?;
    let params: HashMap<String, String> = redirect.query_pairs().into_owned().collect();

    if params.get("state") != Some(&csrf) {
        return Err("state mismatch".to_string());
    }
    if let Some(error) = params.get("error") {
        let description = params.get("error_description").cloned().unwrap_or_default();
        return Err(format!("{error}: {description}"));
    }
    let code = params
        .get("code")
        .ok_or_else(|| "no code in redirect".to_string())?;

    state.auth.login_with_code(code).await.map_err(|error| {
        log::error!("login failed: {error}");
        error.to_string()
    })
}

struct EventReporter {
    app: AppHandle,
}

impl LaunchReporter for EventReporter {
    fn stage(&self, stage: &str) {
        let _ = self.app.emit("launch:stage", stage.to_string());
    }

    fn download(&self, progress: DownloadProgress) {
        if progress.total == 0
            || progress.completed == progress.total
            || progress.completed.is_multiple_of(8)
        {
            let _ = self.app.emit("launch:progress", progress);
        }
    }
}

/// Готовит файлы инстанса и запускает Java. Команда завершается при выходе игры.
#[tauri::command]
pub async fn launch_instance(
    app: AppHandle,
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<(), String> {
    let instance = state
        .instances
        .get(&instance_id)
        .ok_or_else(|| "instance not found".to_string())?;

    let accounts = state.auth.accounts_view();
    let account_id = accounts
        .active_id
        .ok_or_else(|| "сначала войди через Microsoft".to_string())?;
    let session = state
        .auth
        .ensure_session(&account_id)
        .await
        .map_err(|error| {
            log::error!("session refresh failed: {error}");
            error.to_string()
        })?;

    let manifest = state.core.version_manifest().await.map_err(|error| {
        log::error!("failed to load version manifest: {error}");
        error.to_string()
    })?;

    let reporter = EventReporter { app: app.clone() };
    let prepared = rclaunch_core::prepare::prepare_and_launch(
        state.core.paths(),
        &manifest,
        &instance,
        &session.profile,
        &session.access_token,
        &reporter,
    )
    .await
    .map_err(|error| {
        log::error!("launch failed: {error}");
        let _ = app.emit("launch:error", error.to_string());
        error.to_string()
    })?;

    if let Some(loader_version) = &prepared.loader_version {
        let _ = state
            .instances
            .set_loader_version(&instance.id, loader_version);
    }
    let _ = state.instances.mark_played(&instance.id);
    let _ = app.emit("launch:started", instance.id.clone());

    let mut child = prepared.child;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    spawn_log_reader(app.clone(), stdout);
    spawn_log_reader(app.clone(), stderr);

    let status = tauri::async_runtime::spawn_blocking(move || child.wait())
        .await
        .map_err(|error| format!("failed to wait for Java: {error}"))?
        .map_err(|error| format!("failed to wait for Java: {error}"))?;

    let _ = app.emit("launch:exited", status.code());
    Ok(())
}

fn spawn_log_reader<R: Read + Send + 'static>(app: AppHandle, reader: Option<R>) {
    let Some(reader) = reader else {
        return;
    };
    std::thread::spawn(move || {
        for line in BufReader::new(reader).lines().map_while(Result::ok) {
            let _ = app.emit("launch:log", line);
        }
    });
}
