use crate::bridge::models::{ApiResponse, ErrorResponse};
use crate::workspace::models::WorkspaceConfig;
use crate::workspace::utils::ensure_workspace_dir;
use std::fs;
use std::path::{Path};
use tauri::AppHandle;

pub struct WorkspaceService;

impl WorkspaceService {
    /// Save a workspace configuration to a JSON file
    pub fn save_workspace(
        app_handle: &AppHandle,
        workspace_id: &str,
        config_data: &WorkspaceConfig,
    ) -> Result<ApiResponse<WorkspaceConfig>, ErrorResponse> {
        // Check if ID in config matches the workspace_id
        if config_data.id != workspace_id {
            return Err(ErrorResponse {
                error_type: "IDMismatch".to_string(),
                message: format!(
                    "Workspace ID in config ({}) does not match save ID ({}).",
                    config_data.id, workspace_id
                ),
            });
        }

        // Ensure workspace directory exists
        let workspace_dir = match ensure_workspace_dir(app_handle) {
            Ok(dir) => dir,
            Err(e) => {
                return Err(ErrorResponse {
                    error_type: "DirectoryError".to_string(),
                    message: format!("Failed to create workspace directory: {}", e),
                })
            }
        };

        // Create file path
        let file_path = workspace_dir.join(format!("{}.json", workspace_id));

        // Serialize and save workspace to file
        let json_string = match serde_json::to_string_pretty(config_data) {
            Ok(json) => json,
            Err(e) => {
                return Err(ErrorResponse {
                    error_type: "SerializationError".to_string(),
                    message: format!("Failed to serialize workspace: {}", e),
                })
            }
        };

        match fs::write(&file_path, json_string) {
            // on success, return original json string
            Ok(_) => Ok(ApiResponse::<WorkspaceConfig> {
                status: "success".to_string(),
                message: None,
                data: Some(config_data.clone()),
            }),
            Err(e) => Err(ErrorResponse {
                error_type: "FileWriteError".to_string(),
                message: format!("Failed to write workspace file: {}", e),
            }),
        }
    }

    /// Load a workspace configuration from a JSON file
    pub fn load_workspace(
        app_handle: &AppHandle,
        workspace_id: &str,
    ) -> Result<WorkspaceConfig, ErrorResponse> {
        // Ensure workspace directory exists
        let workspace_dir = match ensure_workspace_dir(app_handle) {
            Ok(dir) => dir,
            Err(e) => {
                return Err(ErrorResponse {
                    error_type: "DirectoryError".to_string(),
                    message: format!("Failed to access workspace directory: {}", e),
                })
            }
        };

        // Create file path
        let file_path = workspace_dir.join(format!("{}.json", workspace_id));

        // Check if file exists
        if !file_path.exists() {
            return Err(ErrorResponse {
                error_type: "FileNotFound".to_string(),
                message: format!("Workspace file for ID '{}' not found.", workspace_id),
            });
        }

        // Read file contents
        let file_content = match fs::read_to_string(&file_path) {
            Ok(content) => content,
            Err(e) => {
                return Err(ErrorResponse {
                    error_type: "FileReadError".to_string(),
                    message: format!("Failed to read workspace file: {}", e),
                })
            }
        };

        // Deserialize JSON to WorkspaceConfig
        match serde_json::from_str::<WorkspaceConfig>(&file_content) {
            Ok(config) => Ok(config),
            Err(e) => Err(ErrorResponse {
                error_type: "DeserializationError".to_string(),
                message: format!("Failed to parse workspace JSON: {}", e),
            }),
        }
    }

    /// List all available workspaces
    pub fn list_workspaces(app_handle: &AppHandle) -> Result<Vec<WorkspaceSummary>, ErrorResponse> {
        // Ensure workspace directory exists
        let workspace_dir = match ensure_workspace_dir(app_handle) {
            Ok(dir) => dir,
            Err(e) => {
                return Err(ErrorResponse {
                    error_type: "DirectoryError".to_string(),
                    message: format!("Failed to access workspace directory: {}", e),
                })
            }
        };

        let mut workspace_list = Vec::new();

        // Scan directory for JSON files
        match fs::read_dir(&workspace_dir) {
            Ok(entries) => {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
                            if let Some(summary) = Self::extract_workspace_summary(&path) {
                                workspace_list.push(summary);
                            }
                        }
                    }
                }
                Ok(workspace_list)
            }
            Err(e) => Err(ErrorResponse {
                error_type: "DirectoryReadError".to_string(),
                message: format!("Failed to read workspace directory: {}", e),
            }),
        }
    }

    /// Extract workspace summary from a JSON file
    fn extract_workspace_summary(file_path: &Path) -> Option<WorkspaceSummary> {
        if let Ok(file_content) = fs::read_to_string(file_path) {
            if let Ok(config) = serde_json::from_str::<WorkspaceConfig>(&file_content) {
                // Ensure the ID in the file matches the filename for consistency
                if let Some(stem) = file_path.file_stem() {
                    if let Some(stem_str) = stem.to_str() {
                        if config.id == stem_str {
                            return Some(WorkspaceSummary {
                                id: config.id,
                                name: config.name,
                            });
                        }
                    }
                }
            }
        }
        None
    }
}

/// Simplified workspace summary for listing
#[derive(serde::Serialize, serde::Deserialize)]
pub struct WorkspaceSummary {
    pub id: String,
    pub name: String,
}
