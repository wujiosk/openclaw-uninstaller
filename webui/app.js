const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chatForm");
const inputEl = document.getElementById("messageInput");
const statusEl = document.getElementById("statusText");
const newSessionBtn = document.getElementById("newSessionBtn");

let sessionId = localStorage.getItem("nullclaw-webui-session") || crypto.randomUUID();
localStorage.setItem("nullclaw-webui-session", sessionId);

function addMessage(role, text) {
  const item = document.createElement("div");
  item.className = `message ${role}`;
  item.textContent = text;
  messagesEl.appendChild(item);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setBusy(busy, label) {
  statusEl.textContent = label;
  inputEl.disabled = busy;
  formEl.querySelector("button[type='submit']").disabled = busy;
}

async function sendMessage(message) {
  setBusy(true, "正在等待 NullClaw 回复...");
  addMessage("user", message);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId })
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "请求失败");
    }

    sessionId = payload.sessionId || sessionId;
    localStorage.setItem("nullclaw-webui-session", sessionId);
    addMessage("assistant", payload.reply);
    setBusy(false, "准备就绪");
  } catch (error) {
    addMessage("system", `请求失败：${error.message}`);
    setBusy(false, "请求失败");
  }
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = inputEl.value.trim();
  if (!message) return;
  inputEl.value = "";
  await sendMessage(message);
});

inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    formEl.requestSubmit();
  }
});

newSessionBtn.addEventListener("click", () => {
  sessionId = crypto.randomUUID();
  localStorage.setItem("nullclaw-webui-session", sessionId);
  messagesEl.innerHTML = "";
  addMessage("system", "已创建新会话。接下来发送的消息将从新的上下文开始。");
  setBusy(false, "新会话已准备");
});

addMessage("system", "网页 UI 已连接本地 NullClaw。你现在可以直接开始聊天。");
