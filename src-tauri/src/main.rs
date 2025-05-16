// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

// Import the library containing our modules
mod bridge;
mod workspace;

// Import commands
use bridge::commands::preview_excel_data;
use workspace::commands::{
    list_workspaces,
    load_workspace,
    save_workspace,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Excel data operations (still using Python)
            preview_excel_data,
            
            // Workspace operations (now in Rust)
            list_workspaces,
            load_workspace,
            save_workspace,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
