use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use std::io::{BufRead, BufReader};

static API_MANAGER: OnceLock<Arc<ApiManager>> = OnceLock::new();

pub struct ApiManager {
    process: Arc<Mutex<Option<Child>>>,
    should_restart: Arc<Mutex<bool>>,
    api_url: String,
}

impl ApiManager {
    fn new() -> Result<Self, String> {
        let manager = ApiManager {
            process: Arc::new(Mutex::new(None)),
            should_restart: Arc::new(Mutex::new(true)),
            api_url: "http://127.0.0.1:11017".to_string(),
        };
        
        // Start the API server
        manager.start_api_server()?;
        
        // Start watchdog thread
        manager.start_watchdog();
        
        Ok(manager)
    }
    
    fn start_api_server(&self) -> Result<(), String> {
        let python_path = "/Users/timspizza/code/tauri-excel/src-python/.venv/bin/python";
        let api_server_path = "/Users/timspizza/code/tauri-excel/src-python/src/api_server.py";
        
        let mut child = Command::new(python_path)
            .arg(api_server_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start API server: {}", e))?;
        
        // Capture stdout for logging
        if let Some(stdout) = child.stdout.take() {
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        println!("[API Server] {}", line);
                    }
                }
            });
        }
        
        // Capture stderr for logging
        if let Some(stderr) = child.stderr.take() {
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        eprintln!("[API Server Error] {}", line);
                    }
                }
            });
        }
        
        {
            let mut process = self.process.lock().unwrap();
            *process = Some(child);
        }
        
        // Wait a moment for the server to start
        thread::sleep(Duration::from_secs(2));
        
        // Check if server is responding
        self.wait_for_server_ready()?;
        
        Ok(())
    }
    
    fn wait_for_server_ready(&self) -> Result<(), String> {
        for _ in 0..30 { // Try for 30 seconds
            if self.is_server_healthy() {
                println!("API server is ready and responding");
                return Ok(());
            }
            thread::sleep(Duration::from_secs(1));
        }
        Err("API server failed to become ready within 30 seconds".to_string())
    }
    
    fn is_server_healthy(&self) -> bool {
        // Check if process is still running
        let process_alive = {
            let mut process = self.process.lock().unwrap();
            if let Some(ref mut child) = *process {
                match child.try_wait() {
                    Ok(Some(_)) => false, // Process has exited
                    Ok(None) => true,     // Process is still running
                    Err(_) => false,      // Error checking process status
                }
            } else {
                false
            }
        };
        
        if !process_alive {
            return false;
        }
        
        // Try to make a health check request
        match std::process::Command::new("curl")
            .args(["-s", "-f", &format!("{}/health", self.api_url)])
            .output()
        {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }
    
    fn start_watchdog(&self) {
        let process_ref = Arc::clone(&self.process);
        let should_restart_ref = Arc::clone(&self.should_restart);
        let api_url = self.api_url.clone();
        
        thread::spawn(move || {
            loop {
                thread::sleep(Duration::from_secs(5)); // Check every 5 seconds
                
                let should_continue = {
                    let should_restart = should_restart_ref.lock().unwrap();
                    *should_restart
                };
                
                if !should_continue {
                    break;
                }
                
                let needs_restart = {
                    let mut process = process_ref.lock().unwrap();
                    if let Some(ref mut child) = *process {
                        match child.try_wait() {
                            Ok(Some(_)) => true,  // Process has exited
                            Ok(None) => false,    // Process is still running
                            Err(_) => true,       // Error checking process status
                        }
                    } else {
                        true
                    }
                };
                
                if needs_restart {
                    eprintln!("API server died, attempting to restart...");
                    
                    // Try to start a new server
                    let python_path = "/Users/timspizza/code/tauri-excel/src-python/.venv/bin/python";
                    let api_server_path = "/Users/timspizza/code/tauri-excel/src-python/src/api_server.py";
                    
                    match Command::new(python_path)
                        .arg(api_server_path)
                        .stdout(Stdio::piped())
                        .stderr(Stdio::piped())
                        .spawn()
                    {
                        Ok(mut new_child) => {
                            // Capture stdout for logging
                            if let Some(stdout) = new_child.stdout.take() {
                                thread::spawn(move || {
                                    let reader = BufReader::new(stdout);
                                    for line in reader.lines() {
                                        if let Ok(line) = line {
                                            println!("[API Server] {}", line);
                                        }
                                    }
                                });
                            }
                            
                            // Capture stderr for logging
                            if let Some(stderr) = new_child.stderr.take() {
                                thread::spawn(move || {
                                    let reader = BufReader::new(stderr);
                                    for line in reader.lines() {
                                        if let Ok(line) = line {
                                            eprintln!("[API Server Error] {}", line);
                                        }
                                    }
                                });
                            }
                            
                            {
                                let mut process = process_ref.lock().unwrap();
                                *process = Some(new_child);
                            }
                            
                            // Wait for server to be ready
                            thread::sleep(Duration::from_secs(2));
                            
                            // Check if server is responding
                            for _ in 0..10 { // Try for 10 seconds
                                match std::process::Command::new("curl")
                                    .args(["-s", "-f", &format!("{}/health", api_url)])
                                    .output()
                                {
                                    Ok(output) if output.status.success() => {
                                        eprintln!("API server restarted successfully");
                                        break;
                                    }
                                    _ => {
                                        thread::sleep(Duration::from_secs(1));
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to restart API server: {}", e);
                            // Wait a bit longer before trying again
                            thread::sleep(Duration::from_secs(10));
                        }
                    }
                }
            }
        });
    }
    
    pub fn get_api_url(&self) -> &str {
        &self.api_url
    }
    
    pub fn shutdown(&self) -> Result<(), String> {
        // Stop the watchdog
        {
            let mut should_restart = self.should_restart.lock().unwrap();
            *should_restart = false;
        }
        
        // Try to shutdown the server gracefully
        let _ = std::process::Command::new("curl")
            .args(["-X", "POST", &format!("{}/shutdown", self.api_url)])
            .output();
        
        // Wait a moment for graceful shutdown
        thread::sleep(Duration::from_millis(500));
        
        // Force kill if still running
        {
            let mut process = self.process.lock().unwrap();
            if let Some(ref mut child) = *process {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        
        Ok(())
    }
}

pub fn init_api_manager() -> Result<(), String> {
    let manager = ApiManager::new()?;
    let _ = API_MANAGER.set(Arc::new(manager));
    Ok(())
}

pub fn get_api_url() -> Result<String, String> {
    API_MANAGER
        .get()
        .ok_or_else(|| "API manager not initialized".to_string())
        .map(|manager| manager.get_api_url().to_string())
}

pub fn shutdown_api_manager() -> Result<(), String> {
    if let Some(manager) = API_MANAGER.get() {
        manager.shutdown()?;
    }
    Ok(())
} 