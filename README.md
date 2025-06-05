# Tauri Excel - 跨平台 Excel 数据处理应用

一个基于 Tauri + React + Python 的现代化 Excel 数据处理应用，具备强大的后端进程管理和自动化流水线功能。

## 🚀 核心特性

- **🔄 智能看门狗系统**: 自动管理 Python 后端进程生命周期
- **📊 Excel 数据处理**: 强大的 Excel 文件读取、分析和处理能力  
- **🔧 可视化流水线**: 拖拽式数据处理流程构建
- **📱 跨平台支持**: Windows、macOS、Linux 一体化体验
- **⚡ 高性能**: Python 后端 + Rust 前端的性能组合
- **🔒 离线优先**: 本地数据处理，保护隐私安全

## 🏗️ 架构设计

```
┌─────────────────────────────┐
│        Tauri Frontend       │
│     (React + TypeScript)    │
├─────────────────────────────┤
│      Python Watchdog       │
│     (Rust 进程管理器)        │
├─────────────────────────────┤
│       Python Backend       │
│    (FastAPI + Pandas)      │
└─────────────────────────────┘
```

### 技术栈

**前端**:
- 🦀 **Tauri**: 轻量级桌面应用框架
- ⚛️ **React 18**: 现代化 UI 库
- 📘 **TypeScript**: 类型安全的 JavaScript
- ⚡ **Vite**: 快速构建工具
- 🎨 **Tailwind CSS**: 实用优先的 CSS 框架

**后端**:
- 🐍 **Python**: 数据处理核心语言
- 🚀 **FastAPI**: 高性能 Web 框架
- 🐼 **Pandas**: 数据分析库
- 📊 **Openpyxl**: Excel 文件处理

**进程管理**:
- 🦀 **Rust**: 高性能看门狗系统
- 🔧 **Tokio**: 异步运行时
- 📦 **PyInstaller**: Python 二进制打包

## 🛠️ 安装和运行

### 前置要求

- **Node.js** >= 18.0.0
- **Rust** >= 1.77.2  
- **Python** >= 3.8
- **pnpm** (推荐) 或 npm

### 快速开始

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd tauri-excel
   ```

2. **安装前端依赖**
   ```bash
   pnpm install
   ```

3. **设置 Python 环境**
   ```bash
   cd src-python
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. **启动开发环境**
   ```bash
   cd src-tauri
   cargo tauri dev
   ```

### 生产构建

1. **构建 Python 后端二进制**
   ```bash
   cd src-python
   python build_binary.py
   ```

2. **构建 Tauri 应用**
   ```bash
   cd src-tauri
   cargo tauri build
   ```

## 🔧 Python 后端看门狗系统

我们实现了一个强大的看门狗系统来管理 Python 后端进程的生命周期。

### 核心功能

- ✅ **自动进程检测**: 智能检测 PyInstaller 二进制文件或 Python 脚本
- ✅ **健康监控**: 每 5 秒检查后端进程状态
- ✅ **自动重启**: 进程崩溃时自动重启（最多 5 次尝试）
- ✅ **优雅退出**: 正确处理 SIGTERM/SIGKILL 信号
- ✅ **跨平台兼容**: 支持 Windows/macOS/Linux

### 详细文档

查看 [README_WATCHDOG.md](./README_WATCHDOG.md) 了解看门狗系统的详细实现和配置。

## 📁 项目结构

```
tauri-excel/
├── src/                          # React 前端源码
│   ├── components/               # React 组件
│   ├── hooks/                    # 自定义 hooks
│   ├── pages/                    # 页面组件
│   └── stores/                   # 状态管理
├── src-tauri/                    # Tauri 应用
│   ├── src/
│   │   ├── main.rs              # 主程序入口
│   │   └── python_watchdog.rs   # 看门狗系统
│   └── Cargo.toml               # Rust 依赖
├── src-python/                   # Python 后端
│   ├── src/app/                 # FastAPI 应用
│   ├── src/excel/               # Excel 处理模块
│   ├── src/pipeline/            # 数据流水线
│   └── build_binary.py          # 二进制构建脚本
├── backend/                      # 生成的二进制文件
└── README_WATCHDOG.md           # 看门狗系统文档
```

## 🚦 开发工作流

### 开发模式
```bash
# 启动前端开发服务器
pnpm dev

# 启动 Tauri 开发环境（自动启动 Python 后端）
cd src-tauri && cargo tauri dev
```

### 测试 Python 后端
```bash
cd src-python
python src/app/main.py
```

### 构建二进制文件
```bash
cd src-python
python build_binary.py
```

## 🐛 故障排除

### 常见问题

1. **Python 后端启动失败**
   - 检查虚拟环境是否正确设置
   - 确认 `main.py` 文件路径正确
   - 查看 Tauri 控制台日志

2. **看门狗无法检测到进程**
   - 确认 Python 解释器路径
   - 检查文件权限
   - 启用调试模式：`RUST_LOG=debug cargo tauri dev`

3. **二进制文件构建失败**
   - 确保 PyInstaller 已安装
   - 检查 Python 依赖是否完整

## 🤝 贡献指南

1. Fork 这个项目
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Tauri](https://tauri.app/) - 现代化桌面应用框架
- [React](https://reactjs.org/) - 用户界面库
- [FastAPI](https://fastapi.tiangolo.com/) - 现代 Python Web 框架
- [Pandas](https://pandas.pydata.org/) - 数据分析库

---

## 💡 ESLint 配置说明

这个模板提供了 React + Vite 的最小化设置，包含 HMR 和一些 ESLint 规则。

当前可用的官方插件：

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) 使用 [Babel](https://babeljs.io/) 进行 Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) 使用 [SWC](https://swc.rs/) 进行 Fast Refresh

### 扩展 ESLint 配置

如果你正在开发生产应用，我们建议更新配置以启用类型感知的 lint 规则：

- 配置顶级 `parserOptions` 属性：

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- 将 `tseslint.configs.recommended` 替换为 `tseslint.configs.recommendedTypeChecked` 或 `tseslint.configs.strictTypeChecked`
- 可选地添加 `...tseslint.configs.stylisticTypeChecked`
