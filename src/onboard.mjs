import readline from "node:readline";
import { stdout as output, stdin as input } from "node:process";
import { getDefaultConfig, getUserConfigPath, writeUserConfig } from "./config.mjs";

function createInterface() {
  return readline.createInterface({ input, output, terminal: true });
}

function ask(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function normalizeYesNo(value, fallback = true) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) {
    return fallback;
  }
  return ["y", "yes", "1", "是"].includes(text);
}

export async function runOnboardWizard() {
  const rl = createInterface();

  try {
    console.log("\n欢迎使用 claw 轻量版。\n");
    console.log("这是第一次配置向导，按回车可以接受默认值。\n");

    const config = getDefaultConfig();

    const providerChoice = await ask(
      rl,
      "选择模型模式：1) 本地演示 mock  2) OpenAI 兼容接口 [默认 1]: "
    );

    if (String(providerChoice).trim() === "2") {
      config.provider.type = "openai-compatible";

      const baseUrl = await ask(
        rl,
        `模型接口地址 [默认 ${config.provider.baseUrl}]: `
      );
      if (baseUrl.trim()) {
        config.provider.baseUrl = baseUrl.trim();
      }

      const model = await ask(rl, `模型名称 [默认 ${config.provider.model}]: `);
      if (model.trim()) {
        config.provider.model = model.trim();
      }

      const apiKeyEnv = await ask(
        rl,
        `API Key 环境变量名 [默认 ${config.provider.apiKeyEnv}]: `
      );
      if (apiKeyEnv.trim()) {
        config.provider.apiKeyEnv = apiKeyEnv.trim();
      }
    }

    const systemPrompt = await ask(
      rl,
      `系统提示词 [默认 ${config.systemPrompt}]: `
    );
    if (systemPrompt.trim()) {
      config.systemPrompt = systemPrompt.trim();
    }

    const gatewayPort = await ask(rl, `本地网关端口 [默认 ${config.gateway.port}]: `);
    if (gatewayPort.trim()) {
      const parsed = Number.parseInt(gatewayPort.trim(), 10);
      if (Number.isFinite(parsed)) {
        config.gateway.port = parsed;
      }
    }

    const savePath = await writeUserConfig(config);

    console.log("\n配置完成。\n");
    console.log(`配置文件位置：${savePath}`);

    if (config.provider.type === "openai-compatible") {
      console.log("\n你选择了真实模型模式，还需要在系统里设置 API Key 环境变量。\n");
      console.log(`CMD 临时设置：set ${config.provider.apiKeyEnv}=你的密钥`);
      console.log(`PowerShell 临时设置：$env:${config.provider.apiKeyEnv}=\"你的密钥\"`);
    } else {
      console.log("\n当前是 mock 演示模式，适合先熟悉使用流程。\n");
    }

    const openAgent = await ask(rl, "现在要立即进入聊天模式吗？(Y/n): ");
    return {
      launchedAgent: normalizeYesNo(openAgent, true),
      config,
      configPath: savePath
    };
  } finally {
    rl.close();
  }
}

export function printSetupHint() {
  console.log(`\n还没有检测到配置文件：${getUserConfigPath()}`);
  console.log("请先运行首次配置向导。\n");
}
