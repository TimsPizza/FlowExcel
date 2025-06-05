use std::process::{Child, Command, Stdio};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::time::interval;
use which::which;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug)]
pub struct PythonWatchdog {
    process: Option<Child>,
    is_running: bool,
    restart_attempts: u32,
    max_restart_attempts: u32,
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
            is_running: false,
            restart_attempts: 0,
            max_restart_attempts: 5,
        }
    }

    /// 自动检测后端类型（二进制文件优先）
    fn detect_backend(&self) -> Result<BackendType, String> {
        // 首先检查是否有 pyinstaller 打包的二进制文件
        let possible_binary_paths = vec![
            "backend/excel-backend",
            "backend/excel-backend.exe", 
            "../backend/excel-backend",
            "../backend/excel-backend.exe",
            "./excel-backend",
            "./excel-backend.exe",
        ];

        for binary_path in possible_binary_paths {
            let path = Path::new(binary_path);
            if path.exists() && path.is_file() {
                log::info!("Found Python backend binary: {:?}", path);
                return Ok(BackendType::Binary { 
                    binary_path: path.to_path_buf() 
                });
            }
        }

        // 如果没有二进制文件，尝试查找 Python 脚本
        let possible_script_paths = vec![
            "../src-python/src/app/main.py",
            "../src-python/main.py", 
            "python/main.py",
            "backend/main.py",
        ];

        // 查找 Python 解释器
        let python_executable = self.find_python_executable()?;

        for script_path in possible_script_paths {
            let path = Path::new(script_path);
            if path.exists() && path.is_file() {
                log::info!("Found Python backend script: {:?}", path);
                return Ok(BackendType::PythonScript {
                    python_path: python_executable,
                    script_path: path.to_path_buf(),
                });
            }
        }

        Err("No Python backend found (neither binary nor script)".to_string())
    }

    /// 查找 Python 可执行文件
    fn find_python_executable(&self) -> Result<PathBuf, String> {
        // 优先查找虚拟环境中的 Python
        let venv_paths = vec![
            "../src-python/.venv/bin/python",
            "../src-python/.venv/Scripts/python.exe", 
            ".venv/bin/python",
            ".venv/Scripts/python.exe",
        ];

        for venv_path in venv_paths {
            let path = Path::new(venv_path);
            if path.exists() && path.is_file() {
                log::info!("Found Python in virtual environment: {:?}", path);
                return Ok(path.to_path_buf());
            }
        }

        // 如果没有虚拟环境，查找系统 Python
        if let Ok(python_path) = which("python3") {
            log::info!("Found system Python3: {:?}", python_path);
            return Ok(python_path);
        }

        if let Ok(python_path) = which("python") {
            log::info!("Found system Python: {:?}", python_path);
            return Ok(python_path);
        }

        Err("No Python executable found".to_string())
    }

    /// 启动后端进程
    fn start_backend_process(&mut self) -> Result<(), String> {
        let backend_type = self.detect_backend()?;

        let mut cmd = match backend_type {
            BackendType::Binary { binary_path } => {
                log::info!("Starting Python backend binary: {:?}", binary_path);
                Command::new(binary_path)
            }
            BackendType::PythonScript { python_path, script_path } => {
                log::info!("Starting Python backend script: {:?} with {:?}", 
                          script_path, python_path);
                let mut cmd = Command::new(python_path);
                cmd.arg(script_path);
                cmd
            }
        };

        // 配置进程
        cmd.stdin(Stdio::null())
           .stdout(Stdio::piped())
           .stderr(Stdio::piped());

        // 启动进程
        match cmd.spawn() {
            Ok(child) => {
                log::info!("Python backend started with PID: {}", child.id());
                self.process = Some(child);
                self.is_running = true;
                self.restart_attempts = 0;
                Ok(())
            }
            Err(e) => {
                Err(format!("Failed to start Python backend: {}", e))
            }
        }
    }

    /// 检查进程是否存活
    fn is_process_alive(&mut self) -> bool {
        if let Some(ref mut process) = self.process {
            match process.try_wait() {
                Ok(Some(_)) => {
                    // 进程已退出
                    log::warn!("Python backend process has exited");
                    self.is_running = false;
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
            self.is_running = false;
        }
        Ok(())
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

        // 重新启动
        self.start_backend_process()
    }

    /// 启动看门狗
    pub async fn start(&mut self) -> Result<(), String> {
        log::info!("Starting Python backend watchdog");

        // 启动后端进程
        self.start_backend_process()?;

        Ok(())
    }

    /// 启动看门狗监控循环（需要在独立的任务中运行）
    pub async fn start_monitoring(watchdog: Arc<Mutex<PythonWatchdog>>) {
        let mut interval = interval(Duration::from_secs(5)); // 每 5 秒检查一次
        
        loop {
            interval.tick().await;
            
            let mut guard = watchdog.lock().await;
            
            if guard.is_running && !guard.is_process_alive() {
                log::warn!("Python backend died, attempting restart...");
                if let Err(e) = guard.restart_process().await {
                    log::error!("Failed to restart Python backend: {}", e);
                    break;
                }
            }
            
            if !guard.is_running {
                log::info!("Watchdog monitoring stopped");
                break;
            }
        }
    }

    /// 停止看门狗和后端进程
    pub async fn stop(&mut self) -> Result<(), String> {
        log::info!("Stopping Python backend watchdog");
        self.is_running = false;
        self.kill_process()
    }

    /// 获取进程状态（未来可能会用于 UI 显示）
    #[allow(dead_code)]
    pub fn get_status(&self) -> String {
        if self.is_running {
            if let Some(ref process) = self.process {
                format!("Running (PID: {})", process.id())
            } else {
                "Starting...".to_string()
            }
        } else {
            "Stopped".to_string()
        }
    }
} 