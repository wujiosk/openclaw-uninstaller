import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { APP_NAME, HOST, PORT } from "./config.mjs";
import {
  scanOpenClawInstallation,
  uninstallOpenClaw,
  verifyOpenClawRemoval,
  exportUninstallReport
} from "./openclaw-uninstaller.mjs";

const runtimeRoot =
  path.basename(process.execPath).toLowerCase() === "openclaw-uninstaller.exe"
    ? path.dirname(process.execPath)
    : process.cwd();
const publicDir = path.join(runtimeRoot, "webui");

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function getContentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

async function readRequestJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const relativePath = url.pathname === "/" ? "/openclaw-uninstaller.html" : url.pathname;
  const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, normalizedPath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, app: APP_NAME, port: PORT });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/openclaw-uninstall/scan") {
    const payload = await scanOpenClawInstallation();
    sendJson(res, 200, { ok: true, ...payload });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/openclaw-uninstall/run") {
    const body = await readRequestJson(req);
    const payload = await uninstallOpenClaw({
      backup: Boolean(body.backup),
      cwd: runtimeRoot
    });
    sendJson(res, 200, { ok: true, ...payload });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/openclaw-uninstall/verify") {
    const payload = await verifyOpenClawRemoval();
    sendJson(res, 200, { ok: true, ...payload });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/openclaw-uninstall/export-report") {
    const body = await readRequestJson(req);
    const payload = await exportUninstallReport(body, runtimeRoot);
    sendJson(res, 200, { ok: true, ...payload });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const handled = await handleApi(req, res);

    if (!handled) {
      await serveStatic(req, res);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器内部错误";
    sendJson(res, 500, { ok: false, error: message });
  }
});

export function startServer() {
  server.listen(PORT, HOST, () => {
    console.log(`${APP_NAME} running at http://${HOST}:${PORT}`);
  });
}

if (process.argv[1] && path.basename(process.argv[1]).toLowerCase() === "webui-server.mjs") {
  startServer();
}
