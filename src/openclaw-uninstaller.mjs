import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const home = os.homedir();
const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
const desktopDir = path.join(home, "Desktop");
const startMenuProgramsDir = path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs");
const nodeDir = process.execPath ? path.dirname(process.execPath) : "C:\\nvm4w\\nodejs";

function timestamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
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
      id: "programs-openclaw",
      label: "LocalAppData Programs 安装目录",
      kind: "dir",
      path: path.join(localAppData, "Programs", "openclaw")
    },
    {
      id: "programs-openclaw-cn",
      label: "LocalAppData Programs CN 安装目录",
      kind: "dir",
      path: path.join(localAppData, "Programs", "openclaw-cn")
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
      label: "开始菜单程序目录",
      kind: "dir",
      path: path.join(startMenuProgramsDir, "OpenClaw")
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

async function collectRuntimeSignals() {
  const [processes, services, tasks] = await Promise.all([
    runPowerShellJson("Get-Process | Where-Object { $_.ProcessName -like '*openclaw*' -or $_.Path -like '*openclaw*' } | Select-Object ProcessName,Id,Path"),
    runPowerShellJson("Get-Service | Where-Object { $_.Name -like '*openclaw*' -or $_.DisplayName -like '*openclaw*' } | Select-Object Name,DisplayName,Status"),
    runPowerShellJson("Get-ScheduledTask | Where-Object { $_.TaskName -like '*openclaw*' -or $_.TaskPath -like '*openclaw*' } | Select-Object TaskName,TaskPath,State")
  ]);

  return { processes, services, tasks };
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

async function runPowerShellJson(command) {
  try {
    const output = await runPowerShell(`${command} | ConvertTo-Json -Depth 5`, process.cwd());
    if (!output) {
      return [];
    }
    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
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

  const runtime = await collectRuntimeSignals();
  const totalBytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);

  return {
    items,
    summary: {
      found: items.filter((item) => item.present).length,
      totalBytes,
      totalLabel: formatBytes(totalBytes),
      runningProcesses: runtime.processes.length,
      services: runtime.services.length,
      scheduledTasks: runtime.tasks.length
    },
    runtime
  };
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

export async function verifyOpenClawRemoval() {
  const rescan = await scanOpenClawInstallation();
  return {
    ok: rescan.summary.found === 0,
    remainingItems: rescan.items.filter((item) => item.present),
    summary: rescan.summary,
    runtime: rescan.runtime
  };
}

export async function exportUninstallReport(payload, cwd = process.cwd()) {
  const reportsDir = path.join(cwd, "dist", "reports");
  await fs.mkdir(reportsDir, { recursive: true });

  const stamp = timestamp();
  const jsonPath = path.join(reportsDir, `openclaw-uninstall-report-${stamp}.json`);
  const mdPath = path.join(reportsDir, `openclaw-uninstall-report-${stamp}.md`);

  const markdown = [
    "# OpenClaw 卸载报告",
    "",
    `生成时间：${new Date().toLocaleString("zh-CN")}`,
    "",
    "## 摘要",
    "",
    `- 发现项目数：${payload.scan?.summary?.found ?? 0}`,
    `- 总大小：${payload.scan?.summary?.totalLabel ?? "0 B"}`,
    `- 已删除项目数：${payload.uninstall?.removed?.length ?? 0}`,
    `- 卸载后剩余项目数：${payload.verify?.remainingItems?.length ?? 0}`,
    "",
    "## 删除日志",
    "",
    ...(payload.uninstall?.logs ?? []).map((line) => `- ${line}`),
    "",
    "## 卸载后校验",
    "",
    ...(payload.verify?.remainingItems?.length
      ? payload.verify.remainingItems.map((item) => `- 残留：${item.label} - ${item.path}`)
      : ["- 未发现残留文件项"])
  ].join("\n");

  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  await fs.writeFile(mdPath, markdown, "utf8");

  return { jsonPath, mdPath };
}

export async function uninstallOpenClaw(options = {}) {
  const { backup = true, cwd = process.cwd() } = options;
  const scan = await scanOpenClawInstallation();
  const presentItems = scan.items.filter((item) => item.present);
  const logs = [];

  if (presentItems.length === 0) {
    const verify = await verifyOpenClawRemoval();
    return { ok: true, logs: ["未发现 OpenClaw 安装痕迹。"], backupDir: null, removed: [], scan, verify };
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

  const verify = await verifyOpenClawRemoval();
  logs.push(verify.ok ? "卸载后校验通过。" : `卸载后仍有 ${verify.remainingItems.length} 项残留。`);

  return {
    ok: true,
    logs,
    backupDir,
    removed,
    scan,
    verify
  };
}
