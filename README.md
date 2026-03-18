# OpenClaw Uninstaller

面向 Windows 的本地卸载工具，用来扫描、备份、移除并校验 OpenClaw 安装残留。

## 功能

- 扫描常见安装目录、缓存目录、快捷方式和全局命令入口
- 检测关联进程、Windows 服务和计划任务
- 卸载前可选备份到 `dist/openclaw-backups`
- 卸载后执行残留校验
- 导出 JSON 和 Markdown 报告到 `dist/reports`
- 提供本地 Web GUI，适合直接打包成 `.exe`

## 本地开发

```bash
npm install
npm run dev
```

打开 [http://127.0.0.1:32123/openclaw-uninstaller.html](http://127.0.0.1:32123/openclaw-uninstaller.html)

## 构建 Windows 可执行文件

```bash
npm install
npm run build:exe
```

构建产物：

```text
dist/openclaw-uninstaller.exe
dist/webui/
```

如果需要直接分发，建议使用 Release 里的压缩包：

```text
openclaw-uninstaller-win-x64.zip
```

## 项目结构

```text
src/
  config.mjs
  index.mjs
  openclaw-uninstaller.mjs
  webui-server.mjs
  uninstaller/
    report.mjs
    shared.mjs
    system.mjs
    targets.mjs
webui/
  openclaw-uninstaller.html
  openclaw-uninstaller.css
  openclaw-uninstaller.js
scripts/
  build-exe.mjs
```

## 发布

仓库内置 GitHub Actions：

- 手动触发 `workflow_dispatch`
- 推送 `v*` 标签自动构建并创建 Release

示例：

```bash
git tag v0.4.0
git push origin v0.4.0
```

## 注意

- 卸载会删除 OpenClaw 相关目录、缓存、快捷方式和全局命令入口
- 如果你的 OpenClaw 使用了自定义安装目录，需要继续补充扫描规则
- 目前扫描规则以 Windows 环境为主
