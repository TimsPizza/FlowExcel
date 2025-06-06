use std::process::{Child, Command, Stdio};
use std::path::PathBuf;
use std::time::Duration;
use tokio::time::interval;
use which::which;
use std::io::{BufRead, BufReader};
use std::thread;
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, Mutex};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tauri::path::BaseDirectory;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendInfo {
    pub host: String,
    pub port: u16,
    pub api_base: String,
    pub endpoints: BackendEndpoints,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendEndpoints {
    pub health: String,
    pub shutdown: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandshakeData {
    #[serde(rename = "type")]
    pub message_type: String,
    pub status: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub api_base: Option<String>,
    pub endpoints: Option<BackendEndpoints>,
    pub error: Option<String>,
}

#[derive(Debug)]
pub struct PythonWatchdog {
    process: Option<Child>,
    backend_info: Option<BackendInfo>,
    heartbeat_url: Option<String>,
    http_client: reqwest::Client,
    is_running: bool,
    restart_attempts: u32,
    max_restart_attempts: u32,
    app_handle: Option<AppHandle>,
}

#[derive(Debug)]
pub enum BackendType {
    PythonScript { python_path: PathBuf, script_path: PathBuf },
    Binary { binary_path: PathBuf },
}

impl PythonWatchdog {
    pub fn new() -> Self {
        Self {
            process: None,
            backend_info: None,
            heartbeat_url: None,
            http_client: reqwest::Client::new(),
            is_running: false,
            restart_attempts: 0,
            max_restart_attempts: 5,
            app_handle: None,
        }
    }

    /// 设置应用句柄用于发送事件
    pub fn set_app_handle(&mut self, app_handle: AppHandle) {
        self.app_handle = Some(app_handle);
    }

    /// 获取后端信息
    pub fn get_backend_info(&self) -> Option<&BackendInfo> {
        self.backend_info.as_ref()
    }

    /// 自动检测后端类型（二进制文件优先）
    fn detect_backend(&self) -> Result<BackendType, String> {
        log::info!("Starting backend detection...");
        let exe_extension = if cfg!(windows) { ".exe" } else { "" };
        let backend_binary_name = format!("excel-backend{}", exe_extension);

        // --- 优先使用Tauri资源解析器 (适用于打包后的应用) ---
        if let Some(app_handle) = &self.app_handle {
            let backend_resource_path = PathBuf::from("_up_").join("backend").join("excel-backend").join(&backend_binary_name);
            if let Ok(path) = app_handle.path().resolve(&backend_resource_path, BaseDirectory::Resource) {
                if path.exists() {
                    log::info!("✓ Found Python backend binary via Tauri resource resolver: {:?}", path);
                    return Ok(BackendType::Binary { binary_path: path });
                }
            }
        }

        // --- 后备方案1: 相对路径查找 (适用于开发环境和某些打包结构) ---
        log::info!("Tauri resource resolver failed or unavailable. Falling back to relative path search...");
        let relative_paths = vec![
            // 开发环境 (从 src-tauri 目录运行)
            PathBuf::from("..").join("backend").join("excel-backend").join(&backend_binary_name),
            // 打包后 (如果工作目录是程序根目录)
            PathBuf::from("backend").join("excel-backend").join(&backend_binary_name),
        ];

        for path in relative_paths {
            if path.exists() {
                log::info!("✓ Found Python backend binary via relative path: {:?}", path);
                return Ok(BackendType::Binary { binary_path: path });
            }
        }

        // --- 后备方案2: 查找Python脚本 (纯开发模式) ---
        log::warn!("No binary backend found, attempting to find Python script...");
        let script_paths = vec![
            PathBuf::from("..").join("src-python").join("src").join("main.py"),
            PathBuf::from("..").join("src-python").join("main.py"),
        ];

        if let Ok(python_executable) = self.find_python_executable() {
            for script_path in script_paths {
                if script_path.exists() {
                    log::info!("✓ Found Python backend script: {:?}", script_path);
                    return Ok(BackendType::PythonScript {
                        python_path: python_executable,
                        script_path,
                    });
                }
            }
        }

        let error_msg = "No Python backend found (neither binary nor script)";
        log::error!("{}", error_msg);
        Err(error_msg.to_string())
    }

    /// 获取打包后资源的路径（跨平台）
    fn get_bundled_resource_path(&self, folder1: &str, folder2: &str, filename: &str) -> PathBuf {
        if cfg!(target_os = "macos") {
            // macOS app bundle 路径
            PathBuf::from("..").join("Resources").join("_up_").join(folder1).join(folder2).join(filename)
        } else if cfg!(windows) {
            // Windows 资源路径
            PathBuf::from("resources").join(folder1).join(folder2).join(filename)
        } else {
            // Linux 和其他 Unix 系统
            PathBuf::from("resources").join(folder1).join(folder2).join(filename)
        }
    }

    /// 查找 Python 可执行文件（增强Windows支持）
    fn find_python_executable(&self) -> Result<PathBuf, String> {
        log::info!("Searching for Python executable...");
        
        // 优先查找虚拟环境中的 Python，区分平台
        let venv_paths = if cfg!(windows) {
            vec![
                PathBuf::from("..").join("src-python").join(".venv").join("Scripts").join("python.exe"),
                PathBuf::from(".venv").join("Scripts").join("python.exe"),
                PathBuf::from("..").join("src-python").join(".venv").join("Scripts").join("python3.exe"),
                PathBuf::from(".venv").join("Scripts").join("python3.exe"),
            ]
        } else {
            vec![
                PathBuf::from("..").join("src-python").join(".venv").join("bin").join("python"),
                PathBuf::from(".venv").join("bin").join("python"),
                PathBuf::from("..").join("src-python").join(".venv").join("bin").join("python3"),
                PathBuf::from(".venv").join("bin").join("python3"),
            ]
        };

        log::info!("Checking {} virtual environment paths...", venv_paths.len());
        for (i, venv_path) in venv_paths.iter().enumerate() {
            log::debug!("  [{}] Checking venv: {:?}", i + 1, venv_path);
            
            if venv_path.exists() && venv_path.is_file() {
                log::info!("✓ Found Python in virtual environment: {:?}", venv_path);
                return Ok(venv_path.clone());
            }
        }

        // 备选：查找系统 Python，Windows优先查找python.exe
        let python_candidates = if cfg!(windows) {
            vec!["python.exe", "python3.exe", "python"]
        } else {
            vec!["python3", "python"]
        };
        
        log::info!("Checking system Python candidates: {:?}", python_candidates);
        for candidate in python_candidates {
            if let Ok(python_path) = which(candidate) {
                log::info!("✓ Found system Python: {:?}", python_path);
                return Ok(python_path);
            } else {
                log::debug!("  System Python '{}' not found", candidate);
            }
        }

        let error_msg = "No Python executable found";
        log::error!("{}", error_msg);
        Err(error_msg.to_string())
    }

    /// 启动后端进程并等待握手
    async fn start_backend_process(&mut self) -> Result<(), String> {
        let backend_type = self.detect_backend()?;
        
        let mut command = match backend_type {
            BackendType::Binary { binary_path } => {
                log::info!("Starting binary backend: {:?}", binary_path);
                Command::new(binary_path)
            }
            BackendType::PythonScript { python_path, script_path } => {
                log::info!("Starting Python script backend: {:?} {:?}", python_path, script_path);
                let mut cmd = Command::new(python_path);
                cmd.arg(script_path);
                cmd
            }
        };

        // 配置进程的标准输入输出
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // 启动进程
        let mut process = command.spawn()
            .map_err(|e| format!("Failed to start backend process: {}", e))?;

        log::info!("Python backend process started with PID: {}", process.id());

        // 获取 stdout 和 stderr
        let stdout = process.stdout.take().ok_or("Failed to get process stdout")?;
        let stderr = process.stderr.take().ok_or("Failed to get process stderr")?;

        // 在单独的线程中处理 stderr
        thread::spawn(|| {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(line_content) => {
                        log::error!("Backend stderr: {}", line_content);
                    }
                    Err(e) => {
                        log::error!("Failed to read backend stderr line: {}", e);
                        break;
                    }
                }
            }
        });

        // 保存进程引用
        self.process = Some(process);
        self.is_running = true;

        // 等待握手完成
        self.wait_for_handshake(stdout).await?;

        Ok(())
    }

    async fn wait_for_handshake(&mut self, stdout: std::process::ChildStdout) -> Result<(), String> {
        let (tx, mut rx) = mpsc::unbounded_channel();
        
        // 在单独的线程中读取 stdout，这个线程将持续运行处理所有输出
        let tx_clone = tx.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line_content) => {
                        if tx_clone.send(Ok(line_content)).is_err() {
                            break; // 接收者已经关闭
                        }
                    }
                    Err(e) => {
                        let _ = tx_clone.send(Err(format!("Failed to read line: {}", e)));
                        break;
                    }
                }
            }
        });

        // 设置超时时间
        let timeout_duration = Duration::from_secs(30);
        let start_time = std::time::Instant::now();

        while start_time.elapsed() < timeout_duration {
            // 使用 timeout 来避免无限等待
            match tokio::time::timeout(Duration::from_millis(100), rx.recv()).await {
                Ok(Some(line_result)) => {
                    match line_result {
                        Ok(line) => {
                            log::debug!("Backend stdout: {}", line);

                            // 检查是否是握手信息
                            if line.starts_with("HANDSHAKE:") {
                                let json_part = &line[10..]; // 移除 "HANDSHAKE:" 前缀
                                match serde_json::from_str::<HandshakeData>(json_part) {
                                    Ok(handshake) => {
                                        if handshake.message_type == "handshake" && handshake.status == "ready" {
                                            if let (Some(host), Some(port), Some(api_base), Some(endpoints)) = 
                                                (handshake.host, handshake.port, handshake.api_base, handshake.endpoints) {
                                                
                                                let info = BackendInfo {
                                                    host,
                                                    port,
                                                    api_base,
                                                    endpoints,
                                                };
                                                
                                                self.heartbeat_url = Some(format!("http://{}:{}/heartbeat", info.host, info.port));
                                                self.backend_info = Some(info);

                                                log::info!("Backend handshake successful! Server running at {}", 
                                                         self.backend_info.as_ref().unwrap().api_base);
                                                
                                                // 发送事件通知前端
                                                self.emit_backend_ready_event();
                                                
                                                // 握手成功，直接返回
                                                return Ok(());
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        log::warn!("Failed to parse handshake JSON: {}", e);
                                    }
                                }
                            } else if line.starts_with("ERROR:") {
                                let json_part = &line[6..]; // 移除 "ERROR:" 前缀
                                match serde_json::from_str::<HandshakeData>(json_part) {
                                    Ok(error_data) => {
                                        return Err(format!("Backend startup error: {}", 
                                                         error_data.error.unwrap_or_else(|| "Unknown error".to_string())));
                                    }
                                    Err(_) => {
                                        return Err(format!("Backend reported error: {}", line));
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            return Err(e);
                        }
                    }
                }
                Ok(None) => {
                    // 通道已关闭
                    break;
                }
                Err(_) => {
                    // 超时，继续循环
                    continue;
                }
            }
        }

        Err("Handshake timeout: Backend did not respond within 30 seconds".to_string())
    }

    /// 检查进程是否存活
    fn is_process_alive(&mut self) -> bool {
        if let Some(ref mut process) = self.process {
            match process.try_wait() {
                Ok(Some(_)) => {
                    // 进程已退出
                    log::warn!("Python backend process has exited");
                    self.is_running = false;
                    self.backend_info = None; // 清除后端信息
                    false
                }
                Ok(None) => {
                    // 进程仍在运行
                    true
                }
                Err(e) => {
                    // 检查进程状态时出错
                    log::error!("Error checking process status: {}", e);
                    self.is_running = false;
                    self.backend_info = None; // 清除后端信息
                    false
                }
            }
        } else {
            false
        }
    }

    /// 强制杀死进程
    fn kill_process(&mut self) -> Result<(), String> {
        if let Some(ref mut process) = self.process {
            let pid = process.id();
            log::info!("Killing Python backend process with PID: {}", pid);
            
            #[cfg(unix)]
            {
                // 在 Unix 系统上，先尝试 SIGTERM，然后 SIGKILL
                unsafe {
                    libc::kill(pid as i32, libc::SIGTERM);
                }
                
                // 等待 5 秒看进程是否自己退出
                let start_time = std::time::Instant::now();
                while start_time.elapsed() < Duration::from_secs(5) {
                    if let Ok(Some(_)) = process.try_wait() {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }

                // 如果进程没有在 5 秒内退出，强制杀死
                if let Ok(None) = process.try_wait() {
                    unsafe {
                        libc::kill(pid as i32, libc::SIGKILL);
                    }
                }
            }

            #[cfg(windows)]
            {
                let _ = process.kill();
            }

            let _ = process.wait();
            self.process = None;
            self.backend_info = None; // 清除后端信息
            self.is_running = false;
        }
        Ok(())
    }


    /// 启动看门狗
    pub async fn start(&mut self) -> Result<(), String> {
        log::info!("Starting Python backend watchdog");

        // 启动后端进程并等待握手
        self.start_backend_process().await?;

        Ok(())
    }

    /// 启动看门狗监控循环（需要在独立的任务中运行）
    pub async fn start_monitoring(watchdog: Arc<Mutex<PythonWatchdog>>) {
        let mut process_check_interval = interval(Duration::from_secs(5));
        let mut status_broadcast_interval = interval(Duration::from_secs(10));
        let mut heartbeat_interval = interval(Duration::from_secs(10));
        
        loop {
            tokio::select! {
                // 发送心跳
                _ = heartbeat_interval.tick() => {
                    let watchdog_guard = watchdog.lock().await;
                    if let (Some(url), true) = (watchdog_guard.heartbeat_url.as_ref(), watchdog_guard.is_running) {
                        let client = watchdog_guard.http_client.clone();
                        let url = url.clone();
                        tokio::spawn(async move {
                            match client.post(&url).send().await {
                                Ok(response) => {
                                    if response.status().is_success() {
                                        log::debug!("Sent heartbeat successfully to {}", url);
                                    } else {
                                        log::warn!("Heartbeat request to {} failed with status: {}", url, response.status());
                                    }
                                }
                                Err(e) => {
                                    log::error!("Failed to send heartbeat to {}: {}", url, e);
                                }
                            }
                        });
                    }
                },

                // 进程监控检查
                _ = process_check_interval.tick() => {
                    let mut watchdog_guard = watchdog.lock().await;
                    
                    // 检查进程是否存活
                    if !watchdog_guard.is_process_alive() {
                        log::error!("Python backend process is not alive, attempting restart");
                        
                        if let Err(e) = watchdog_guard.restart_process().await {
                            log::error!("Failed to restart Python backend: {}", e);
                            break;
                        }
                    }
                },
                
                // 定期广播后端状态
                _ = status_broadcast_interval.tick() => {
                    let watchdog_guard = watchdog.lock().await;
                    
                    // 如果后端正在运行且有配置信息，定期广播状态
                    if watchdog_guard.is_running && watchdog_guard.backend_info.is_some() {
                        watchdog_guard.emit_backend_ready_event();
                        log::debug!("Broadcasted backend status to frontend");
                    }
                }
            }
        }
    }

    /// 停止看门狗
    pub async fn stop(&mut self) -> Result<(), String> {
        log::info!("Stopping Python backend watchdog");
        
        self.kill_process()?;
        self.is_running = false;
        
        Ok(())
    }

    pub fn get_status(&self) -> String {
        if self.is_running {
            if let Some(ref info) = self.backend_info {
                format!("Running at {}:{}", info.host, info.port)
            } else {
                "Starting...".to_string()
            }
        } else {
            "Stopped".to_string()
        }
    }


    /// 重启进程
    async fn restart_process(&mut self) -> Result<(), String> {
        if self.restart_attempts >= self.max_restart_attempts {
            return Err(format!("Maximum restart attempts ({}) exceeded", self.max_restart_attempts));
        }

        log::info!("Attempting to restart Python backend (attempt {}/{})", 
                  self.restart_attempts + 1, self.max_restart_attempts);

        // 杀死当前进程
        self.kill_process()?;

        // 等待一小段时间
        tokio::time::sleep(Duration::from_secs(2)).await;

        // 增加重启尝试次数
        self.restart_attempts += 1;

        // 重新启动后端进程
        self.start_backend_process().await?;
        
        // 重启成功后重置重启计数
        self.restart_attempts = 0;
        
        Ok(())
    }

    /// 发送后端就绪事件到前端
    fn emit_backend_ready_event(&self) {
        if let (Some(app_handle), Some(backend_info)) = (&self.app_handle, &self.backend_info) {
            match app_handle.emit("backend-ready", backend_info) {
                Ok(()) => {
                    log::info!("Backend ready event sent to frontend successfully");
                }
                Err(e) => {
                    log::error!("Failed to emit backend ready event: {}", e);
                }
            }
        } else {
            log::warn!("Cannot emit backend ready event: missing app handle or backend info");
        }
    }

    /// 发送后端错误事件到前端
    fn emit_backend_error_event(&self, error_message: &str) {
        if let Some(app_handle) = &self.app_handle {
            #[derive(Serialize, Clone)]
            struct ErrorEvent {
                error: String,
            }

            let error_event = ErrorEvent {
                error: error_message.to_string(),
            };

            match app_handle.emit("backend-error", error_event) {
                Ok(()) => {
                    log::info!("Backend error event sent to frontend successfully");
                }
                Err(e) => {
                    log::error!("Failed to emit backend error event: {}", e);
                }
            }
        } else {
            log::warn!("Cannot emit backend error event: missing app handle");
        }
    }
}








