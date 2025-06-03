// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

// Import the library containing our modules
mod bridge;
mod workspace;

// Import commands
use bridge::daemon_manager;

fn main() {
    // Initialize API manager
    if let Err(e) = bridge::api_manager::init_api_manager() {
        eprintln!("Failed to initialize API manager: {}", e);
        std::process::exit(1);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|_app| {
            // Additional setup if needed
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Shutdown API manager when window is destroyed
                let _ = bridge::api_manager::shutdown_api_manager();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
