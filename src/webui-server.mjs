import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  scanOpenClawInstallation,
  uninstallOpenClaw
} from "./openclaw-uninstaller.mjs";

const PORT = 32123;
const HOST = "127.0.0.1";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "webui");

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
  return "text/plain; charset=utf-8";
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const relativePath = url.pathname === "/" ? "/openclaw-uninstaller.html" : url.pathname;
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

  await serveStatic(req, res);
});

export function startServer() {
  server.listen(PORT, HOST, () => {
    console.log(`OpenClaw Uninstaller running at http://${HOST}:${PORT}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
