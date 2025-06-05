@echo off
chcp 65001 >nul
echo ===========================================
echo Windows调试脚本 - Tauri Excel应用
echo ===========================================
echo.

echo 当前目录: %CD%
echo 用户: %USERNAME%
echo 系统: %OS%
echo.

echo 设置调试环境变量...
set RUST_LOG=info
set RUST_BACKTRACE=1

echo.
echo 检查文件是否存在...
if exist "debug_windows_paths.py" (
    echo ✓ 找到Python调试脚本
    echo 运行Python诊断工具...
    echo.
    python debug_windows_paths.py
) else (
    echo ✗ 未找到debug_windows_paths.py，请确保该文件在当前目录
)

echo.
echo 检查tauri-excel-app.exe是否存在...
if exist "tauri-excel-app.exe" (
    echo ✓ 找到应用程序
    echo.
    echo 尝试运行应用（5秒后自动关闭）...
    timeout /t 2 /nobreak >nul
    start /wait /min tauri-excel-app.exe
    echo 应用已启动，请检查是否正常运行
) else (
    echo ✗ 未找到tauri-excel-app.exe
    echo 请确保您在正确的目录下运行此脚本
)

echo.
echo 检查backend文件...
if exist "_up_\backend\excel-backend\excel-backend.exe" (
    echo ✓ 找到backend文件: _up_\backend\excel-backend\excel-backend.exe
    dir "_up_\backend\excel-backend\excel-backend.exe"
) else (
    echo ✗ 未找到预期的backend文件
)

echo.
echo 列出当前目录结构...
dir /s /b | head -20

echo.
echo ===========================================
echo 调试完成！请将输出结果发送给开发者
echo ===========================================
pause 