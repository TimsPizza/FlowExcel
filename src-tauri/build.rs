use std::env;
use std::path::PathBuf;

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

        // 验证Python后端是否存在
        let backend_dir = PathBuf::from("binaries").join("flowexcel-backend");

        let exe_extension = if target.contains("windows") {
            ".exe"
        } else {
            ""
        };
        let backend_exe = backend_dir.join(format!("flowexcel-backend{}", exe_extension));
        println!("cargo:warning=Backend exe: {}", backend_exe.display());

        if !backend_exe.exists() {
            panic!(
                "Python backend not found at {}. Please run 'pnpm build:backend' first or ensure 'pnpm tauri build' was used.",
                backend_exe.display()
            );
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
