use std::env;
use std::path::Path;
use std::process::Command;

fn main() {
    // 告诉Cargo在源文件改变时重新运行
    println!("cargo:rerun-if-changed=../src-python/src/main.py");
    println!("cargo:rerun-if-changed=../src-python/build_binary.py");
    
    // 检查是否在构建发布版本
    let profile = env::var("PROFILE").unwrap_or_default();
    if profile == "release" {
        // 检查backend目录是否存在
        let backend_path = Path::new("../backend/excel-backend/excel-backend");
        if !backend_path.exists() {
            println!("cargo:warning=Python backend not found, building...");
            
            // 构建Python后端
            let output = Command::new("python")
                .args(&["build_binary.py"])
                .current_dir("../src-python")
                .output();
                
            match output {
                Ok(output) => {
                    if !output.status.success() {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        println!("cargo:warning=Failed to build Python backend: {}", stderr);
                        panic!("Python backend build failed");
                    } else {
                        println!("cargo:warning=Python backend built successfully");
                    }
                }
                Err(e) => {
                    println!("cargo:warning=Failed to execute Python build script: {}", e);
                    // 在某些情况下我们可能没有Python环境，所以不要panic
                }
            }
        } else {
            println!("cargo:warning=Python backend already exists");
        }
    }
    
    tauri_build::build()
}
