// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod python_watchdog;

use python_watchdog::{PythonWatchdog, BackendInfo};
use std::sync::Arc;
use tokio::sync::Mutex;

// Global watchdog instance
static WATCHDOG: tokio::sync::OnceCell<Arc<Mutex<PythonWatchdog>>> = tokio::sync::OnceCell::const_new();

// Tauri command to get backend information
#[tauri::command]
async fn get_backend_info() -> Result<Option<BackendInfo>, String> {
    if let Some(watchdog) = WATCHDOG.get() {
        let guard = watchdog.lock().await;
        Ok(guard.get_backend_info().cloned())
    } else {
        Err("Watchdog not initialized".to_string())
    }
}

// Tauri command to get backend status
#[tauri::command]
async fn get_backend_status() -> Result<String, String> {
    if let Some(watchdog) = WATCHDOG.get() {
        let guard = watchdog.lock().await;
        Ok(guard.get_status())
    } else {
        Err("Watchdog not initialized".to_string())
    }
}



fn main() {
    // Initialize Tokio runtime for async operations
    let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
    
    rt.block_on(async {
        // Initialize and start the Python watchdog
        let watchdog = Arc::new(Mutex::new(PythonWatchdog::new()));
        
        if let Err(e) = watchdog.lock().await.start().await {
            eprintln!("Failed to start Python backend: {}", e);
            std::process::exit(1);
        }
        
        // Store the watchdog globally for cleanup
        WATCHDOG.set(watchdog.clone()).expect("Failed to set global watchdog");
        
        // Start monitoring in background
        let monitoring_watchdog = watchdog.clone();
        tokio::spawn(async move {
            PythonWatchdog::start_monitoring(monitoring_watchdog).await;
        });
        
        // Run Tauri application
        tauri::Builder::default()
            .plugin(tauri_plugin_fs::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_log::Builder::default().build())
            .invoke_handler(tauri::generate_handler![get_backend_info, get_backend_status])
            .setup(|_app| {
                // Additional setup if needed
                log::info!("Tauri application started with Python backend watchdog");
                Ok(())
            })
            .on_window_event(|_window, event| {
                if let tauri::WindowEvent::Destroyed = event {
                    // Shutdown watchdog when window is destroyed
                    let rt = tokio::runtime::Runtime::new().expect("Failed to create runtime for cleanup");
                    rt.block_on(async {
                        if let Some(watchdog) = WATCHDOG.get() {
                            let _ = watchdog.lock().await.stop().await;
                            log::info!("Python backend watchdog stopped");
                        }
                    });
                }
            })
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    });
}
