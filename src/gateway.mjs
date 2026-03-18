import http from "node:http";
import { createProvider } from "./provider.mjs";

function json(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

export function startGateway(config) {
  const provider = createProvider(config.provider);

  const server = http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      json(response, 200, { ok: true, provider: config.provider.type });
      return;
    }

    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk.toString("utf8");
      });
      request.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          const messages = Array.isArray(payload.messages) ? payload.messages : [];
          const content = await provider.generate(messages, config);
          json(response, 200, {
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: config.provider.model,
            choices: [
              {
                index: 0,
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content
                }
              }
            ]
          });
        } catch (error) {
          json(response, 500, { error: error.message });
        }
      });
      return;
    }

    json(response, 404, { error: "Not found" });
  });

  server.listen(config.gateway.port, config.gateway.host, () => {
    console.log(`gateway listening at http://${config.gateway.host}:${config.gateway.port}`);
  });
}
