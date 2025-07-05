use crate::types::{BackendState, BackendStatus, HandshakePayload};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_shell::process::{CommandEvent, CommandChild};
use tauri_plugin_shell::ShellExt;
use tokio::sync::mpsc::Receiver;

pub struct BackendManager {
    pub status: Arc<Mutex<BackendStatus>>,
    pub process: Arc<Mutex<Option<CommandChild>>>,
    pub app_handle: AppHandle,
}

impl BackendManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            status: Arc::new(Mutex::new(BackendStatus {
                state: BackendState::NotStarted,
                last_heartbeat: None,
                restart_count: 0,
            })),
            process: Arc::new(Mutex::new(None)),
            app_handle,
        }
    }

    pub async fn start_backend(&self) -> Result<(), String> {
        // Check if already running or starting
        {
            let status = self.status.lock().unwrap();
            if matches!(status.state, BackendState::Running(_) | BackendState::Starting) {
                return Ok(());
            }
        }

        // Set status to Starting
        {
            let mut status = self.status.lock().unwrap();
            status.state = BackendState::Starting;
        }
        self.emit_status_change();

        if cfg!(debug_assertions) {
            // Development mode: simulate backend startup
            let payload = HandshakePayload {
                host: "127.0.0.1".to_string(),
                port: 11017,
                api_base: "http://127.0.0.1:11017".to_string(),
                endpoints: crate::types::BackendEndpoints {
                    health: "/health".to_string(),
                    shutdown: "/shutdown".to_string(),
                },
            };

            // Simulate startup delay
            tokio::time::sleep(Duration::from_millis(2000)).await;

            {
                let mut status = self.status.lock().unwrap();
                status.state = BackendState::Running(payload.clone());
                status.last_heartbeat = Some(
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs(),
                );
            }

            self.emit_status_change();
            self.app_handle.emit("backend-ready", payload).unwrap();
            return Ok(());
        }

        // Production mode: start actual backend
        // Kill existing process if any
        {
            let mut process = self.process.lock().unwrap();
            if let Some(child) = process.take() {
                let _ = child.kill();
            }
        }

        let (exe_path, working_dir) = get_backend_paths(&self.app_handle)?;

        // Build the command
        let mut command = self.app_handle.shell().command(exe_path);
        command = command.current_dir(working_dir).args(&["--enable-ping"]);

        // Spawn the process
        let (rx, child) = command.spawn().map_err(|e| format!("Failed to spawn backend: {}", e))?;

        // Store the process
        {
            let mut process = self.process.lock().unwrap();
            *process = Some(child);
        }

        // Monitor the process
        let manager = self.clone();
        tokio::spawn(async move {
            manager.monitor_backend_process(rx).await;
        });

        Ok(())
    }

    async fn monitor_backend_process(&self, mut rx: Receiver<CommandEvent>) {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    self.handle_stdout(&line);
                }
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    log::error!("Backend STDERR: {}", line);
                }
                CommandEvent::Terminated(payload) => {
                    log::warn!("Backend terminated with payload: {:?}", payload);
                    self.handle_backend_terminated();
                    break;
                }
                _ => {}
            }
        }
    }

    fn handle_backend_terminated(&self) {
        let (should_restart, restart_count) = {
            let mut status = self.status.lock().unwrap();
            if status.restart_count < 3 {
                status.restart_count += 1;
                status.state = BackendState::Restarting;
                (true, status.restart_count)
            } else {
                status.state = BackendState::Failed("Backend crashed too many times".to_string());
                (false, 0)
            }
        };

        self.emit_status_change();

        if should_restart {
            log::info!("Backend terminated, attempting restart...");
            let manager = self.clone();
            tokio::spawn(async move {
                // Wait before restarting
                let delay = Duration::from_secs(restart_count as u64);
                tokio::time::sleep(delay).await;
                
                if let Err(e) = manager.start_backend().await {
                    log::error!("Failed to restart backend: {}", e);
                    let mut status = manager.status.lock().unwrap();
                    status.state = BackendState::Failed(e);
                    drop(status);
                    manager.emit_status_change();
                }
            });
        }
    }

    fn handle_stdout(&self, line: &str) {
        if let Some(json_str) = line.strip_prefix("HANDSHAKE:") {
            match serde_json::from_str::<HandshakePayload>(json_str) {
                Ok(payload) => {
                    log::info!("Received handshake from backend: {:?}", payload);
                    
                    {
                        let mut status = self.status.lock().unwrap();
                        status.state = BackendState::Running(payload.clone());
                        status.last_heartbeat = Some(
                            std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap()
                                .as_secs(),
                        );
                        status.restart_count = 0; // Reset restart count on successful start
                    }

                    self.emit_status_change();
                    self.start_heartbeat_monitor(payload.port);
                    self.app_handle.emit("backend-ready", payload).unwrap();
                }
                Err(e) => {
                    log::error!("Failed to parse handshake JSON: {}", e);
                }
            }
        } else {
            log::info!("Backend STDOUT: {}", line);
        }
    }

    fn start_heartbeat_monitor(&self, port: u16) {
        let manager = self.clone();
        tokio::spawn(async move {
            manager.heartbeat_loop(port).await;
        });
    }

    async fn heartbeat_loop(&self, port: u16) {
        let client = reqwest::Client::new();
        let ping_url = format!("http://127.0.0.1:{}/ping", port);
        let mut consecutive_failures = 0;

        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;

            // Check if backend is still supposed to be running
            let should_continue = {
                let status = self.status.lock().unwrap();
                matches!(status.state, BackendState::Running(_))
            };

            if !should_continue {
                break;
            }

            match client.get(&ping_url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        consecutive_failures = 0;
                        let mut status = self.status.lock().unwrap();
                        status.last_heartbeat = Some(
                            std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap()
                                .as_secs(),
                        );
                        log::debug!("Heartbeat ping successful");
                    } else {
                        consecutive_failures += 1;
                        log::warn!("Heartbeat ping failed with status: {}", response.status());
                    }
                }
                Err(e) => {
                    consecutive_failures += 1;
                    log::error!("Heartbeat ping failed: {}", e);
                }
            }

            // If we have too many consecutive failures, consider backend dead
            if consecutive_failures >= 3 {
                log::error!("Backend appears to be unresponsive, initiating restart");
                self.handle_backend_terminated();
                break;
            }
        }
    }

    fn emit_status_change(&self) {
        let status = self.status.lock().unwrap().clone();
        self.app_handle.emit("backend-status-changed", status).unwrap();
    }

    pub fn get_status(&self) -> BackendStatus {
        self.status.lock().unwrap().clone()
    }
}

impl Clone for BackendManager {
    fn clone(&self) -> Self {
        Self {
            status: self.status.clone(),
            process: self.process.clone(),
            app_handle: self.app_handle.clone(),
        }
    }
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