import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";

const VERCEL_BIN = "vercel";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function parseRepeatedFlag(args, flag) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) {
      continue;
    }
    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      values.push(next);
      index += 1;
    }
  }
  return values;
}

function parseSingleFlagValue(args, flag) {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag) {
      return args[index + 1] ?? null;
    }
  }
  return null;
}

function omitParsedArgs(args) {
  const remaining = [];
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (["--prod", "--yes", "--force"].includes(current)) {
      continue;
    }
    if (["--token", "--scope", "--build-env", "--env"].includes(current)) {
      const next = args[index + 1];
      if (next && !next.startsWith("--")) {
        index += 1;
      }
      continue;
    }
    remaining.push(current);
  }
  return remaining;
}

function runVercel(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(VERCEL_BIN, args, {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.stdio ?? "pipe",
      shell: process.platform === "win32"
    });

    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });
    }

    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

export function parseDeployVercelArgs(args) {
  return {
    projectPath: omitParsedArgs(args)[0] ?? ".",
    prod: args.includes("--prod"),
    yes: args.includes("--yes"),
    force: args.includes("--force"),
    token: parseSingleFlagValue(args, "--token"),
    scope: parseSingleFlagValue(args, "--scope"),
    buildEnv: parseRepeatedFlag(args, "--build-env"),
    runtimeEnv: parseRepeatedFlag(args, "--env")
  };
}

export async function vercelWhoAmI(options = {}) {
  const args = ["whoami"];
  if (options.token) {
    args.push("--token", options.token);
  }
  return runVercel(args, { cwd: options.cwd, stdio: "pipe" });
}

export async function vercelLogin(options = {}) {
  return runVercel(["login"], { cwd: options.cwd, stdio: "inherit" });
}

export async function deployToVercel(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const projectPath = path.resolve(cwd, options.projectPath ?? ".");

  if (!(await pathExists(projectPath))) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  const auth = await vercelWhoAmI({ cwd: projectPath, token: options.token });
  if (auth.code !== 0 && !options.token) {
    const details = (auth.stderr || auth.stdout || "").trim();
    throw new Error(
      `Vercel 未登录。请先运行 \`claw vercel login\`，或者使用 --token。\n${details}`
    );
  }

  const args = ["deploy", projectPath];
  if (options.prod) {
    args.push("--prod");
  }
  if (options.yes) {
    args.push("--yes");
  }
  if (options.force) {
    args.push("--force");
  }
  if (options.scope) {
    args.push("--scope", options.scope);
  }
  if (options.token) {
    args.push("--token", options.token);
  }
  for (const pair of options.buildEnv ?? []) {
    args.push("--build-env", pair);
  }
  for (const pair of options.runtimeEnv ?? []) {
    args.push("--env", pair);
  }

  const result = await runVercel(args, { cwd: projectPath, stdio: "inherit" });
  if (result.code !== 0) {
    throw new Error(`Vercel deployment failed with exit code ${result.code}.`);
  }
}
