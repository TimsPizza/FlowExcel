// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackendEndpoints {
    health: String,
    shutdown: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct HandshakePayload {
    host: String,
    port: u16,
    api_base: String,
    endpoints: BackendEndpoints,
}

#[derive(Default)]
struct SharedBackendState(Arc<Mutex<Option<HandshakePayload>>>);

#[tauri::command]
fn get_backend_port(state: State<SharedBackendState>) -> Result<u16, String> {
    state
        .0
        .lock()
        .unwrap()
        .as_ref()
        .map(|p| p.port)
        .ok_or_else(|| "Backend port not yet available. The backend may still be starting.".into())
}

fn start_heartbeat_pinger<R: Runtime>(_app: AppHandle<R>, port: u16) {
    log::info!("Starting heartbeat pinger for port: {}", port);
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();
        let ping_url = format!("http://127.0.0.1:{}/ping", port);

        loop {
            log::debug!("Sending heartbeat ping to Python backend.");
            if let Err(e) = client.get(&ping_url).send().await {
                log::error!("Heartbeat ping failed: {}", e);
            }
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    });
}

/// 获取后端executable的完整路径和工作目录
fn get_backend_paths(
    app_handle: &AppHandle<impl Runtime>,
) -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
    let exe_extension = if cfg!(windows) { ".exe" } else { "" };
    let exe_name = format!("flowexcel-backend{}", exe_extension);

    if cfg!(debug_assertions) {
        // 开发模式：直接从项目目录运行
        let current_dir = std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?;
        let working_dir = current_dir.join("binaries/flowexcel-backend");
        let exe_path = working_dir.join(&exe_name);

        log::info!("Development mode");
        log::info!("Backend exe: {}", exe_path.display());
        log::info!("Working dir: {}", working_dir.display());

        Ok((exe_path, working_dir))
    } else {
        // 生产模式：从app资源目录运行
        let resource_dir = app_handle
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource directory: {}", e))?;

        let working_dir = resource_dir.join("binaries/flowexcel-backend");
        let exe_path = working_dir.join(&exe_name);

        log::info!("Production mode");
        log::info!("Backend exe: {}", exe_path.display());
        log::info!("Working dir: {}", working_dir.display());
        log::info!("Resource dir: {}", resource_dir.display());

        Ok((exe_path, working_dir))
    }
}

fn main() {
    tauri::Builder::default()
        .manage(SharedBackendState::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_backend_port])
        .setup(|app| {
            let app_handle = app.handle().clone();
            let backend_state = app.state::<SharedBackendState>().0.clone();

            if cfg!(debug_assertions) {
                // 直接广播默认端口信息，跳过后端自动启动
                let payload = HandshakePayload {
                    host: "127.0.0.1".to_string(),
                    port: 11017,
                    api_base: "http://127.0.0.1:11017".to_string(),
                    endpoints: BackendEndpoints {
                        health: "/health".to_string(),
                        shutdown: "/shutdown".to_string(),
                    },
                };
                {
                    *backend_state.lock().unwrap() = Some(payload.clone());
                }
                let app_handle_clone = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    // 延迟一会儿，确保前端已挂载事件监听
                    tokio::time::sleep(std::time::Duration::from_millis(3000)).await;
                    app_handle_clone.emit("backend-ready", payload).unwrap();
                    log::info!("Development mode: broadcasted backend-ready on port 11017, heartbeat disabled");
                });
                return Ok(());
            }

            tauri::async_runtime::spawn(async move {
                // 获取后端路径
                let (exe_path, working_dir) = match get_backend_paths(&app_handle) {
                    Ok(paths) => paths,
                    Err(e) => {
                        log::error!("Failed to get backend paths: {}", e);
                        panic!("Failed to get backend paths: {}", e);
                    }
                };

                // 验证文件和目录存在
                if !exe_path.exists() {
                    log::error!(
                        "Backend executable does not exist at: {}",
                        exe_path.display()
                    );
                    panic!("Backend executable not found: {}", exe_path.display());
                }

                if !working_dir.exists() {
                    log::error!(
                        "Backend working directory does not exist: {}",
                        working_dir.display()
                    );
                    panic!(
                        "Backend working directory not found: {}",
                        working_dir.display()
                    );
                }

                let internal_dir = working_dir.join("_internal");
                if !internal_dir.exists() {
                    log::error!(
                        "Backend _internal directory does not exist: {}",
                        internal_dir.display()
                    );
                    panic!(
                        "Backend _internal directory not found: {}",
                        internal_dir.display()
                    );
                }

                log::info!("Starting backend with Command::new");
                log::info!("Executable: {}", exe_path.display());
                log::info!("Working directory: {}", working_dir.display());

                // 使用Command::new启动后端（不是sidecar，它不支持onedir）
                let (mut rx, _child) = app_handle
                    .shell()
                    .command(exe_path.to_string_lossy().to_string())
                    .args(&["--enable-ping"])
                    .current_dir(&working_dir)
                    .spawn()
                    .expect("Failed to spawn backend process");

                // 处理后端输出
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line_bytes) => {
                            let line = String::from_utf8_lossy(&line_bytes);
                            handle_stdout(&line, &app_handle, &backend_state);
                        }
                        CommandEvent::Stderr(line_bytes) => {
                            let line = String::from_utf8_lossy(&line_bytes);
                            log::error!("Backend STDERR: {}", line);
                        }
                        CommandEvent::Terminated(payload) => {
                            log::warn!("Backend terminated with payload: {:?}", payload);
                             break;
                        }
                        _ => {}
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn handle_stdout<R: Runtime>(
    line: &str,
    app_handle: &AppHandle<R>,
    state: &Arc<Mutex<Option<HandshakePayload>>>,
) {
    if let Some(json_str) = line.strip_prefix("HANDSHAKE:") {
        match serde_json::from_str::<HandshakePayload>(json_str) {
            Ok(payload) => {
                log::info!("Received handshake from backend: {:?}", payload);
                let port = payload.port;
                *state.lock().unwrap() = Some(payload.clone());
                start_heartbeat_pinger(app_handle.clone(), port);
                app_handle.emit("backend-ready", payload).unwrap();
            }
            Err(e) => {
                log::error!("Failed to parse handshake JSON: {}", e);
            }
        }
    } else {
        log::info!("Backend STDOUT: {}", line);
    }
}
