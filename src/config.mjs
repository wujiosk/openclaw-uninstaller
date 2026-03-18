import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const defaultConfig = {
  systemPrompt: "You are claw, a practical local coding assistant.",
  provider: {
    type: "mock",
    model: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY"
  },
  gateway: {
    host: "127.0.0.1",
    port: 8787
  }
};

export function getDefaultConfig() {
  return structuredClone(defaultConfig);
}

export function getUserConfigPath() {
  return path.join(os.homedir(), ".claw", "config.json");
}

export function getLocalConfigPath() {
  return path.join(process.cwd(), "claw.config.json");
}

function stripBom(text) {
  return text.replace(/^\uFEFF/, "");
}

async function readJsonIfExists(filePath) {
  try {
    const content = stripBom(await readFile(filePath, "utf8"));
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
}

function mergeConfig(base, override) {
  return {
    ...base,
    ...override,
    provider: {
      ...base.provider,
      ...(override?.provider ?? {})
    },
    gateway: {
      ...base.gateway,
      ...(override?.gateway ?? {})
    }
  };
}

export async function hasUserConfig() {
  return (await readJsonIfExists(getUserConfigPath())) !== null;
}

export async function loadConfig() {
  const [userConfig, localConfig] = await Promise.all([
    readJsonIfExists(getUserConfigPath()),
    readJsonIfExists(getLocalConfigPath())
  ]);

  return mergeConfig(mergeConfig(defaultConfig, userConfig ?? {}), localConfig ?? {});
}

export async function writeUserConfig(config) {
  const filePath = getUserConfigPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2), "utf8");
  return filePath;
}
