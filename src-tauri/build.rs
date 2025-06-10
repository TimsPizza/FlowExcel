use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    // 告诉Cargo在源文件改变时重新运行
    println!("cargo:rerun-if-changed=../src-python/src/main.py");
    println!("cargo:rerun-if-changed=../src-python/build_binary.py");

    // 检查是否在构建发布版本
    let profile = env::var("PROFILE").unwrap_or_default();
    if profile == "release" {
        // 获取target信息，仅用于确定exe扩展名
        let target = env::var("TARGET").unwrap_or_default();
        println!("cargo:warning=Building for target: {}", target);

        // 检查Python后端是否存在
        let backend_dir = PathBuf::from("binaries").join("flowexcel-backend");

        let exe_extension = if target.contains("windows") {
            ".exe"
        } else {
            ""
        };
        let backend_exe = backend_dir.join(format!("flowexcel-backend{}", exe_extension));
        println!("cargo:warning=Backend exe: {}", backend_exe.display());

        if !backend_exe.exists() {
            println!(
                "cargo:warning=Python backend not found at {}, building...",
                backend_exe.display()
            );

            // 确定Python可执行文件名
            let python_cmd = if cfg!(windows) {
                "python.exe"
            } else {
                "python"
            };

            // 构建Python后端
            let output = Command::new(python_cmd)
                .args(&["build_binary.py"])
                .current_dir("../src-python")
                .output();

            match output {
                Ok(output) => {
                    if !output.status.success() {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        println!("cargo:warning=Python build stdout: {}", stdout);
                        println!("cargo:warning=Python build stderr: {}", stderr);
                        panic!("Python backend build failed");
                    } else {
                        println!("cargo:warning=Python backend built successfully");

                        // 验证构建的后端是否存在
                        if !backend_exe.exists() {
                            panic!("cargo:error=Backend still not found after build");
                        }
                    }
                }
                Err(e) => {
                    println!("cargo:warning=Failed to execute Python build script: {}", e);
                    // 在某些情况下我们可能没有Python环境，所以不要panic
                }
            }
        } else {
            println!(
                "cargo:warning=Python backend already exists at: {}",
                backend_exe.display()
            );
        }

        // 验证整个onedir结构存在
        if backend_dir.is_dir() {
            let internal_dir = backend_dir.join("_internal");
            if internal_dir.exists() {
                println!(
                    "cargo:warning=Backend onedir structure verified: {} with _internal/",
                    backend_dir.display()
                );
            } else {
                println!(
                    "cargo:warning=Warning: _internal directory not found in {}",
                    backend_dir.display()
                );
            }
        }
    }

    tauri_build::build()
}
