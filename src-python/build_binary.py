#!/usr/bin/env python3
"""
Build script for creating PyInstaller binary from Python backend.
This script will package the Excel FastAPI backend into a standalone executable.
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def check_requirements():
    """Check if PyInstaller is installed"""
    try:
        import PyInstaller
        print(f"PyInstaller version: {PyInstaller.__version__}")
        return True
    except ImportError:
        print("PyInstaller not found. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)
        return True

def build_binary():
    """Build the binary using PyInstaller"""
    script_dir = Path(__file__).parent
    main_script = script_dir / "src" / "main.py"  # 正确的入口文件
    build_dir = script_dir / "build"
    dist_dir = script_dir / "dist"
    
    # Create output directory
    output_dir = script_dir / ".." / "backend"
    output_dir.mkdir(exist_ok=True)
    
    if not main_script.exists():
        raise FileNotFoundError(f"Main script not found: {main_script}")
    
    print(f"Building binary from: {main_script}")
    
    # PyInstaller command for FastAPI application (directory mode for faster startup)
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onedir",  # Create a directory with executable and dependencies (faster startup)
        "--name", "excel-backend",  # Output directory name
        "--distpath", str(output_dir),  # Output directory
        "--workpath", str(build_dir),  # Build directory
        "--specpath", str(script_dir),  # Spec file location
        "--clean",  # Clean build cache
        "--windowed",  # Windowed application (no console)
        "--noconfirm",  # Don't ask for confirmation
        # Add hidden imports for FastAPI and dependencies
        "--hidden-import", "uvicorn",
        "--hidden-import", "fastapi",
        "--hidden-import", "pydantic",
        "--hidden-import", "numpy",
        "--hidden-import", "pandas",
        "--hidden-import", "openpyxl",
        "--hidden-import", "xlrd",
        "--hidden-import", "networkx",
        # Include the entire src directory to preserve structure
        "--add-data", f"{script_dir / 'src'}:src",
        str(main_script)
    ]
    
    print(f"Running: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, check=True, cwd=script_dir)
        print(f"\nBinary built successfully!")
        
        # Check for directory-based distribution
        binary_dir = output_dir / "excel-backend"
        binary_executable = binary_dir / "excel-backend"
        
        if binary_dir.exists() and binary_dir.is_dir():
            print(f"Binary directory: {binary_dir}")
            if binary_executable.exists():
                print(f"Main executable: {binary_executable}")
                print(f"Executable size: {binary_executable.stat().st_size / 1024 / 1024:.2f} MB")
            else:
                # Try with .exe extension on Windows
                binary_executable = binary_dir / "excel-backend.exe"
                if binary_executable.exists():
                    print(f"Main executable: {binary_executable}")
                    print(f"Executable size: {binary_executable.stat().st_size / 1024 / 1024:.2f} MB")
            
            # Calculate total directory size
            total_size = sum(f.stat().st_size for f in binary_dir.rglob('*') if f.is_file())
            print(f"Total directory size: {total_size / 1024 / 1024:.2f} MB")
            file_count = len(list(binary_dir.rglob('*')))
            print(f"Total files: {file_count}")
        else:
            print("Warning: Expected directory not found!")
        
        # Clean up build artifacts
        if build_dir.exists():
            shutil.rmtree(build_dir)
        if dist_dir.exists():
            shutil.rmtree(dist_dir)
        
        spec_file = script_dir / "excel-backend.spec"
        if spec_file.exists():
            spec_file.unlink()
            
        print("Build artifacts cleaned up.")
        
    except subprocess.CalledProcessError as e:
        print(f"Build failed with exit code: {e.returncode}")
        sys.exit(1)

def main():
    """Main build function"""
    print("Excel FastAPI Backend Binary Builder")
    print("=" * 40)
    
    if not check_requirements():
        print("Failed to install PyInstaller")
        sys.exit(1)
    
    try:
        build_binary()
        print("\nBuild completed successfully!")
        print("\nTo use the binary directory:")
        print("1. The Tauri watchdog will automatically detect and use the binary")
        print("2. Or run manually: ../backend/excel-backend/excel-backend")
        print("3. Backend will automatically find available port and send handshake info")
        print("4. Directory mode provides faster startup compared to single-file packaging")
        
    except Exception as e:
        print(f"Build failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
