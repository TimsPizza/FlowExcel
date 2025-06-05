// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod python_watchdog;

use python_watchdog::{PythonWatchdog, BackendInfo};
use std::sync::Arc;
use tokio::sync::Mutex;

#[cfg(windows)]
use winapi::um::consoleapi::{AllocConsole, SetConsoleTitleA};

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
        
        log::error!("{}", error_msg);
        eprintln!("{}", error_msg);
        
        #[cfg(windows)]
        {
            use std::io::Write;
            let _ = std::io::stderr().flush();
            std::thread::sleep(std::time::Duration::from_millis(1000)); // 给日志一点时间输出
        }
    }));
    
    // Initialize Tokio runtime for async operations
    let rt = match tokio::runtime::Runtime::new() {
        Ok(rt) => {
            // Log moved to setup
            rt
        }
        Err(e) => {
            let error_msg = format!("Failed to create Tokio runtime: {}", e);
            // Logging here might not work if tauri_plugin_log isn't initialized yet,
            // but eprintln should work.
            eprintln!("{}", error_msg); 
            std::process::exit(1);
        }
    };
    
    // 在async块中初始化Python后端，但不运行Tauri
    let watchdog = rt.block_on(async {
        // Log moved to setup
        
        // Initialize and start the Python watchdog
        let watchdog = Arc::new(Mutex::new(PythonWatchdog::new()));
        
        match watchdog.lock().await.start().await {
            Ok(()) => {
                // Log moved to setup
            }
            Err(e) => {
                let error_msg = format!("Failed to start Python backend: {}", e);
                eprintln!("{}", error_msg);
                
                #[cfg(windows)]
                {
                    use std::io::Write;
                    let _ = std::io::stderr().flush();
                    std::thread::sleep(std::time::Duration::from_millis(3000)); // 给用户时间看到错误
                }
                
                std::process::exit(1);
            }
        }
        
        // Log moved to setup
        
        // Start monitoring in background
        let monitoring_watchdog = watchdog.clone();
        tokio::spawn(async move {
            PythonWatchdog::start_monitoring(monitoring_watchdog).await;
        });
        
        watchdog
    });
    
    // Store the watchdog globally for cleanup
    if let Err(e) = rt.block_on(async { WATCHDOG.set(watchdog.clone()) }) {
        let error_msg = format!("Failed to set global watchdog: {:?}", e);
        eprintln!("{}", error_msg);
        std::process::exit(1);
    }
    
    // Log moved to setup
    
    // Run Tauri application in the main thread (not in async block)
    match tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::default().build()) // This initializes the logger
        .invoke_handler(tauri::generate_handler![get_backend_info, get_backend_status])
        .setup(|_app| {
            // Moved log messages here
            log::info!("=== Tauri Excel Application Starting ===");
            log::info!("Platform: {}", if cfg!(windows) { "Windows" } else if cfg!(target_os = "macos") { "macOS" } else { "Unix" });
            log::info!("Debug mode: {}", cfg!(debug_assertions));
            log::info!("Working directory: {:?}", std::env::current_dir().unwrap_or_default());
            log::info!("Tokio runtime created successfully");
            log::info!("Starting Python backend watchdog...");
            log::info!("Python backend started successfully");
            log::info!("Starting background monitoring task...");
            log::info!("Building Tauri application...");
            log::info!("Tauri application setup completed");
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                log::info!("Window destroyed, shutting down watchdog...");
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
