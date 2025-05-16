use std::process::Command;
// This module contains Tauri commands that interact with Python for Excel-specific operations

#[tauri::command]
pub async fn preview_excel_data(
    file_path: String,
) -> Result<String, String> {
    let output = Command::new("/Users/timspizza/code/excel/.venv/bin/python")
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
