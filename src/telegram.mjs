import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { generateSingleReply } from "./agent.mjs";

const TELEGRAM_API = "https://api.telegram.org";

function getToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.");
  }
  return token;
}

function getStatePath() {
  return path.join(os.homedir(), ".claw", "telegram.json");
}

async function readState() {
  try {
    const content = await readFile(getStatePath(), "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return { offset: 0, allowedChatId: null };
    }
    throw error;
  }
}

async function writeState(state) {
  const filePath = getStatePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
}

async function telegramRequest(method, payload = {}) {
  const token = getToken();
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram request failed: ${response.status}`);
  }

  return result.result;
}

async function sendMessage(chatId, text) {
  const content = String(text ?? "").trim() || "Empty response.";
  const chunks = [];

  for (let index = 0; index < content.length; index += 3500) {
    chunks.push(content.slice(index, index + 3500));
  }

  for (const chunk of chunks) {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: chunk
    });
  }
}

function getMessageText(update) {
  return update.message?.text?.trim() || "";
}

function getChat(update) {
  return update.message?.chat;
}

async function ensureAllowedChat(state, chat) {
  if (state.allowedChatId) {
    return state.allowedChatId === chat.id;
  }

  if (chat.type !== "private") {
    return false;
  }

  state.allowedChatId = chat.id;
  await writeState(state);
  return true;
}

async function handleUpdate(config, state, update) {
  const chat = getChat(update);
  const text = getMessageText(update);

  if (!chat || !text) {
    return;
  }

  const isAllowed = await ensureAllowedChat(state, chat);
  if (!isAllowed) {
    return;
  }

  if (text === "/start") {
    await sendMessage(
      chat.id,
      [
        "Telegram bridge is ready.",
        `Bound chat id: ${chat.id}`,
        "This bot only forwards messages to claw and returns the reply."
      ].join("\n")
    );
    return;
  }

  if (text === "/help") {
    await sendMessage(chat.id, "Send any text to talk to claw. Commands: /start /help");
    return;
  }

  try {
    const reply = await generateSingleReply(config, text);
    await sendMessage(chat.id, reply);
  } catch (error) {
    await sendMessage(chat.id, `Request failed: ${error.message}`);
  }
}

export async function startTelegramBridge(config) {
  const me = await telegramRequest("getMe");
  console.log(`telegram bridge connected as @${me.username || me.first_name || me.id}`);

  const state = await readState();

  while (true) {
    const updates = await telegramRequest("getUpdates", {
      offset: state.offset,
      timeout: 30,
      allowed_updates: ["message"]
    });

    for (const update of updates) {
      state.offset = update.update_id + 1;
      await writeState(state);
      await handleUpdate(config, state, update);
    }
  }
}
