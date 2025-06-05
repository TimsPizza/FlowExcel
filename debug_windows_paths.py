#!/usr/bin/env python3
"""
Windows路径调试脚本
帮助诊断Tauri Excel应用在Windows上的路径检测问题
"""

import os
import sys
import platform
import subprocess
from pathlib import Path

def print_separator(title):
    print("\n" + "="*50)
    print(f" {title}")
    print("="*50)

def check_system_info():
    print_separator("系统信息")
    print(f"操作系统: {platform.system()} {platform.release()}")
    print(f"Python版本: {sys.version}")
    print(f"当前工作目录: {os.getcwd()}")
    print(f"脚本所在目录: {Path(__file__).parent.absolute()}")
    print(f"用户目录: {Path.home()}")

def check_expected_paths():
    print_separator("检查预期的路径结构")
    
    # 根据用户提供的路径结构检查
    installation_paths = [
        # 如果在安装目录运行
        Path("_up_/backend/excel-backend/excel-backend.exe"),
        Path("_up_/backend/excel-backend/_internal"),
        
        # 如果在上级目录运行
        Path("../_up_/backend/excel-backend/excel-backend.exe"),
        Path("../_up_/backend/excel-backend/_internal"),
        
        # 开发环境路径
        Path("backend/excel-backend/excel-backend.exe"),
        Path("../backend/excel-backend/excel-backend.exe"),
    ]
    
    for path in installation_paths:
        exists = path.exists()
        if exists:
            is_file = path.is_file()
            size = path.stat().st_size if path.exists() and path.is_file() else "N/A"
            print(f"✓ {path} - {'文件' if is_file else '目录'} ({size} bytes)")
        else:
            print(f"✗ {path} - 不存在")

def check_current_directory_contents():
    print_separator("当前目录内容")
    
    try:
        current_dir = Path(".")
        print(f"列出 {current_dir.absolute()} 的内容:")
        
        for item in sorted(current_dir.iterdir()):
            item_type = "DIR " if item.is_dir() else "FILE"
            try:
                size = item.stat().st_size if item.is_file() else ""
                size_str = f"({size} bytes)" if size else ""
                print(f"  {item_type} {item.name} {size_str}")
            except (OSError, PermissionError) as e:
                print(f"  {item_type} {item.name} (无法访问: {e})")
                
    except Exception as e:
        print(f"无法列出目录内容: {e}")

def check_parent_directory_contents():
    print_separator("上级目录内容")
    
    try:
        parent_dir = Path("..")
        print(f"列出 {parent_dir.absolute()} 的内容:")
        
        for item in sorted(parent_dir.iterdir()):
            item_type = "DIR " if item.is_dir() else "FILE"
            try:
                size = item.stat().st_size if item.is_file() else ""
                size_str = f"({size} bytes)" if size else ""
                print(f"  {item_type} {item.name} {size_str}")
            except (OSError, PermissionError) as e:
                print(f"  {item_type} {item.name} (无法访问: {e})")
                
    except Exception as e:
        print(f"无法列出上级目录内容: {e}")

def check_python_executables():
    print_separator("Python可执行文件检查")
    
    python_candidates = ["python.exe", "python3.exe", "python"]
    
    for candidate in python_candidates:
        try:
            result = subprocess.run([candidate, "--version"], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                print(f"✓ {candidate}: {result.stdout.strip()}")
            else:
                print(f"✗ {candidate}: 运行失败")
        except FileNotFoundError:
            print(f"✗ {candidate}: 未找到")
        except subprocess.TimeoutExpired:
            print(f"✗ {candidate}: 超时")
        except Exception as e:
            print(f"✗ {candidate}: 错误 - {e}")

def check_process_info():
    print_separator("进程信息")
    
    try:
        # 检查是否有相关进程运行
        result = subprocess.run(["tasklist", "/FI", "IMAGENAME eq tauri-excel-app.exe"], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print("Tauri进程:")
            print(result.stdout)
        else:
            print("无法获取Tauri进程信息")
    except Exception as e:
        print(f"检查进程失败: {e}")
    
    try:
        result = subprocess.run(["tasklist", "/FI", "IMAGENAME eq excel-backend.exe"], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print("Backend进程:")
            print(result.stdout)
        else:
            print("无Backend进程运行")
    except Exception as e:
        print(f"检查Backend进程失败: {e}")

def check_environment_variables():
    print_separator("环境变量")
    
    important_vars = [
        "PATH", "PYTHONPATH", "VIRTUAL_ENV", "TAURI_PLATFORM", 
        "RUST_LOG", "PROGRAMFILES", "APPDATA", "LOCALAPPDATA"
    ]
    
    for var in important_vars:
        value = os.environ.get(var, "未设置")
        if var == "PATH":
            print(f"{var}:")
            for path in value.split(os.pathsep):
                print(f"  {path}")
        else:
            print(f"{var}: {value}")

def test_file_operations():
    print_separator("文件操作测试")
    
    # 测试在当前目录创建/删除文件
    test_file = Path("test_write_permissions.txt")
    
    try:
        test_file.write_text("测试文件写入权限")
        print("✓ 当前目录写入权限正常")
        test_file.unlink()
        print("✓ 当前目录删除权限正常")
    except Exception as e:
        print(f"✗ 文件操作失败: {e}")

def main():
    print("Windows路径调试工具")
    print("="*50)
    print("此工具将帮助诊断Tauri Excel应用在Windows上的问题")
    
    check_system_info()
    check_current_directory_contents()
    check_parent_directory_contents()
    check_expected_paths()
    check_python_executables()
    check_environment_variables()
    check_process_info()
    test_file_operations()
    
    print_separator("诊断完成")
    print("请将上述输出发送给开发者以获得进一步帮助")
    print("如果发现任何✓标记的路径，说明找到了backend文件")
    
    input("\n按回车键退出...")

if __name__ == "__main__":
    main() 