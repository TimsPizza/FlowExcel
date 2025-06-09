use std::env;
use std::path::{PathBuf};
use std::process::Command;

fn main() {
    // 告诉Cargo在源文件改变时重新运行
    println!("cargo:rerun-if-changed=../src-python/src/main.py");
    println!("cargo:rerun-if-changed=../src-python/build_binary.py");
    
    // 检查是否在构建发布版本
    let profile = env::var("PROFILE").unwrap_or_default();
    if profile == "release" {
        // 确定操作系统特定的可执行文件扩展名
        let exe_extension = if cfg!(windows) { ".exe" } else { "" };
        
        // 检查backend目录是否存在
        let backend_path = PathBuf::from("..").join("backend").join("excel-backend").join(format!("excel-backend{}", exe_extension));
        if !backend_path.exists() {
            println!("cargo:warning=Python backend not found, building...");
            
            // 确定Python可执行文件名
            let python_cmd = if cfg!(windows) { "python.exe" } else { "python" };
            
            // 构建Python后端
            let output = Command::new(python_cmd)
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
    
    // 创建平台特定的符号链接以满足 Tauri externalBin 要求
    create_platform_specific_links();
    
    tauri_build::build()
}

fn create_platform_specific_links() {
    // 获取当前平台的 target triple
    let output = Command::new("rustc")
        .args(&["-vV"])
        .output()
        .expect("Failed to run rustc -vV");
    
    let output_str = String::from_utf8_lossy(&output.stdout);
    let target_triple = output_str
        .lines()
        .find(|line| line.starts_with("host:"))
        .and_then(|line| line.split_whitespace().nth(1))
        .expect("Failed to extract target triple");
    
    let exe_extension = if cfg!(windows) { ".exe" } else { "" };
    
    // 原始后端路径（onedir结构）
    let backend_dir = PathBuf::from("..").join("backend").join("excel-backend");
    let backend_exe = backend_dir.join(format!("excel-backend{}", exe_extension));
    
    // 平台特定的符号链接路径
    let platform_specific_path = PathBuf::from("..").join("backend")
        .join("excel-backend")
        .join(format!("excel-backend-{}{}", target_triple, exe_extension));
    
    if backend_exe.exists() {
        // 如果符号链接已存在，先删除
        if platform_specific_path.exists() {
            let _ = std::fs::remove_file(&platform_specific_path);
        }
        
        // 创建符号链接（相对路径）
        #[cfg(unix)]
        {
            let relative_target = format!("excel-backend{}", exe_extension);
            let result = std::os::unix::fs::symlink(&relative_target, &platform_specific_path);
            match result {
                Ok(_) => println!("cargo:warning=Created symlink: {} -> {}", platform_specific_path.display(), relative_target),
                Err(e) => println!("cargo:warning=Failed to create symlink: {}", e),
            }
        }
        
        #[cfg(windows)]
        {
            let relative_target = format!("excel-backend{}", exe_extension);
            let result = std::os::windows::fs::symlink_file(&relative_target, &platform_specific_path);
            match result {
                Ok(_) => println!("cargo:warning=Created symlink: {} -> {}", platform_specific_path.display(), relative_target),
                Err(e) => {
                    println!("cargo:warning=Failed to create symlink: {}, attempting file copy instead", e);
                    // Fallback: copy the file instead of creating a symlink
                    let copy_result = std::fs::copy(&backend_exe, &platform_specific_path);
                    match copy_result {
                        Ok(_) => println!("cargo:warning=Copied file: {} -> {}", backend_exe.display(), platform_specific_path.display()),
                        Err(copy_e) => println!("cargo:warning=Failed to copy file: {}", copy_e),
                    }
                }
            }
        }
    } else {
        println!("cargo:warning=Backend executable not found: {}", backend_exe.display());
    }
}
