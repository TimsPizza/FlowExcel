# 🚀 FlowExcel 部署和发布指南

本文档详细说明了 FlowExcel 项目的 CI/CD 流程和发布步骤。

## 📋 目录

- [CI/CD 工作流概述](#cicd-工作流概述)
- [开发环境 CI](#开发环境-ci)
- [多平台构建和发布](#多平台构建和发布)
- [发布流程](#发布流程)
- [平台支持](#平台支持)
- [常见问题](#常见问题)

## 🔄 CI/CD 工作流概述

我们的项目使用 GitHub Actions 实现完整的 CI/CD 流程，包含两个主要工作流：

### 1. 持续集成 (CI) - `.github/workflows/ci.yml`
- **触发条件**: 推送到 `main` 或 `develop` 分支，Pull Request
- **功能**: 
  - 前端代码检查 (ESLint, TypeScript)
  - 后端测试和覆盖率报告
  - 快速构建测试 (仅 Linux)
  - 安全审计

### 2. 构建和发布 - `.github/workflows/build-and-release.yml`
- **触发条件**: 
  - 推送版本标签 (`v*.*.*`)
  - 手动触发 (workflow_dispatch)
  - Pull Request (仅质量检查)
- **功能**:
  - 多平台构建 (Windows, macOS, Linux)
  - 自动发布到 GitHub Releases
  - 构建产物上传

## 🔍 开发环境 CI

### 自动触发的检查

每次推送代码或创建 PR 时，会自动运行以下检查：

```bash
# 前端检查
✅ ESLint 代码风格检查
✅ TypeScript 类型检查
✅ 前端构建测试

# 后端检查  
✅ Python 代码测试
✅ 测试覆盖率报告
✅ 测试结果上传

# 构建测试
✅ 完整构建流程测试 (Linux)

# 安全检查
✅ Rust 依赖安全审计
✅ Node.js 依赖安全审计
```

### 本地测试

在提交代码前，建议运行本地测试：

```bash
# 前端测试
pnpm lint
pnpm build:frontend

# 后端测试
cd src-python
uv sync --dev
uv run python src/test/run_all_tests.py

# 完整构建测试
pnpm build:backend
pnpm build:frontend
```

## 🏗️ 多平台构建和发布

### 支持的平台

我们支持以下平台的自动构建：

| 平台 | 架构 | Runner | 状态 |
|------|------|--------|------|
| Windows | x64 | `windows-latest` | ✅ 已测试 |
| macOS | Apple Silicon (ARM64) | `macos-14` | ✅ 已测试 |
| Linux | x64 | `ubuntu-20.04` | ⚠️ 未物理测试 |

### 构建流程

每个平台的构建流程包含：

1. **环境准备**
   - Node.js 20 + pnpm
   - Python 3.11 + uv
   - Rust 工具链
   - 平台特定依赖

2. **依赖安装**
   ```bash
   pnpm install              # 前端依赖
   uv sync                   # Python 依赖
   ```

3. **构建步骤**
   ```bash
   uv run python build_binary.py  # 构建 Python 后端
   pnpm build:frontend            # 构建前端
   tauri build                    # 构建 Tauri 应用
   ```

4. **产物生成**
   - Windows: `.exe` 安装程序和便携版
   - macOS: `.dmg` 磁盘镜像和 `.app` 应用包
   - Linux: `.deb` 和 `.AppImage` 格式

## 🎯 发布流程

### 方式一: 使用发布脚本 (推荐)

我们提供了自动化发布脚本：

```bash
# 创建草稿发布 (默认)
node scripts/release.js 1.0.0

# 创建预发布版本
node scripts/release.js 1.0.0-beta.1 prerelease

# 创建正式发布
node scripts/release.js 1.0.0 release
```

脚本会自动：
- ✅ 检查 Git 状态
- ✅ 更新所有配置文件中的版本号
- ✅ 提交版本更改
- ✅ 创建版本标签
- ✅ 推送到远程仓库
- ✅ 触发 GitHub Actions 构建

### 方式二: 手动发布

1. **更新版本号**
   ```bash
   # 手动更新以下文件中的版本号：
   - package.json
   - src-tauri/tauri.conf.json  
   - src-tauri/Cargo.toml
   - src-python/pyproject.toml
   ```

2. **提交并创建标签**
   ```bash
   git add .
   git commit -m "chore: bump version to v1.0.0"
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin main
   git push origin v1.0.0
   ```

3. **监控构建**
   - 访问 GitHub Actions 页面查看构建状态
   - 构建完成后，发布将自动创建在 GitHub Releases

### 方式三: 手动触发

在 GitHub Actions 页面手动触发 "Build and Release" 工作流：

1. 访问 `Actions` → `Build and Release`
2. 点击 `Run workflow`
3. 选择分支和发布类型
4. 点击 `Run workflow`

## 📦 发布配置

### 发布类型

- **Draft**: 草稿发布，不公开，用于内部测试
- **Prerelease**: 预发布版本，标记为预发布
- **Release**: 正式发布版本

### 发布内容

每次发布包含：

```
📦 FlowExcel v1.0.0 发布

### 📦 支持平台
- Windows x64
- macOS Apple Silicon (ARM64)  
- Linux x64

### 📋 更新内容
[自动生成的更新日志]

### 📁 包含文件
- flowexcel_windows-x64.exe
- flowexcel_macos-arm64.dmg
- flowexcel_linux-x64.deb
- flowexcel_linux-x64.AppImage
```

## 🔧 环境变量和 Secrets

### 必需的 Secrets

在 GitHub 仓库设置中配置：

| Secret | 描述 | 必需 |
|--------|------|------|
| `GITHUB_TOKEN` | GitHub 自动提供，用于发布 | ✅ |

### 可选的 Secrets

| Secret | 描述 | 用途 |
|--------|------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | macOS 代码签名私钥 | macOS 签名 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 私钥密码 | macOS 签名 |

## 🐛 常见问题

### Q: 构建失败怎么办？

1. **检查日志**: 查看 GitHub Actions 的详细日志
2. **本地复现**: 在对应平台本地运行构建命令
3. **依赖问题**: 检查是否有依赖版本冲突
4. **重试构建**: 有时网络问题会导致临时失败

### Q: 发布后没有看到文件？

- 确保标签格式正确 (`v1.0.0`)
- 检查构建是否全部成功
- 查看 GitHub Actions 日志中的错误

### Q: 如何添加新平台支持？

在 `.github/workflows/build-and-release.yml` 中的 `matrix` 部分添加新配置：

```yaml
- platform: platform-name
  os: runner-name
  rust_target: rust-target-triple
```

### Q: 如何自定义发布说明？

修改 `.github/workflows/build-and-release.yml` 中的 `releaseBody` 部分。

### Q: 本地如何测试 CI 工作流？

使用 [act](https://github.com/nektos/act) 工具：

```bash
# 安装 act
brew install act  # macOS
# 或 choco install act  # Windows

# 运行 CI 工作流
act pull_request
```

## 📞 技术支持

如遇到构建或发布问题，请：

1. 查看 [GitHub Issues](https://github.com/YOUR_USERNAME/FlowExcel/issues)
2. 检查 [GitHub Actions 日志](https://github.com/YOUR_USERNAME/FlowExcel/actions)
3. 提交新的 Issue 并附上详细的错误信息

---

## 🔄 工作流文件说明

### CI 工作流特点
- ⚡ 快速反馈 (< 10 分钟)
- 🔄 并行执行多个检查
- 📊 生成测试覆盖率报告
- 🔒 安全审计

### 发布工作流特点  
- 🌍 多平台并行构建
- 📦 自动打包和上传
- 🏷️ 自动生成发布说明
- 🔄 支持草稿和预发布 