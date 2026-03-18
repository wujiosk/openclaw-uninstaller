import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const home = os.homedir();
const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
const nodeDir = process.execPath ? path.dirname(process.execPath) : "C:\\nvm4w\\nodejs";

function timestamp() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ];
  return parts.join("");
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function statSize(targetPath) {
  try {
    const stats = await fs.stat(targetPath);
    return stats.size;
  } catch {
    return 0;
  }
}

async function collectSize(targetPath) {
  try {
    const stats = await fs.stat(targetPath);
    if (stats.isFile()) {
      return stats.size;
    }
    if (stats.isDirectory()) {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      let total = 0;
      for (const entry of entries) {
        total += await collectSize(path.join(targetPath, entry.name));
      }
      return total;
    }
    return 0;
  } catch {
    return 0;
  }
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function buildTargets() {
  return [
    {
      id: "user-config",
      label: "用户数据目录",
      kind: "dir",
      path: path.join(home, ".openclaw"),
      critical: true
    },
    {
      id: "install-script",
      label: "安装脚本",
      kind: "file",
      path: path.join(home, "openclaw-install.ps1")
    },
    {
      id: "updater-cache",
      label: "Electron 更新缓存",
      kind: "dir",
      path: path.join(localAppData, "@guanjia-openclawelectron-updater")
    },
    {
      id: "global-wrapper-sh",
      label: "全局命令包装文件",
      kind: "file",
      path: path.join(nodeDir, "openclaw")
    },
    {
      id: "global-wrapper-cmd",
      label: "全局命令 CMD 入口",
      kind: "file",
      path: path.join(nodeDir, "openclaw.cmd")
    },
    {
      id: "global-wrapper-ps1",
      label: "全局命令 PowerShell 入口",
      kind: "file",
      path: path.join(nodeDir, "openclaw.ps1")
    },
    {
      id: "global-wrapper-cn-sh",
      label: "全局命令 CN 包装文件",
      kind: "file",
      path: path.join(nodeDir, "openclaw-cn")
    },
    {
      id: "global-wrapper-cn-cmd",
      label: "全局命令 CN CMD 入口",
      kind: "file",
      path: path.join(nodeDir, "openclaw-cn.cmd")
    },
    {
      id: "global-wrapper-cn-ps1",
      label: "全局命令 CN PowerShell 入口",
      kind: "file",
      path: path.join(nodeDir, "openclaw-cn.ps1")
    },
    {
      id: "global-module-openclaw",
      label: "全局 Node 模块 openclaw",
      kind: "dir",
      path: path.join(nodeDir, "node_modules", "openclaw")
    },
    {
      id: "global-module-openclaw-cn",
      label: "全局 Node 模块 openclaw-cn",
      kind: "dir",
      path: path.join(nodeDir, "node_modules", "openclaw-cn")
    },
    {
      id: "roaming-openclaw",
      label: "Roaming 目录痕迹",
      kind: "dir",
      path: path.join(appData, "openclaw")
    }
  ];
}

export async function scanOpenClawInstallation() {
  const targets = buildTargets();
  const items = [];

  for (const target of targets) {
    const present = await exists(target.path);
    const bytes = present ? await collectSize(target.path) : 0;
    items.push({
      ...target,
      present,
      sizeBytes: bytes,
      sizeLabel: formatBytes(bytes)
    });
  }

  const summary = {
    found: items.filter((item) => item.present).length,
    totalBytes: items.reduce((sum, item) => sum + item.sizeBytes, 0),
    totalLabel: formatBytes(items.reduce((sum, item) => sum + item.sizeBytes, 0))
  };

  return { items, summary };
}

function runPowerShell(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell", ["-NoProfile", "-Command", command], {
      cwd,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `PowerShell exited ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function backupItems(items, backupDir) {
  await fs.mkdir(backupDir, { recursive: true });
  const copied = [];

  for (const item of items) {
    if (!item.present) {
      continue;
    }

    const safeName = item.id.replace(/[^\w.-]+/g, "_");
    const destination = path.join(backupDir, safeName);
    await fs.cp(item.path, destination, { recursive: true, force: true });
    copied.push({ from: item.path, to: destination });
  }

  return copied;
}

async function removeItem(item) {
  if (!(await exists(item.path))) {
    return false;
  }

  await fs.rm(item.path, { recursive: true, force: true });
  return true;
}

export async function uninstallOpenClaw(options = {}) {
  const { backup = true, cwd = process.cwd() } = options;
  const scan = await scanOpenClawInstallation();
  const presentItems = scan.items.filter((item) => item.present);
  const logs = [];

  if (presentItems.length === 0) {
    logs.push("未发现 OpenClaw 安装痕迹。");
    return { ok: true, logs, backupDir: null, removed: [] };
  }

  let backupDir = null;
  if (backup) {
    backupDir = path.join(cwd, "dist", "openclaw-backups", `backup-${timestamp()}`);
    logs.push(`开始备份到 ${backupDir}`);
    const copied = await backupItems(presentItems, backupDir);
    logs.push(`备份完成，共 ${copied.length} 项。`);
  }

  const removed = [];
  for (const item of presentItems) {
    try {
      const done = await removeItem(item);
      logs.push(done ? `已删除：${item.path}` : `跳过：${item.path}`);
      if (done) {
        removed.push(item.path);
      }
    } catch (error) {
      logs.push(`删除失败：${item.path} - ${error.message}`);
    }
  }

  try {
    await runPowerShell("Get-Command openclaw -ErrorAction SilentlyContinue | Out-Null", cwd);
    logs.push("命令缓存刷新检查完成。");
  } catch {
    logs.push("命令缓存检查跳过。");
  }

  return {
    ok: true,
    logs,
    backupDir,
    removed
  };
}
