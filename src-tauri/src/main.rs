// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod command;
mod manager;
mod types;

use command::SharedBackendManager;
use manager::BackendManager;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .manage(SharedBackendManager::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            command::get_backend_port,
            command::get_backend_info,
            command::get_backend_status,
            command::start_backend,
            command::restart_backend
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            let backend_manager = BackendManager::new(app_handle);
            
            // Store the backend manager
            let shared_manager = app.state::<SharedBackendManager>();
            *shared_manager.0.lock().unwrap() = Some(backend_manager);

            log::info!("Tauri initialized, waiting for frontend to request backend startup");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
