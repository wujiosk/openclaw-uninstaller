const elements = {
  scanBtn: document.querySelector("#scanBtn"),
  verifyBtn: document.querySelector("#verifyBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  uninstallBtn: document.querySelector("#uninstallBtn"),
  backupEnabled: document.querySelector("#backupEnabled"),
  summary: document.querySelector("#summary"),
  itemsCount: document.querySelector("#itemsCount"),
  items: document.querySelector("#items"),
  runtime: document.querySelector("#runtime"),
  logs: document.querySelector("#logs"),
  confirmDialog: document.querySelector("#confirmDialog")
};

const state = {
  scan: null,
  uninstall: null,
  verify: null,
  busy: false
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

function setBusy(nextBusy) {
  state.busy = nextBusy;

  for (const button of [
    elements.scanBtn,
    elements.verifyBtn,
    elements.exportBtn,
    elements.uninstallBtn
  ]) {
    button.disabled = nextBusy;
  }
}

function setLogs(lines) {
  elements.logs.textContent = Array.isArray(lines) ? lines.join("\n") : String(lines);
}

function renderSummary(summary) {
  elements.itemsCount.textContent = `${summary.found} 项`;
  elements.summary.textContent =
    `发现 ${summary.found} 项残留，总大小 ${summary.totalLabel}，运行中进程 ${summary.runningProcesses}，服务 ${summary.services}，计划任务 ${summary.scheduledTasks}`;
}

function renderItems(items) {
  elements.items.innerHTML = "";

  if (!items.length) {
    elements.items.innerHTML = `<div class="empty-state">当前没有扫描结果。</div>`;
    return;
  }

  for (const item of items) {
    const card = document.createElement("article");
    card.className = `item-card ${item.present ? "is-present" : "is-missing"}`;
    card.innerHTML = `
      <strong class="item-title">${item.label}</strong>
      <div class="item-meta">${item.path}</div>
      <div class="item-meta">状态：${item.present ? "已发现" : "未发现"} · 类型：${item.kind} · 大小：${item.sizeLabel}</div>
    `;
    elements.items.append(card);
  }
}

function renderRuntimeSection(title, list, formatter) {
  const card = document.createElement("article");
  card.className = "runtime-card";

  if (!list.length) {
    card.innerHTML = `<strong>${title}</strong><div class="empty-state">未发现相关项</div>`;
    return card;
  }

  card.innerHTML = `
    <strong>${title}</strong>
    <div class="runtime-list">${list.map(formatter).join("<br>")}</div>
  `;
  return card;
}

function renderRuntime(runtime) {
  elements.runtime.innerHTML = "";

  elements.runtime.append(
    renderRuntimeSection(
      "运行中的进程",
      runtime?.processes ?? [],
      (item) => `${item.ProcessName} (#${item.Id}) ${item.Path || ""}`.trim()
    )
  );

  elements.runtime.append(
    renderRuntimeSection(
      "Windows 服务",
      runtime?.services ?? [],
      (item) => `${item.DisplayName || item.Name} · ${item.Status}`
    )
  );

  elements.runtime.append(
    renderRuntimeSection(
      "计划任务",
      runtime?.tasks ?? [],
      (item) => `${item.TaskPath || ""}${item.TaskName} · ${item.State}`
    )
  );
}

function snapshotForReport() {
  return {
    scan: state.scan,
    uninstall: state.uninstall,
    verify: state.verify
  };
}

async function runAction(action, loadingText) {
  setBusy(true);
  setLogs(loadingText);

  try {
    return await action();
  } finally {
    setBusy(false);
  }
}

async function scanInstallation() {
  return runAction(async () => {
    const payload = await request("/api/openclaw-uninstall/scan");
    state.scan = payload;

    renderSummary(payload.summary);
    renderItems(payload.items);
    renderRuntime(payload.runtime);

    setLogs([
      "扫描完成。",
      `发现 ${payload.summary.found} 项残留。`,
      `总大小：${payload.summary.totalLabel}`,
      `运行中的进程：${payload.summary.runningProcesses}`,
      `Windows 服务：${payload.summary.services}`,
      `计划任务：${payload.summary.scheduledTasks}`
    ]);
  }, "正在扫描 OpenClaw 安装痕迹...");
}

async function verifyRemoval() {
  return runAction(async () => {
    const payload = await request("/api/openclaw-uninstall/verify", {
      method: "POST",
      body: "{}"
    });

    state.verify = payload;
    renderRuntime(payload.runtime);

    setLogs(
      payload.ok
        ? ["校验通过。", "未发现 OpenClaw 残留。"]
        : [
            `校验未通过，仍有 ${payload.remainingItems.length} 项残留。`,
            ...payload.remainingItems.map((item) => `残留：${item.label} - ${item.path}`)
          ]
    );
  }, "正在校验卸载后残留...");
}

async function exportReport() {
  return runAction(async () => {
    if (!state.scan) {
      await scanInstallation();
    }

    const payload = await request("/api/openclaw-uninstall/export-report", {
      method: "POST",
      body: JSON.stringify(snapshotForReport())
    });

    setLogs(["报告已导出。", `JSON：${payload.jsonPath}`, `Markdown：${payload.mdPath}`]);
  }, "正在导出卸载报告...");
}

async function uninstallOpenClaw() {
  return runAction(async () => {
    const payload = await request("/api/openclaw-uninstall/run", {
      method: "POST",
      body: JSON.stringify({ backup: elements.backupEnabled.checked })
    });

    state.uninstall = payload;
    state.verify = payload.verify ?? null;

    setLogs(payload.logs);
    await scanInstallation();
  }, "正在执行卸载...");
}

elements.scanBtn.addEventListener("click", () => {
  scanInstallation().catch((error) => setLogs(`扫描失败：${error.message}`));
});

elements.verifyBtn.addEventListener("click", () => {
  verifyRemoval().catch((error) => setLogs(`校验失败：${error.message}`));
});

elements.exportBtn.addEventListener("click", () => {
  exportReport().catch((error) => setLogs(`导出失败：${error.message}`));
});

elements.uninstallBtn.addEventListener("click", () => {
  elements.confirmDialog.showModal();
});

elements.confirmDialog.addEventListener("close", () => {
  if (elements.confirmDialog.returnValue !== "confirm") {
    return;
  }

  uninstallOpenClaw().catch((error) => setLogs(`卸载失败：${error.message}`));
});

scanInstallation().catch((error) => setLogs(`扫描失败：${error.message}`));
