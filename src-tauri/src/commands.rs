use rclaunch_core::{Core, VersionManifest};
use serde::Serialize;
use tauri::State;

/// Состояние, доступное командам Tauri.
pub struct AppState {
    pub core: Core,
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

/// Возвращает манифест версий Mojang для списка в UI.
#[tauri::command]
pub async fn versions_manifest(state: State<'_, AppState>) -> Result<VersionManifest, String> {
    state.core.version_manifest().await.map_err(|error| {
        log::error!("failed to load version manifest: {error}");
        error.to_string()
    })
}
