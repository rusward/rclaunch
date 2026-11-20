mod commands;

use rclaunch_core::Core;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let core = Core::new()?;
            let instances = rclaunch_core::InstanceService::load(core.paths())?;
            let auth = rclaunch_core::AuthService::new(core.paths())?;
            app.manage(commands::AppState {
                core,
                instances,
                auth,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::versions_manifest,
            commands::instances_list,
            commands::instances_create,
            commands::instances_delete,
            commands::modrinth_search,
            commands::modrinth_install,
            commands::auth_accounts,
            commands::auth_set_active,
            commands::auth_logout,
            commands::auth_login,
        ])
        .run(tauri::generate_context!())
        .expect("error while running rclaunch");
}
