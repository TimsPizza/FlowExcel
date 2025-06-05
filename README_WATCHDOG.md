# Python Backend Watchdog for Tauri Excel Application

这个项目实现了一个强大的看门狗系统，确保 Python 后端和 Tauri 渲染进程同时存在和销毁。

## 架构概览

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Tauri App     │    │  Python Watchdog │    │   Python Backend   │
│                 │    │                  │    │                     │
│  ┌───────────┐  │    │  ┌─────────────┐ │    │  ┌───────────────┐  │
│  │   Main    │──┼────┼─▶│   Monitor   │─┼────┼─▶│ Excel Service │  │
│  │ Process   │  │    │  │   Thread    │ │    │  │               │  │
│  └───────────┘  │    │  └─────────────┘ │    │  └───────────────┘  │
│                 │    │                  │    │                     │
│  ┌───────────┐  │    │  ┌─────────────┐ │    │  ┌───────────────┐  │
│  │ Frontend  │  │    │  │ Auto-Restart│ │    │  │   Logging     │  │
│  │    UI     │  │    │  │   Logic     │ │    │  │   System      │  │
│  └───────────┘  │    │  └─────────────┘ │    │  └───────────────┘  │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
```

## 核心功能

### 1. 自动进程管理
- **智能检测**: 自动检测并优先使用 PyInstaller 打包的二进制文件
- **备选方案**: 如果没有二进制文件，会自动寻找 Python 脚本和解释器
- **进程监控**: 每 5 秒检查一次后端进程的健康状态
- **自动重启**: 后端进程崩溃时自动重启（最多 5 次尝试）

### 2. 生命周期绑定
- **同步启动**: Tauri 应用启动时自动启动 Python 后端
- **同步关闭**: Tauri 窗口关闭时自动终止 Python 后端
- **优雅退出**: 使用 SIGTERM 信号优雅关闭，超时后强制 SIGKILL

### 3. 多平台支持
- **Unix/Linux/macOS**: 使用 POSIX 信号进行进程控制
- **Windows**: 使用 Windows API 进行进程管理
- **跨平台路径**: 自动适配不同操作系统的路径格式

## 文件结构

```
src-tauri/
├── src/
│   ├── main.rs                 # Tauri 主程序，集成看门狗
│   └── python_watchdog.rs      # 看门狗核心实现
├── Cargo.toml                  # Rust 依赖配置
└── tauri.conf.json            # Tauri 应用配置

src-python/
├── src/app/
│   └── main.py                # Python 后端主程序
├── build_binary.py           # PyInstaller 构建脚本
└── requirements.txt          # Python 依赖

backend/                      # 生成的二进制文件目录
└── excel-backend            # PyInstaller 生成的可执行文件
```

## 使用方法

### 1. 开发模式（使用 Python 脚本）

确保 Python 虚拟环境已安装：
```bash
cd src-python
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

启动 Tauri 应用：
```bash
cd src-tauri
cargo tauri dev
```

看门狗会自动：
1. 检测 `../src-python/.venv/bin/python` 路径
2. 启动 `../src-python/src/app/main.py` 脚本
3. 开始监控后端进程健康状态

### 2. 生产模式（使用二进制文件）

构建 Python 后端二进制：
```bash
cd src-python
python build_binary.py
```

这会在 `backend/` 目录生成 `excel-backend` 可执行文件。

构建 Tauri 应用：
```bash
cd src-tauri
cargo tauri build
```

看门狗会自动：
1. 检测并优先使用 `backend/excel-backend` 二进制文件
2. 启动二进制而不是 Python 脚本
3. 提供更快的启动速度和更小的依赖

## 配置选项

### 看门狗配置

在 `python_watchdog.rs` 中可以调整以下参数：

```rust
// 检查间隔（秒）
let mut interval = interval(Duration::from_secs(5));

// 最大重启尝试次数
max_restart_attempts: 5,

// 进程终止超时时间（秒）
Duration::from_secs(5)
```

### 二进制文件检测路径

看门狗会按顺序检查以下路径：

1. `backend/excel-backend`
2. `backend/excel-backend.exe`
3. `../backend/excel-backend`
4. `../backend/excel-backend.exe`
5. `./excel-backend`
6. `./excel-backend.exe`

### Python 脚本检测路径

如果没有找到二进制文件，会检查：

1. `../src-python/src/app/main.py`
2. `../src-python/main.py`
3. `python/main.py`
4. `backend/main.py`

### Python 解释器检测顺序

1. `../src-python/.venv/bin/python`
2. `../src-python/.venv/Scripts/python.exe`
3. `.venv/bin/python`
4. `.venv/Scripts/python.exe`
5. 系统 `python3`
6. 系统 `python`

## 日志和调试

### Tauri 日志

Tauri 应用会输出详细的看门狗日志：

```
[INFO] Starting Python backend watchdog
[INFO] Found Python backend binary: "backend/excel-backend"
[INFO] Python backend started with PID: 12345
[INFO] Tauri application started with Python backend watchdog
```

### Python 后端日志

Python 后端会输出运行状态：

```
2024-01-01 12:00:00 - __main__ - INFO - Starting Excel backend application
2024-01-01 12:00:00 - __main__ - INFO - Excel backend service started
2024-01-01 12:00:30 - __main__ - INFO - Backend service is running...
```

### 进程监控日志

当后端进程出现问题时：

```
[WARN] Python backend process has exited
[WARN] Python backend died, attempting restart...
[INFO] Attempting to restart Python backend (attempt 1/5)
[INFO] Python backend started with PID: 12346
```

## 高级特性

### 1. 健康检查

看门狗不仅检查进程是否存在，还会：
- 监控进程退出状态
- 检测僵尸进程
- 处理进程启动失败

### 2. 资源清理

确保所有资源得到正确清理：
- 子进程的 stdin/stdout/stderr 流
- 进程句柄和线程
- 内存和文件描述符

### 3. 错误恢复

提供多层错误恢复机制：
- 进程崩溃自动重启
- 重启失败时的退避策略
- 超过最大重试次数时的优雅降级

## 故障排除

### 常见问题

1. **找不到 Python 解释器**
   ```
   Error: No Python executable found
   ```
   解决方案：确保虚拟环境已创建并激活，或者系统安装了 Python

2. **找不到后端文件**
   ```
   Error: No Python backend found (neither binary nor script)
   ```
   解决方案：确保 `main.py` 存在或已构建二进制文件

3. **进程启动失败**
   ```
   Error: Failed to start Python backend: permission denied
   ```
   解决方案：检查文件权限，确保二进制文件可执行

4. **重启失败**
   ```
   Error: Maximum restart attempts (5) exceeded
   ```
   解决方案：检查 Python 后端代码是否有持续性错误

### 调试模式

启用详细日志：

```bash
RUST_LOG=debug cargo tauri dev
```

这会显示更详细的进程管理信息。

## 最佳实践

1. **生产环境使用二进制文件**：PyInstaller 打包的二进制文件启动更快，依赖更少

2. **优雅处理信号**：Python 后端应正确处理 SIGTERM 信号

3. **日志管理**：适当配置日志级别，避免在生产环境输出过多调试信息

4. **资源监控**：监控内存和 CPU 使用情况，确保后端性能稳定

5. **版本同步**：确保 Tauri 和 Python 后端版本兼容

## 未来扩展

- [ ] 健康检查 HTTP 端点
- [ ] 配置文件支持
- [ ] 性能指标收集
- [ ] 集群模式支持
- [ ] 服务发现机制

这个看门狗系统为 Tauri Excel 应用提供了强大、可靠的后端进程管理能力，确保用户获得稳定的使用体验。 