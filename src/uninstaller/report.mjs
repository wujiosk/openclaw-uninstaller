import fs from "node:fs/promises";
import path from "node:path";
import { createTimestamp } from "./shared.mjs";

function buildMarkdownReport(payload) {
  const scanSummary = payload.scan?.summary;
  const uninstallLogs = payload.uninstall?.logs ?? [];
  const remainingItems = payload.verify?.remainingItems ?? [];

  return [
    "# OpenClaw 卸载报告",
    "",
    `生成时间：${new Date().toLocaleString("zh-CN")}`,
    "",
    "## 摘要",
    "",
    `- 发现项目数：${scanSummary?.found ?? 0}`,
    `- 总大小：${scanSummary?.totalLabel ?? "0 B"}`,
    `- 已删除项目数：${payload.uninstall?.removed?.length ?? 0}`,
    `- 卸载后剩余项目数：${remainingItems.length}`,
    "",
    "## 删除日志",
    "",
    ...(uninstallLogs.length ? uninstallLogs.map((line) => `- ${line}`) : ["- 无删除日志"]),
    "",
    "## 卸载后校验",
    "",
    ...(remainingItems.length
      ? remainingItems.map((item) => `- 残留：${item.label} - ${item.path}`)
      : ["- 未发现残留文件项"])
  ].join("\n");
}

export async function exportUninstallReport(payload, cwd = process.cwd()) {
  const reportsDir = path.join(cwd, "dist", "reports");
  await fs.mkdir(reportsDir, { recursive: true });

  const stamp = createTimestamp();
  const jsonPath = path.join(reportsDir, `openclaw-uninstall-report-${stamp}.json`);
  const mdPath = path.join(reportsDir, `openclaw-uninstall-report-${stamp}.md`);

  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  await fs.writeFile(mdPath, buildMarkdownReport(payload), "utf8");

  return { jsonPath, mdPath };
}
