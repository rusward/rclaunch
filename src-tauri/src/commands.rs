use rclaunch_core::{
    Core, CreateInstance, InstalledMod, Instance, InstanceService, ModSearchResult, VersionManifest,
};
use serde::Serialize;
use tauri::State;

/// Состояние, доступное командам Tauri.
pub struct AppState {
    pub core: Core,
    pub instances: InstanceService,
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
