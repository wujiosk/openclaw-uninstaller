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

function setLogs(lines) {
  document.querySelector("#logs").textContent = Array.isArray(lines) ? lines.join("\n") : String(lines);
}

async function scan() {
  setLogs("正在扫描...");
  const payload = await api("/api/openclaw-uninstall/scan");
  renderItems(payload.items);
  document.querySelector("#summary").textContent =
    `共发现 ${payload.summary.found} 项，总大小 ${payload.summary.totalLabel}`;
  setLogs(["扫描完成。", `发现 ${payload.summary.found} 项痕迹。`, `总大小 ${payload.summary.totalLabel}`]);
}

async function uninstall() {
  const backup = document.querySelector("#backupEnabled").checked;
  setLogs("正在执行卸载...");
  const payload = await api("/api/openclaw-uninstall/run", {
    method: "POST",
    body: JSON.stringify({ backup })
  });
  setLogs(payload.logs);
  await scan();
}

document.querySelector("#scanBtn").addEventListener("click", () => {
  scan().catch((error) => setLogs(`扫描失败：${error.message}`));
});

document.querySelector("#uninstallBtn").addEventListener("click", () => {
  uninstall().catch((error) => setLogs(`卸载失败：${error.message}`));
});

scan().catch((error) => setLogs(`扫描失败：${error.message}`));
