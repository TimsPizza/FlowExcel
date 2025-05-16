use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Runtime;
use tauri::Manager;

// Get the app's data directory where we'll store workspaces
fn get_app_data_dir<R: Runtime>(app_handle: &AppHandle<R>) -> Option<PathBuf> {
    app_handle.path().app_data_dir().ok()
}

// Get the workspace directory path
pub fn get_workspace_dir<R: Runtime>(app_handle: &AppHandle<R>) -> Option<PathBuf> {
    get_app_data_dir(app_handle).map(|mut path| {
        path.push("workspaces");
        path
    })
}

// Ensure the workspace directory exists
pub fn ensure_workspace_dir<R: Runtime>(app_handle: &AppHandle<R>) -> std::io::Result<PathBuf> {
    if let Some(workspace_dir) = get_workspace_dir(app_handle) {
        if !workspace_dir.exists() {
            std::fs::create_dir_all(&workspace_dir)?;
        }
        Ok(workspace_dir)
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            "Failed to get workspace directory",
        ))
    }
}
