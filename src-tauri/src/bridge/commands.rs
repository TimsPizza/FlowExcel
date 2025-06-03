use serde_json::json;
use crate::bridge::daemon_manager::get_daemon;

// This module contains Tauri commands that interact with Python for Excel-specific operations

#[tauri::command]
pub async fn preview_excel_data(file_path: String) -> Result<String, String> {
    let daemon = get_daemon()?;
    let params = json!({
        "file_path": file_path
    });
    
    daemon.send_command("preview_excel_data", params).await
}

#[tauri::command]
pub async fn get_index_values(
    file_path: String,
    sheet_name: String,
    header_row: i32,
    column_name: String,
) -> Result<String, String> {
    let daemon = get_daemon()?;
    let params = json!({
        "file_path": file_path,
        "sheet_name": sheet_name,
        "header_row": header_row,
        "column_name": column_name
    });
    
    daemon.send_command("get_index_values", params).await
}

#[tauri::command]
pub async fn try_read_header_row(
    file_path: String,
    sheet_name: String,
    header_row: i32,
) -> Result<String, String> {
    let daemon = get_daemon()?;
    let params = json!({
        "file_path": file_path,
        "sheet_name": sheet_name,
        "header_row": header_row
    });
    
    daemon.send_command("try_read_header_row", params).await
}

#[tauri::command]
pub async fn try_read_sheet_names(file_path: String) -> Result<String, String> {
    let daemon = get_daemon()?;
    let params = json!({
        "file_path": file_path
    });
    
    daemon.send_command("try_read_sheet_names", params).await
}

#[tauri::command]
pub async fn execute_pipeline(pipeline_json: String) -> Result<String, String> {
    let daemon = get_daemon()?;
    let params = json!({
        "pipeline_json": pipeline_json
    });
    
    daemon.send_command("execute_pipeline", params).await
}

#[tauri::command]
pub async fn test_pipeline_node(
    app_handle: tauri::AppHandle,
    workspace_id: String,
    node_id: String,
) -> Result<String, String> {
    // 1. 先拿到带包装的 JSON
    let workspace_json = crate::workspace::commands::load_workspace(app_handle, workspace_id.clone())
        .await
        .map_err(|e| format!("加载工作区失败: {}", e))?;

    // 2. 把它 parse 成 Value，取出 .data 这一层
    let v: serde_json::Value = serde_json::from_str(&workspace_json)
        .map_err(|e| format!("解析 workspace_json 失败: {}", e))?;
    let pipeline_data = v
        .get("data")
        .ok_or("workspace_json 里缺少 data 字段")?
        .to_string(); // to_string() 会把 data 对象转回干净的 JSON 字符串

    // 3. 通过daemon发送给Python
    let daemon = get_daemon()?;
    let params = json!({
        "pipeline_json": pipeline_data,
        "node_id": node_id
    });
    
    daemon.send_command("test_pipeline_node", params).await
}
