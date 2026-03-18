import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import screenshot from "screenshot-desktop";
import {
  scanOpenClawInstallation,
  uninstallOpenClaw
} from "./openclaw-uninstaller.mjs";

const PORT = 32123;
const HOST = "127.0.0.1";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "webui");
const NULLCLAW_EXE =
  process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Programs", "nullclaw", "nullclaw.exe")
    : "nullclaw";

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  return "text/plain; charset=utf-8";
}

function sanitizeReply(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith("Sending to ")) return false;
      if (trimmed.startsWith("info(memory):")) return false;
      return true;
    })
    .join("\n")
    .trim();
}

function runNullClaw(message, sessionId) {
  return new Promise((resolve, reject) => {
    const args = ["agent", "-s", sessionId, "-m", message];
    const child = spawn(NULLCLAW_EXE, args, {
      cwd: os.homedir(),
      env: process.env,
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
        reject(new Error(stderr.trim() || stdout.trim() || `nullclaw exited with code ${code}`));
        return;
      }

      const reply = sanitizeReply(`${stdout}\n${stderr}`);
      resolve(reply || "模型没有返回可显示内容。");
    });
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const relativePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    json(res, 200, { ok: true, port: PORT });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/openclaw-uninstall/scan") {
    try {
      const payload = await scanOpenClawInstallation();
      json(res, 200, { ok: true, ...payload });
    } catch (error) {
      json(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "扫描失败"
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/openclaw-uninstall/run") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
    });
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const payload = await uninstallOpenClaw({
          backup: Boolean(parsed.backup),
          cwd: ROOT
        });
        json(res, 200, { ok: true, ...payload });
      } catch (error) {
        json(res, 500, {
          ok: false,
          error: error instanceof Error ? error.message : "卸载失败"
        });
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/tft/capture") {
    try {
      const image = await screenshot({ format: "png" });
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "no-store"
      });
      res.end(image);
    } catch (error) {
      json(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "截图失败"
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (body.length > 1024 * 1024) {
        req.destroy();
      }
    });

    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const message = String(parsed.message || "").trim();
        const sessionId = String(parsed.sessionId || randomUUID()).trim();

        if (!message) {
          json(res, 400, { ok: false, error: "消息不能为空。" });
          return;
        }

        const reply = await runNullClaw(message, sessionId);
        json(res, 200, { ok: true, reply, sessionId });
      } catch (error) {
        json(res, 500, {
          ok: false,
          error: error instanceof Error ? error.message : "请求失败"
        });
      }
    });
    return;
  }

  await serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`NullClaw Web UI running at http://${HOST}:${PORT}`);
});
