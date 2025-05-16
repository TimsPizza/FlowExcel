use tauri::AppHandle;
use crate::bridge::models::{ApiResponse, ErrorResponse};
use crate::workspace::models::WorkspaceConfig;
use crate::workspace::service::{WorkspaceService, WorkspaceSummary};

/// List all available workspaces
#[tauri::command]
pub async fn list_workspaces(app_handle: AppHandle) -> Result<String, String> {
    match WorkspaceService::list_workspaces(&app_handle) {
        Ok(workspaces) => {
            let response = ApiResponse {
                status: "success".to_string(),
                message: None,
                data: Some(workspaces),
            };
            serde_json::to_string(&response).map_err(|e| e.to_string())
        },
        Err(error) => {
            let response = ApiResponse::<()> {
                status: "error".to_string(),
                message: Some(error.message),
                data: None,
            };
            serde_json::to_string(&response).map_err(|e| e.to_string())
        }
    }
}

/// Load a workspace by ID
#[tauri::command]
pub async fn load_workspace(app_handle: AppHandle, workspace_id: String) -> Result<String, String> {
    match WorkspaceService::load_workspace(&app_handle, &workspace_id) {
        Ok(workspace) => {
            let response = ApiResponse {
                status: "success".to_string(),
                message: None,
                data: Some(workspace),
            };
            serde_json::to_string(&response).map_err(|e| e.to_string())
        },
        Err(error) => {
            let response = ApiResponse::<()> {
                status: "error".to_string(),
                message: Some(error.message),
                data: None,
            };
            serde_json::to_string(&response).map_err(|e| e.to_string())
        }
    }
}

/// Save a workspace
#[tauri::command]
pub async fn save_workspace(
    app_handle: AppHandle, 
    workspace_id: String, 
    config_json: String
) -> Result<String, String> {
    // Parse the JSON config
    let config_data = match serde_json::from_str::<WorkspaceConfig>(&config_json) {
        Ok(config) => config,
        Err(e) => {
            let response = ApiResponse::<()> {
                status: "error".to_string(),
                message: Some(format!("Invalid workspace configuration JSON: {}", e)),
                data: None,
            };
            return serde_json::to_string(&response).map_err(|e| e.to_string());
        }
    };
    
    // Save the workspace
    match WorkspaceService::save_workspace(&app_handle, &workspace_id, &config_data) {
        Ok(_) => {
            let response = ApiResponse::<()> {
                status: "success".to_string(),
                message: Some(format!("Workspace '{}' saved successfully", config_data.name)),
                data: None,
            };
            serde_json::to_string(&response).map_err(|e| e.to_string())
        },
        Err(error) => {
            let response = ApiResponse::<()> {
                status: "error".to_string(),
                message: Some(error.message),
                data: None,
            };
            serde_json::to_string(&response).map_err(|e| e.to_string())
        }
    }
} 