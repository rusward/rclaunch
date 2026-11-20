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
            app.manage(commands::AppState { core });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::versions_manifest,
        ])
        .run(tauri::generate_context!())
        .expect("error while running rclaunch");
}
