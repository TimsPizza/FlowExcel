use crate::manager::BackendManager;
use crate::types::{BackendState, BackendStatus, HandshakePayload};
use std::sync::{Arc, Mutex};
use tauri::State;

#[derive(Default)]
pub struct SharedBackendManager(pub Arc<Mutex<Option<BackendManager>>>);

// is this still in use? but I will keep it for now
#[tauri::command]
pub fn get_backend_port(manager: State<SharedBackendManager>) -> Result<u16, String> {
    let manager = manager.0.lock().unwrap();
    if let Some(backend_manager) = manager.as_ref() {
        let status = backend_manager.get_status();
        if let BackendState::Running(payload) = status.state {
            Ok(payload.port)
        } else {
            Err("Backend is not running".to_string())
        }
    } else {
        Err("Backend manager not initialized".to_string())
    }
}

#[tauri::command]
pub fn get_backend_info(manager: State<SharedBackendManager>) -> Result<HandshakePayload, String> {
    let manager = manager.0.lock().unwrap();
    if let Some(backend_manager) = manager.as_ref() {
        let status = backend_manager.get_status();
        if let BackendState::Running(payload) = status.state {
            Ok(payload)
        } else {
            Err("Backend is not running".to_string())
        }
    } else {
        Err("Backend manager not initialized".to_string())
    }
}

#[tauri::command]
pub fn get_backend_status(manager: State<SharedBackendManager>) -> Result<BackendStatus, String> {
    let manager = manager.0.lock().unwrap();
    if let Some(backend_manager) = manager.as_ref() {
        Ok(backend_manager.get_status())
    } else {
        Err("Backend manager not initialized".to_string())
    }
}

#[tauri::command]
pub async fn start_backend(manager: State<'_, SharedBackendManager>) -> Result<(), String> {
    let backend_manager = {
        let manager = manager.0.lock().unwrap();
        manager.as_ref().cloned()
    };
    
    if let Some(backend_manager) = backend_manager {
        backend_manager.start_backend().await
    } else {
        Err("Backend manager not initialized".to_string())
    }
}

#[tauri::command]
pub async fn restart_backend(manager: State<'_, SharedBackendManager>) -> Result<(), String> {
    let backend_manager = {
        let manager = manager.0.lock().unwrap();
        manager.as_ref().cloned()
    };
    
    if let Some(backend_manager) = backend_manager {
        // Force restart by setting state to NotStarted
        {
            let mut status = backend_manager.status.lock().unwrap();
            status.state = BackendState::NotStarted;
            status.restart_count = 0;
        }
        backend_manager.start_backend().await
    } else {
        Err("Backend manager not initialized".to_string())
    }
} 