use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use rclaunch_core::{
    Account, AccountsView, AuthService, Core, CreateInstance, InstalledMod, Instance,
    InstanceService, ModSearchResult, VersionManifest,
};
use serde::Serialize;
use tauri::{AppHandle, State, WebviewUrl, WebviewWindowBuilder};
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

    let redirect = tokio::time::timeout(Duration::from_secs(300), rx)
        .await
        .map_err(|_| "время входа истекло".to_string())?
        .map_err(|_| "окно входа закрыто".to_string())?;

    let _ = window.close();

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
