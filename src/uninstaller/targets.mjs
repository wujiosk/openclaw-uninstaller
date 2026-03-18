import path from "node:path";
import {
  homeDir,
  localAppDataDir,
  roamingAppDataDir,
  desktopDir,
  startMenuProgramsDir,
  nodeInstallDir
} from "../config.mjs";

export function getOpenClawTargets() {
  return [
    {
      id: "user-config",
      label: "用户数据目录",
      kind: "dir",
      path: path.join(homeDir, ".openclaw"),
      critical: true
    },
    {
      id: "install-script",
      label: "安装脚本",
      kind: "file",
      path: path.join(homeDir, "openclaw-install.ps1")
    },
    {
      id: "updater-cache",
      label: "Electron 更新缓存",
      kind: "dir",
      path: path.join(localAppDataDir, "@guanjia-openclawelectron-updater")
    },
    {
      id: "programs-openclaw",
      label: "应用安装目录",
      kind: "dir",
      path: path.join(localAppDataDir, "Programs", "openclaw")
    },
    {
      id: "programs-openclaw-cn",
      label: "应用安装目录（CN）",
      kind: "dir",
      path: path.join(localAppDataDir, "Programs", "openclaw-cn")
    },
    {
      id: "desktop-shortcut",
      label: "桌面快捷方式",
      kind: "file",
      path: path.join(desktopDir, "OpenClaw.lnk")
    },
    {
      id: "startmenu-shortcut",
      label: "开始菜单快捷方式",
      kind: "file",
      path: path.join(startMenuProgramsDir, "OpenClaw.lnk")
    },
    {
      id: "startmenu-folder",
      label: "开始菜单程序组",
      kind: "dir",
      path: path.join(startMenuProgramsDir, "OpenClaw")
    },
    {
      id: "global-wrapper-sh",
      label: "全局命令包装文件",
      kind: "file",
      path: path.join(nodeInstallDir, "openclaw")
    },
    {
      id: "global-wrapper-cmd",
      label: "全局命令 CMD 入口",
      kind: "file",
      path: path.join(nodeInstallDir, "openclaw.cmd")
    },
    {
      id: "global-wrapper-ps1",
      label: "全局命令 PowerShell 入口",
      kind: "file",
      path: path.join(nodeInstallDir, "openclaw.ps1")
    },
    {
      id: "global-wrapper-cn-sh",
      label: "全局命令包装文件（CN）",
      kind: "file",
      path: path.join(nodeInstallDir, "openclaw-cn")
    },
    {
      id: "global-wrapper-cn-cmd",
      label: "全局命令 CMD 入口（CN）",
      kind: "file",
      path: path.join(nodeInstallDir, "openclaw-cn.cmd")
    },
    {
      id: "global-wrapper-cn-ps1",
      label: "全局命令 PowerShell 入口（CN）",
      kind: "file",
      path: path.join(nodeInstallDir, "openclaw-cn.ps1")
    },
    {
      id: "global-module-openclaw",
      label: "全局 Node 模块",
      kind: "dir",
      path: path.join(nodeInstallDir, "node_modules", "openclaw")
    },
    {
      id: "global-module-openclaw-cn",
      label: "全局 Node 模块（CN）",
      kind: "dir",
      path: path.join(nodeInstallDir, "node_modules", "openclaw-cn")
    },
    {
      id: "roaming-openclaw",
      label: "Roaming 配置残留",
      kind: "dir",
      path: path.join(roamingAppDataDir, "openclaw")
    }
  ];
}
