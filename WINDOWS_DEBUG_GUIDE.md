# Windows调试指南 - Tauri Excel应用

## 问题描述
在Windows平台上，应用可能出现启动后立即闪退的问题，通常是路径检测或Python后端启动失败导致的。

## 解决方案

### 第1步：准备调试工具

将以下文件复制到应用安装目录（通常是 `C:\Program Files\tauri-vite-excel\`）：
- `debug_windows_paths.py` - Python诊断脚本
- `debug_windows.bat` - Windows批处理调试脚本

### 第2步：运行诊断

1. **以管理员身份打开命令提示符**
2. **导航到应用安装目录**：
   ```cmd
   cd "C:\Program Files\tauri-vite-excel"
   ```
3. **运行调试脚本**：
   ```cmd
   debug_windows.bat
   ```

### 第3步：分析输出

调试脚本将检查：

#### ✅ 预期的成功输出示例：
```
✓ 找到backend文件: _up_\backend\excel-backend\excel-backend.exe
✓ Python可执行文件: python.exe: Python 3.x.x
✓ 当前目录写入权限正常
```

#### ❌ 问题指示器：
```
✗ 未找到预期的backend文件
✗ python.exe: 未找到
✗ 文件操作失败: 权限被拒绝
```

### 第4步：根据问题类型进行修复

#### 问题类型1：Backend文件缺失
**症状**：`✗ 未找到预期的backend文件`

**解决方案**：
1. 重新安装应用
2. 检查安装目录是否包含 `_up_\backend\excel-backend\` 结构
3. 确保安装包完整下载

#### 问题类型2：Python环境问题
**症状**：`✗ python.exe: 未找到`

**解决方案**：
1. 安装Python 3.8+：https://www.python.org/downloads/
2. 确保Python在系统PATH中
3. 重启应用

#### 问题类型3：权限问题
**症状**：`✗ 文件操作失败: 权限被拒绝`

**解决方案**：
1. 以管理员身份运行应用
2. 检查安装目录权限
3. 临时关闭杀毒软件

#### 问题类型4：路径检测失败
**症状**：应用启动但立即崩溃，无明显错误

**解决方案**：
1. 确保当前工作目录正确
2. 从应用安装目录启动
3. 检查环境变量设置

### 第5步：手动验证

如果自动诊断无法解决问题，请手动验证：

1. **检查文件结构**：
   ```cmd
   dir "_up_\backend\excel-backend\"
   ```

2. **测试backend直接运行**：
   ```cmd
   "_up_\backend\excel-backend\excel-backend.exe"
   ```

3. **检查进程**：
   ```cmd
   tasklist | findstr "tauri-excel"
   tasklist | findstr "excel-backend"
   ```

### 第6步：收集调试信息

如果问题仍然存在，请收集以下信息并反馈：

1. 调试脚本的完整输出
2. Windows版本信息：`winver`
3. 错误截图（如果有）
4. 安装方法（MSI安装包、便携版等）

## 环境变量配置

对于持续性调试，可以设置以下环境变量：

```cmd
setx RUST_LOG "info"
setx RUST_BACKTRACE "1"
```

## 常见解决方案

### 快速修复列表：
1. **重启计算机** - 解决临时路径/权限问题
2. **重新安装应用** - 修复损坏的安装
3. **以管理员身份运行** - 解决权限问题
4. **安装Python** - 解决运行时依赖问题
5. **检查杀毒软件** - 确保应用未被误杀

## 技术细节

### 应用启动流程：
1. Tauri主进程启动
2. 初始化日志系统
3. 检测Python后端路径
4. 启动Python后端进程
5. 建立心跳监控
6. 启动前端界面

### 关键路径（Windows）：
- 主程序：`tauri-excel-app.exe`
- Backend：`_up_\backend\excel-backend\excel-backend.exe`
- 资源：`_up_\backend\excel-backend\_internal\`

## 联系支持

如果以上步骤无法解决问题，请：

1. 运行 `debug_windows.bat` 收集诊断信息
2. 截图错误信息
3. 注明Windows版本和安装方式
4. 联系开发者提供技术支持

---

**注意**：此应用需要Python环境支持。如果您的系统没有安装Python，请先安装Python 3.8或更高版本。 