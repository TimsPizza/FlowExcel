// // Prevents additional console window on Windows in release, DO NOT REMOVE!!
// #![cfg_attr(
//     all(not(debug_assertions), target_os = "windows"),
//     windows_subsystem = "windows"
// )]

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
    // 设置panic hook以确保在崩溃时能看到错误信息
    std::panic::set_hook(Box::new(|panic_info| {
        let payload = panic_info.payload();
        let location = panic_info.location().unwrap_or_else(|| std::panic::Location::caller());
        
        let msg = if let Some(s) = payload.downcast_ref::<&str>() {
            s
        } else if let Some(s) = payload.downcast_ref::<String>() {
            s
        } else {
            "Unknown panic payload"
        };
        
        let error_msg = format!(
            "PANIC occurred at {}:{}: {}",
            location.file(),
            location.line(),
            msg
        );
        
        eprintln!("{}", error_msg);
        
        #[cfg(windows)]
        {
            use std::io::Write;
            let _ = std::io::stderr().flush();
            std::thread::sleep(std::time::Duration::from_millis(1000)); // 给日志一点时间输出
        }
    }));
    
    // 直接运行Tauri应用，在setup中处理异步初始化
    match tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::default().build()) // This initializes the logger
        .invoke_handler(tauri::generate_handler![get_backend_info, get_backend_status])
        .setup(|app| {
            log::info!("=== Tauri Excel Application Starting ===");
            log::info!("Platform: {}", if cfg!(windows) { "Windows" } else if cfg!(target_os = "macos") { "macOS" } else { "Unix" });
            log::info!("Debug mode: {}", cfg!(debug_assertions));
            log::info!("Working directory: {:?}", std::env::current_dir().unwrap_or_default());
            
            // 添加窗口创建日志
            log::info!("Creating main application window...");
            
            // 使用Tauri的runtime来处理异步初始化
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                log::info!("Starting Python backend watchdog...");
                
                // Initialize and start the Python watchdog
                let watchdog = Arc::new(Mutex::new(PythonWatchdog::new()));
                
                // 设置应用句柄用于发送事件
                {
                    let mut guard = watchdog.lock().await;
                    guard.set_app_handle(app_handle.clone());
                }
                
                // 分离锁的生命周期
                let start_result = {
                    let mut guard = watchdog.lock().await;
                    guard.start().await
                };
                
                match start_result {
                    Ok(()) => {
                        log::info!("Python backend started successfully");
                        
                        // Store the watchdog globally
                        if let Err(e) = WATCHDOG.set(watchdog.clone()) {
                            log::error!("Failed to set global watchdog: {:?}", e);
                            return;
                        }
                        
                        // Start monitoring in background
                        let monitoring_watchdog = watchdog.clone();
                        tauri::async_runtime::spawn(async move {
                            log::info!("Starting background monitoring task...");
                            PythonWatchdog::start_monitoring(monitoring_watchdog).await;
                        });
                        
                        log::info!("Watchdog initialization completed");
                    }
                    Err(e) => {
                        log::error!("Failed to start Python backend: {}", e);
                        eprintln!("Failed to start Python backend: {}", e);
                        
                        #[cfg(windows)]
                        {
                            use std::io::Write;
                            let _ = std::io::stderr().flush();
                            std::thread::sleep(std::time::Duration::from_millis(3000));
                        }
                        
                        // 不要exit，让Tauri继续运行以便调试
                        log::warn!("Continuing without Python backend for debugging purposes");
                    }
                }
            });
            
            log::info!("Tauri application setup completed");
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                log::info!("Window destroyed, shutting down watchdog...");
                tauri::async_runtime::spawn(async {
                    if let Some(watchdog) = WATCHDOG.get() {
                        let _ = watchdog.lock().await.stop().await;
                        log::info!("Python backend watchdog stopped");
                    }
                });
            }
        })
        .run(tauri::generate_context!())
    {
        Ok(()) => {
            log::info!("Tauri application finished normally");
        }
        Err(e) => {
            let error_msg = format!("Error while running Tauri application: {}", e);
            log::error!("{}", error_msg); // log::error should work here as logger is initialized
            eprintln!("{}", error_msg);
            std::process::exit(1);
        }
    }
}

