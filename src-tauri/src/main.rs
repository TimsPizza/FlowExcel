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

fn main() {
    tauri::Builder::default()
        .manage(SharedBackendState::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_backend_port])
        .setup(|app| {
            let app_handle = app.handle().clone();
            let backend_state = app.state::<SharedBackendState>().0.clone();

            tauri::async_runtime::spawn(async move {
                // In development mode, run the backend directly from its original location
                // to preserve PyInstaller onedir structure
                let backend_cmd = if cfg!(debug_assertions) {
                    // Development mode: run from original location
                    let backend_path = "../backend/excel-backend/excel-backend";
                    app_handle.shell().command(backend_path)
                } else {
                    // Production mode: use sidecar
                    app_handle
                        .shell()
                        .sidecar("excel-backend")
                        .expect("Failed to create backend sidecar command")
                };

                let (mut rx, _child) = backend_cmd.spawn().expect("Failed to spawn backend");

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
