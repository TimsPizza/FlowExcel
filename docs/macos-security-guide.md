# macOS 安全指南

## 问题描述

在macOS上首次运行FlowExcel时，您可能会遇到以下错误之一：
- "FlowExcel" is damaged and can't be opened. You should move it to the Trash.
- "FlowExcel" cannot be opened because the developer cannot be verified.

这是因为macOS的Gatekeeper安全机制阻止了未经苹果公证的应用程序运行。

## 解决方案

### 方法1：使用终端命令（推荐）

1. 打开终端（Terminal）
2. 导航到应用程序所在目录：
   ```bash
   cd /Applications
   ```
3. 移除隔离属性：
   ```bash
   sudo xattr -cr FlowExcel.app
   ```
4. 输入您的密码（如果需要）
5. 现在可以正常双击运行应用程序

### 方法2：通过系统设置

1. 尝试打开应用程序
2. 当出现安全警告时，点击"取消"
3. 前往 `系统偏好设置` → `安全与隐私` → `通用`
4. 您会看到关于FlowExcel的警告信息
5. 点击"仍要打开"按钮
6. 在弹出的确认对话框中，点击"打开"

### 方法3：右键打开

1. 在Finder中找到FlowExcel.app
2. 右键点击应用程序
3. 选择"打开"
4. 在弹出的警告中点击"打开"

## 为什么会出现这个问题？

- macOS要求应用程序必须由已认证的开发者签名
- 开源项目通常没有付费的Apple Developer账户来进行正式签名
- 我们使用的是ad-hoc签名，这是安全的但不被苹果官方认可

## 安全性说明

FlowExcel是开源软件，您可以：
- 查看完整的源代码：[GitHub仓库](https://github.com/TimsPizza/FlowExcel)
- 验证构建过程是透明的
- 检查没有恶意代码

## 常见问题

**Q: 这样做安全吗？**
A: 是的，这只是绕过了苹果的签名检查。FlowExcel是开源软件，您可以查看所有代码。

**Q: 每次更新都需要重新操作吗？**
A: 是的，每次下载新版本都需要重新执行上述步骤。

**Q: 有没有一劳永逸的解决方案？**
A: 目前没有。除非项目获得苹果官方的代码签名和公证，否则每次更新都需要重新操作。

## 需要帮助？

如果您在使用过程中遇到问题，请：
1. 查看 [FAQ](../README.md#faq)
2. 在 [GitHub Issues](https://github.com/TimsPizza/FlowExcel/issues) 中搜索相关问题
3. 提交新的Issue并详细描述问题 