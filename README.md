# OpenClaw Uninstaller

`OpenClaw Uninstaller` 是一个本地 Windows GUI 工具，用于扫描、备份并卸载 OpenClaw。

## 功能

- 扫描 OpenClaw 安装痕迹
- 统计每项路径和体积
- 卸载前可选备份
- 删除用户目录、缓存目录和全局命令包装文件
- 输出完整卸载日志
- 通过本地 Web GUI 操作

## 本地启动

```bash
npm install
npm run start:uninstaller
```

打开：

```text
http://127.0.0.1:32123/openclaw-uninstaller.html
```

## 打包 exe

```bash
npm install
npm run build:exe
```

产物位于：

```text
dist\claw.exe
```

## 主要文件

- GUI 页面: `webui/openclaw-uninstaller.html`
- 前端逻辑: `webui/openclaw-uninstaller.js`
- 服务端接口: `src/webui-server.mjs`
- 卸载核心逻辑: `src/openclaw-uninstaller.mjs`
- 构建脚本: `scripts/build-exe.mjs`

## GitHub 发布

仓库已包含 GitHub Actions 工作流：

- 手动触发可构建 Windows 可执行文件
- 推送 `v*` 标签时自动构建并上传 Release 附件

## 注意

- 该工具会删除 OpenClaw 相关目录和全局命令包装文件
- 建议保留默认“先备份再卸载”
- 如果你的 OpenClaw 安装路径和当前扫描规则不同，需要补充扫描规则
