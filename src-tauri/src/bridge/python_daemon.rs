use std::process::{Child, Command, Stdio};
use std::io::{BufRead, BufReader, Write};
use std::sync::{Arc, Mutex};
use serde_json::{json, Value};
use tokio::sync::oneshot;
use std::collections::HashMap;
use std::thread;
use std::sync::atomic::{AtomicU64, Ordering};

pub struct PythonDaemon {
    process: Arc<Mutex<Option<Child>>>,
    sender: Arc<Mutex<Option<std::process::ChildStdin>>>,
    pending_requests: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<String, String>>>>>,
    request_id_counter: AtomicU64,
}

impl PythonDaemon {
    pub fn new() -> Result<Self, String> {
        let python_path = "/Users/timspizza/code/tauri-excel/src-python/.venv/bin/python";
        let daemon_path = "/Users/timspizza/code/tauri-excel/src-python/src/daemon.py";
        
        let mut child = Command::new(python_path)
            .arg(daemon_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start Python daemon: {}", e))?;

        let stdin = child.stdin.take().ok_or("Failed to get stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to get stdout")?;

        let daemon = PythonDaemon {
            process: Arc::new(Mutex::new(Some(child))),
            sender: Arc::new(Mutex::new(Some(stdin))),
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
            request_id_counter: AtomicU64::new(1),
        };

        // Start the response handler thread
        daemon.start_response_handler(stdout)?;

        // Wait for ready signal
        daemon.wait_for_ready()?;

        Ok(daemon)
    }

    fn start_response_handler(&self, stdout: std::process::ChildStdout) -> Result<(), String> {
        let pending_requests = Arc::clone(&self.pending_requests);
        
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        if let Ok(response) = serde_json::from_str::<Value>(&line) {
                            // For now, we'll use a simple approach where each request gets an immediate response
                            // In a more sophisticated implementation, you might want to use request IDs
                            let sender = {
                                let mut pending = pending_requests.lock().unwrap();
                                let x = pending.drain().next().map(|(_, sender)| sender);
                                x
                            };
                            
                            if let Some(sender) = sender {
                                let result = if response["success"].as_bool().unwrap_or(false) {
                                    Ok(response["data"].to_string())
                                } else {
                                    Err(response["error"].as_str().unwrap_or("Unknown error").to_string())
                                };
                                let _ = sender.send(result);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Error reading from Python daemon: {}", e);
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    fn wait_for_ready(&self) -> Result<(), String> {
        // This is a simplified approach - in practice you might want a timeout
        std::thread::sleep(std::time::Duration::from_millis(100));
        Ok(())
    }

    pub async fn send_command(&self, command_type: &str, params: Value) -> Result<String, String> {
        let (tx, rx) = oneshot::channel();
        let request_id = self.request_id_counter.fetch_add(1, Ordering::SeqCst);
        
        // Store the pending request
        {
            let mut pending = self.pending_requests.lock().unwrap();
            pending.insert(request_id, tx);
        }

        // Send the command
        let command = json!({
            "type": command_type,
            "params": params
        });

        {
            let mut sender = self.sender.lock().unwrap();
            if let Some(ref mut stdin) = *sender {
                writeln!(stdin, "{}", command.to_string())
                    .map_err(|e| format!("Failed to write to Python daemon: {}", e))?;
                stdin.flush()
                    .map_err(|e| format!("Failed to flush Python daemon stdin: {}", e))?;
            } else {
                return Err("Python daemon stdin not available".to_string());
            }
        }

        // Wait for response
        rx.await.map_err(|_| "Failed to receive response from Python daemon".to_string())?
    }

    pub fn is_alive(&self) -> bool {
        let mut process = self.process.lock().unwrap();
        if let Some(ref mut child) = *process {
            // Check if process is still running
            match child.try_wait() {
                Ok(Some(_)) => false, // Process has exited
                Ok(None) => true,     // Process is still running
                Err(_) => false,      // Error checking process status
            }
        } else {
            false
        }
    }

    pub fn shutdown(&self) -> Result<(), String> {
        // Send shutdown command
        let command = json!({
            "type": "shutdown",
            "params": {}
        });

        {
            let mut sender = self.sender.lock().unwrap();
            if let Some(ref mut stdin) = *sender {
                let _ = writeln!(stdin, "{}", command.to_string());
                let _ = stdin.flush();
            }
        }

        // Wait for process to exit
        {
            let mut process = self.process.lock().unwrap();
            if let Some(ref mut child) = *process {
                let _ = child.wait();
            }
        }

        Ok(())
    }
}

impl Drop for PythonDaemon {
    fn drop(&mut self) {
        let _ = self.shutdown();
    }
} 