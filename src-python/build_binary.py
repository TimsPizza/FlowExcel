#!/usr/bin/env python3
"""
Build script for creating PyInstaller binary from Python backend.
This script will package the Excel backend into a standalone executable.
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
    main_script = script_dir / "src" / "app" / "main.py"
    build_dir = script_dir / "build"
    dist_dir = script_dir / "dist"
    
    # Create output directory
    output_dir = script_dir / ".." / "backend"
    output_dir.mkdir(exist_ok=True)
    
    if not main_script.exists():
        raise FileNotFoundError(f"Main script not found: {main_script}")
    
    print(f"Building binary from: {main_script}")
    
    # PyInstaller command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",  # Create a single executable file
        "--name", "excel-backend",  # Output binary name
        "--distpath", str(output_dir),  # Output directory
        "--workpath", str(build_dir),  # Build directory
        "--specpath", str(script_dir),  # Spec file location
        "--clean",  # Clean build cache
        "--console",  # Console application (can be changed to --windowed for GUI)
        str(main_script)
    ]
    
    print(f"Running: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, check=True, cwd=script_dir)
        print(f"\nBinary built successfully!")
        
        binary_path = output_dir / "excel-backend"
        if binary_path.exists():
            print(f"Binary location: {binary_path}")
            print(f"Binary size: {binary_path.stat().st_size / 1024 / 1024:.2f} MB")
        else:
            # Try with .exe extension on Windows
            binary_path = output_dir / "excel-backend.exe"
            if binary_path.exists():
                print(f"Binary location: {binary_path}")
                print(f"Binary size: {binary_path.stat().st_size / 1024 / 1024:.2f} MB")
        
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
    print("Excel Backend Binary Builder")
    print("=" * 40)
    
    if not check_requirements():
        print("Failed to install PyInstaller")
        sys.exit(1)
    
    try:
        build_binary()
        print("\nBuild completed successfully!")
        print("\nTo use the binary:")
        print("1. The Tauri watchdog will automatically detect and use the binary")
        print("2. Or run manually: ../backend/excel-backend")
        
    except Exception as e:
        print(f"Build failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 