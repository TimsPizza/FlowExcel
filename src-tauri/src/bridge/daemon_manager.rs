use std::sync::{Arc, OnceLock, Mutex};
use std::thread;
use std::time::Duration;
use crate::bridge::python_daemon::PythonDaemon;

static DAEMON_MANAGER: OnceLock<Arc<DaemonManager>> = OnceLock::new();

pub struct DaemonManager {
    daemon: Arc<Mutex<Arc<PythonDaemon>>>,
    should_restart: Arc<Mutex<bool>>,
}

impl DaemonManager {
    fn new() -> Result<Self, String> {
        let daemon = Arc::new(PythonDaemon::new()?);
        let manager = DaemonManager {
            daemon: Arc::new(Mutex::new(daemon)),
            should_restart: Arc::new(Mutex::new(true)),
        };
        
        // Start watchdog thread
        manager.start_watchdog();
        
        Ok(manager)
    }
    
    fn start_watchdog(&self) {
        let daemon_ref = Arc::clone(&self.daemon);
        let should_restart_ref = Arc::clone(&self.should_restart);
        
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
                    let daemon_guard = daemon_ref.lock().unwrap();
                    !daemon_guard.is_alive()
                };
                
                if needs_restart {
                    eprintln!("Python daemon died, attempting to restart...");
                    
                    match PythonDaemon::new() {
                        Ok(new_daemon) => {
                            let mut daemon_guard = daemon_ref.lock().unwrap();
                            *daemon_guard = Arc::new(new_daemon);
                            eprintln!("Python daemon restarted successfully");
                        }
                        Err(e) => {
                            eprintln!("Failed to restart Python daemon: {}", e);
                            // Wait a bit longer before trying again
                            thread::sleep(Duration::from_secs(10));
                        }
                    }
                }
            }
        });
    }
    
    pub fn get_daemon(&self) -> Result<Arc<PythonDaemon>, String> {
        let daemon_guard = self.daemon.lock().unwrap();
        Ok(Arc::clone(&*daemon_guard))
    }
    
    pub fn shutdown(&self) -> Result<(), String> {
        // Stop the watchdog
        {
            let mut should_restart = self.should_restart.lock().unwrap();
            *should_restart = false;
        }
        
        // Shutdown the daemon
        {
            let daemon_guard = self.daemon.lock().unwrap();
            daemon_guard.shutdown()?;
        }
        
        Ok(())
    }
}

pub fn init_daemon() -> Result<(), String> {
    let manager = DaemonManager::new()?;
    let _ = DAEMON_MANAGER.set(Arc::new(manager));
    Ok(())
}

pub fn get_daemon() -> Result<Arc<PythonDaemon>, String> {
    DAEMON_MANAGER
        .get()
        .ok_or_else(|| "Daemon not initialized".to_string())?
        .get_daemon()
}

pub fn shutdown_daemon() -> Result<(), String> {
    if let Some(manager) = DAEMON_MANAGER.get() {
        manager.shutdown()?;
    }
    Ok(())
} 