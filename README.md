# OpenClaw Uninstaller

`OpenClaw Uninstaller` 是一个面向 Windows 的本地卸载工具，用于扫描、备份、卸载并校验 OpenClaw 安装残留。

## 主要功能

- 扫描 OpenClaw 常见安装目录、缓存目录、全局命令包装文件、桌面和开始菜单快捷方式
- 检测相关运行进程、Windows 服务和计划任务
- 卸载前可选备份目标文件到 `dist/openclaw-backups`
- 卸载后执行校验，确认是否仍有残留
- 导出 JSON 和 Markdown 卸载报告到 `dist/reports`
- 通过本地 Web GUI 操作，支持确认弹窗和日志展示

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

构建完成后会得到：

```text
dist/openclaw-uninstaller.exe
dist/webui/
```

GitHub Actions 还会额外生成：

```text
dist/openclaw-uninstaller-win-x64.zip
```

这个压缩包包含 `.exe` 和运行所需的 `webui` 静态资源，适合作为 Release 附件直接分发。

## 发布流程

仓库内置了 GitHub Actions 工作流：

- `workflow_dispatch`：手动触发构建
- 推送 `v*` 标签：自动构建并发布 GitHub Release

示例：

```bash
git tag v0.3.3
git push origin v0.3.3
```

## 主要文件

- `src/openclaw-uninstaller.mjs`：扫描、备份、删除、校验、报告导出逻辑
- `src/webui-server.mjs`：本地 HTTP 服务和 API
- `webui/openclaw-uninstaller.html`：GUI 页面
- `webui/openclaw-uninstaller.js`：前端交互逻辑
- `scripts/build-exe.mjs`：Windows `.exe` 构建脚本
- `.github/workflows/build-release.yml`：GitHub Actions 发布流程

## 注意事项

- 卸载会删除 OpenClaw 相关目录、全局命令入口、计划任务和快捷方式
- 建议保留默认的“先备份再卸载”
- 如果你的 OpenClaw 使用了自定义安装目录，需要继续补充扫描规则
