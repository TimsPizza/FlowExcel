use std::process::Command;

// use crate::pipeline::models::Pipeline;
// use crate::pipeline::executor::execute_pipeline;
// use serde_json;
// use tauri::AppHandle;
// This module contains Tauri commands that interact with Python for Excel-specific operations

#[tauri::command]
pub async fn preview_excel_data(file_path: String) -> Result<String, String> {
    let output = Command::new("/Users/timspizza/code/tauri-excel/src-python/.venv/bin/python")
        .args([
            "/Users/timspizza/code/tauri-excel/src-python/src/main.py",
            "preview-data",
            "--file-path",
            &file_path,
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    } else {
        return Err(format!("Python调用失败: {}", output.status));
    }
}

#[tauri::command]
pub async fn get_index_values(
    file_path: String,
    sheet_name: String,
    column_name: String,
) -> Result<String, String> {
    let output = Command::new("/Users/timspizza/code/tauri-excel/src-python/.venv/bin/python")
        .args([
            "/Users/timspizza/code/tauri-excel/src-python/src/main.py",
            "get-index-values",
            "--file-path",
            &file_path,
            "--sheet-name",
            &sheet_name,
            "--column-name",
            &column_name,
        ])
        .output()
        .map_err(|e| e.to_string())?;
    // return the raw json string directly as python will return the correct json string
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    } else {
        return Err(format!("Python调用失败: {}", output.status));
    }
}

#[tauri::command]
pub async fn try_read_header_row(
    file_path: String,
    sheet_name: String,
    header_row: i32,
) -> Result<String, String> {
    let output = Command::new("/Users/timspizza/code/tauri-excel/src-python/.venv/bin/python")
        .args([
            "/Users/timspizza/code/tauri-excel/src-python/src/main.py",
            "try-read-header-row",
            "--file-path",
            &file_path,
            "--sheet-name",
            &sheet_name,
            "--header-row",
            &header_row.to_string(),
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    } else {
        return Err(format!("Python调用失败: {}", output.status));
    }
}

#[tauri::command]
pub async fn try_read_sheet_names(file_path: String) -> Result<String, String> {
    let output = Command::new("/Users/timspizza/code/tauri-excel/src-python/.venv/bin/python")
        .args([
            "/Users/timspizza/code/tauri-excel/src-python/src/main.py",
            "try-read-sheet-names",
            "--file-path",
            &file_path,
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    } else {
        return Err(format!("Python调用失败: {}", output.status));
    }
}
