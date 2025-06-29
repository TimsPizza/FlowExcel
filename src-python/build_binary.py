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


def main():
    # Get the script directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    src_dir = script_dir / "src"
    main_file = src_dir / "main.py"

    # Ensure main.py exists
    if not main_file.exists():
        print(f"Error: {main_file} not found")
        sys.exit(1)

    # Create dist directory
    dist_dir = script_dir / "dist"
    dist_dir.mkdir(exist_ok=True)

    # Prepare PyInstaller command
    pyinstaller_cmd = [
        "pyinstaller",
        "-y",  # 一键确认，别TM再报错了
        "--onedir",
        "--console",  # 明确使用控制台模式，确保stdin/stdout可用
        "--clean",
        "--distpath",
        str(dist_dir),
        "--name",
        "flowexcel-backend",
        # 添加隐藏导入以确保所有依赖都被包含
        "--hidden-import",
        "uvicorn",
        "--hidden-import",
        "fastapi",
        "--hidden-import",
        "pydantic",
        "--hidden-import",
        "numpy",
        "--hidden-import",
        "pandas",
        "--hidden-import",
        "openpyxl",
        "--hidden-import",
        "xlrd",
        "--hidden-import",
        "networkx",
        str(main_file),
    ]

    print("Building with PyInstaller...")
    print(f"Command: {' '.join(pyinstaller_cmd)}")

    # Run PyInstaller
    try:
        result = subprocess.run(pyinstaller_cmd, check=True, cwd=script_dir)
        print("PyInstaller build completed successfully")
    except subprocess.CalledProcessError as e:
        print(f"PyInstaller build failed: {e}")
        sys.exit(1)

    # Source directory with the built application
    source_dir = dist_dir / "flowexcel-backend"
    if not source_dir.exists():
        print(f"Error: Built application not found at {source_dir}")
        sys.exit(1)

    # Target directories for Tauri
    tauri_binaries_dir = project_root / "src-tauri" / "binaries"
    tauri_binaries_dir.mkdir(parents=True, exist_ok=True)

    target_base_dir = tauri_binaries_dir / "flowexcel-backend"

    # Remove existing target directory
    if target_base_dir.exists():
        shutil.rmtree(target_base_dir, ignore_errors=True)

    # Copy the entire onedir to the base location
    try:
        shutil.copytree(source_dir, target_base_dir)
        print(f"Copied application to: {target_base_dir}")
    except Exception as e:
        print(f"Failed to copy application: {e}")
        sys.exit(1)

    # Get the executable name (no renaming needed now)
    exe_extension = ".exe" if os.name == "nt" else ""
    exe_name = f"flowexcel-backend{exe_extension}"

    exe_path = target_base_dir / exe_name

    # Verify executable exists
    if not exe_path.exists():
        print(f"Error: Executable not found: {exe_path}")
        sys.exit(1)

    # Ensure executable has correct permissions
    try:
        os.chmod(exe_path, 0o755)
        print(f"Set executable permissions: {exe_path}")
    except Exception as e:
        print(f"Warning: Could not set permissions for {exe_path}: {e}")

    print("\nBuild completed successfully!")
    print(f"Onedir location: {target_base_dir}")
    print(f"Executable: {exe_path}")

    # Verify the structure
    print(f"\nVerification:")
    if exe_path.exists():
        print(f"✓ Executable: {exe_path}")
        print(f"  Size: {exe_path.stat().st_size / 1024 / 1024:.2f} MB")
    else:
        print(f"✗ Executable missing: {exe_path}")

    # Check _internal directory
    internal_dir = target_base_dir / "_internal"
    if internal_dir.exists():
        file_count = len(list(internal_dir.rglob("*")))
        print(f"✓ _internal directory: {file_count} files")
    else:
        print(f"✗ _internal directory missing")

    # Test if the executable can be run (basic check)
    try:
        test_result = subprocess.run(
            [str(exe_path), "--help"],
            capture_output=True,
            timeout=5,
            cwd=target_base_dir,
        )
        if (
            test_result.returncode == 0 or test_result.returncode == 2
        ):  # 2 is common for help commands
            print(f"✓ Executable is functional")
        else:
            print(f"⚠ Executable test returned code: {test_result.returncode}")
    except subprocess.TimeoutExpired:
        print(f"⚠ Executable test timed out (possibly waiting for input)")
    except Exception as e:
        print(f"⚠ Could not test executable: {e}")

    # Copy example workspace data
    print("\nCopying example workspace data...")
    source_workspace_dir = src_dir / "workspace"
    target_workspace_dir = target_base_dir / "_internal" / "workspace"

    if source_workspace_dir.exists():
        try:
            # Remove existing workspace directory if it exists
            if target_workspace_dir.exists():
                shutil.rmtree(target_workspace_dir, ignore_errors=True)

            # Copy the entire workspace directory
            shutil.copytree(source_workspace_dir, target_workspace_dir)
            print(f"✓ Copied example workspace: {target_workspace_dir}")

            # Count files in the workspace
            workspace_files = list(target_workspace_dir.rglob("*.xlsx"))
            workspace_configs = list(target_workspace_dir.rglob("workspace.json"))
            print(f"  - {len(workspace_configs)} example workspace(s)")
            print(f"  - {len(workspace_files)} example Excel files")

        except Exception as e:
            print(f"⚠ Failed to copy workspace data: {e}")
            print(f"  Application will still work, but without example data")
    else:
        print(f"⚠ Source workspace directory not found: {source_workspace_dir}")


if __name__ == "__main__":
    main()
