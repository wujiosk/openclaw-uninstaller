async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

let lastScanPayload = null;
let lastUninstallPayload = null;
let lastVerifyPayload = null;

function renderItems(items) {
  const root = document.querySelector("#items");
  root.innerHTML = "";
  if (!items.length) {
    root.textContent = "没有结果";
    return;
  }

  items.forEach((item) => {
    const node = document.createElement("div");
    node.className = `item ${item.present ? "present" : "missing"}`;
    node.innerHTML = `
      <strong>${item.label}</strong>
      <div class="meta">${item.path}</div>
      <div class="meta">状态：${item.present ? "已发现" : "未发现"} | 大小：${item.sizeLabel}</div>
    `;
    root.append(node);
  });
}

function renderRuntime(runtime) {
  const root = document.querySelector("#runtime");
  root.innerHTML = "";

  const buckets = [
    ["运行中进程", runtime?.processes ?? [], (item) => `${item.ProcessName} (#${item.Id}) ${item.Path || ""}`],
    ["系统服务", runtime?.services ?? [], (item) => `${item.DisplayName || item.Name} - ${item.Status}`],
    ["计划任务", runtime?.tasks ?? [], (item) => `${item.TaskPath || ""}${item.TaskName} - ${item.State}`]
  ];

  buckets.forEach(([title, list, format]) => {
    const node = document.createElement("div");
    node.className = "runtime-card";
    const content = list.length ? list.map(format).join("\n") : "未发现";
    node.innerHTML = `<strong>${title}</strong><div>${content.replace(/\n/g, "<br>")}</div>`;
    root.append(node);
  });
}

function setLogs(lines) {
  document.querySelector("#logs").textContent = Array.isArray(lines) ? lines.join("\n") : String(lines);
}

async function scan() {
  setLogs("正在扫描...");
  const payload = await api("/api/openclaw-uninstall/scan");
  lastScanPayload = payload;
  renderItems(payload.items);
  renderRuntime(payload.runtime);
  document.querySelector("#summary").textContent =
    `共发现 ${payload.summary.found} 项，总大小 ${payload.summary.totalLabel}，进程 ${payload.summary.runningProcesses}，服务 ${payload.summary.services}，任务 ${payload.summary.scheduledTasks}`;
  setLogs([
    "扫描完成。",
    `发现 ${payload.summary.found} 项痕迹。`,
    `总大小 ${payload.summary.totalLabel}`,
    `运行中进程 ${payload.summary.runningProcesses} 个，系统服务 ${payload.summary.services} 个，计划任务 ${payload.summary.scheduledTasks} 个`
  ]);
}

async function uninstall() {
  const backup = document.querySelector("#backupEnabled").checked;
  setLogs("正在执行卸载...");
  const payload = await api("/api/openclaw-uninstall/run", {
    method: "POST",
    body: JSON.stringify({ backup })
  });
  lastUninstallPayload = payload;
  lastVerifyPayload = payload.verify ?? null;
  setLogs(payload.logs);
  await scan();
}

async function verify() {
  setLogs("正在执行卸载后校验...");
  const payload = await api("/api/openclaw-uninstall/verify", { method: "POST" });
  lastVerifyPayload = payload;
  renderRuntime(payload.runtime);
  const remaining = payload.remainingItems?.length ?? 0;
  setLogs([
    payload.ok ? "校验通过：未发现残留。" : `校验未通过：仍有 ${remaining} 项残留。`,
    ...(payload.remainingItems || []).map((item) => `残留：${item.label} - ${item.path}`)
  ]);
}

async function exportReport() {
  if (!lastScanPayload) {
    await scan();
  }

  const payload = await api("/api/openclaw-uninstall/export-report", {
    method: "POST",
    body: JSON.stringify({
      scan: lastScanPayload,
      uninstall: lastUninstallPayload,
      verify: lastVerifyPayload
    })
  });

  setLogs([
    "报告已导出。",
    `JSON: ${payload.jsonPath}`,
    `Markdown: ${payload.mdPath}`
  ]);
}

document.querySelector("#scanBtn").addEventListener("click", () => {
  scan().catch((error) => setLogs(`扫描失败：${error.message}`));
});

document.querySelector("#verifyBtn").addEventListener("click", () => {
  verify().catch((error) => setLogs(`校验失败：${error.message}`));
});

document.querySelector("#exportBtn").addEventListener("click", () => {
  exportReport().catch((error) => setLogs(`导出失败：${error.message}`));
});

document.querySelector("#uninstallBtn").addEventListener("click", () => {
  document.querySelector("#confirmDialog").showModal();
});

document.querySelector("#confirmDialog").addEventListener("close", () => {
  if (document.querySelector("#confirmDialog").returnValue === "confirm") {
    uninstall().catch((error) => setLogs(`卸载失败：${error.message}`));
  }
});

scan().catch((error) => setLogs(`扫描失败：${error.message}`));
