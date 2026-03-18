import fs from "node:fs/promises";
import path from "node:path";
import { getOpenClawTargets } from "./uninstaller/targets.mjs";
import { collectRuntimeSignals } from "./uninstaller/system.mjs";
import { createTimestamp, pathExists, collectPathSize, formatBytes } from "./uninstaller/shared.mjs";
import { exportUninstallReport } from "./uninstaller/report.mjs";

async function inspectTarget(target) {
  const present = await pathExists(target.path);
  const sizeBytes = present ? await collectPathSize(target.path) : 0;

  return {
    ...target,
    present,
    sizeBytes,
    sizeLabel: formatBytes(sizeBytes)
  };
}

async function backupTargets(items, backupDir) {
  await fs.mkdir(backupDir, { recursive: true });

  const copied = [];
  for (const item of items) {
    const safeName = item.id.replace(/[^\w.-]+/g, "_");
    const destination = path.join(backupDir, safeName);

    await fs.cp(item.path, destination, { recursive: true, force: true });
    copied.push({ from: item.path, to: destination });
  }

  return copied;
}

async function removeTarget(item) {
  if (!(await pathExists(item.path))) {
    return false;
  }

  await fs.rm(item.path, { recursive: true, force: true });
  return true;
}

export async function scanOpenClawInstallation() {
  const targets = getOpenClawTargets();
  const items = [];

  for (const target of targets) {
    items.push(await inspectTarget(target));
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

export async function verifyOpenClawRemoval() {
  const scan = await scanOpenClawInstallation();

  return {
    ok: scan.summary.found === 0,
    remainingItems: scan.items.filter((item) => item.present),
    summary: scan.summary,
    runtime: scan.runtime
  };
}

export { exportUninstallReport };

export async function uninstallOpenClaw(options = {}) {
  const { backup = true, cwd = process.cwd() } = options;
  const scan = await scanOpenClawInstallation();
  const presentItems = scan.items.filter((item) => item.present);
  const logs = [];

  if (presentItems.length === 0) {
    const verify = await verifyOpenClawRemoval();
    return {
      ok: true,
      scan,
      verify,
      logs: ["未发现 OpenClaw 安装痕迹。"],
      removed: [],
      backupDir: null
    };
  }

  let backupDir = null;
  if (backup) {
    backupDir = path.join(cwd, "dist", "openclaw-backups", `backup-${createTimestamp()}`);
    logs.push(`开始备份到 ${backupDir}`);

    const copied = await backupTargets(presentItems, backupDir);
    logs.push(`备份完成，共 ${copied.length} 项。`);
  }

  const removed = [];
  for (const item of presentItems) {
    try {
      const removedCurrent = await removeTarget(item);
      logs.push(removedCurrent ? `已删除：${item.path}` : `跳过：${item.path}`);

      if (removedCurrent) {
        removed.push(item.path);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logs.push(`删除失败：${item.path} - ${message}`);
    }
  }

  const verify = await verifyOpenClawRemoval();
  logs.push(verify.ok ? "卸载后校验通过。" : `卸载后仍有 ${verify.remainingItems.length} 项残留。`);

  return {
    ok: true,
    scan,
    verify,
    logs,
    removed,
    backupDir
  };
}
