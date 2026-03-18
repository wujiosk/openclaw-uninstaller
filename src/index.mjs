#!/usr/bin/env node

import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { hasUserConfig, loadConfig, writeUserConfig, getUserConfigPath } from "./config.mjs";
import { runAgent, runMessage } from "./agent.mjs";
import { deployToVercel, parseDeployVercelArgs, vercelLogin, vercelWhoAmI } from "./deploy.mjs";
import { startGateway } from "./gateway.mjs";
import { runOnboardWizard, printSetupHint } from "./onboard.mjs";
import { startTelegramBridge } from "./telegram.mjs";
import {
  listWorkspaceFiles,
  printWorkspaceSummary,
  readWorkspaceFile,
  searchWorkspaceText
} from "./workspace.mjs";

function printHelp() {
  console.log(`claw

Usage:
  claw
  claw onboard
  claw gateway
  claw telegram
  claw agent
  claw message "hello"
  claw deploy vercel [path] [--prod] [--yes]
  claw vercel login
  claw vercel whoami
  claw files
  claw read <path>
  claw search <keyword>
  claw --help

Commands:
  onboard   Run first-time setup wizard
  gateway   Start a local OpenAI-compatible gateway
  telegram  Start a Telegram bot bridge for claw
  agent     Start an interactive assistant session
  message   Send one prompt and print the result
  deploy    Deploy a project, currently supports Vercel
  vercel    Login helper and account check for Vercel
  files     List files in current workspace
  read      Read a file from current workspace
  search    Search text in current workspace
`);
}

function createMenuInterface() {
  return readline.createInterface({ input, output, terminal: true });
}

function ask(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function isYes(value) {
  return ["y", "yes", "1"].includes(String(value ?? "").trim().toLowerCase());
}

async function runFilesCommand() {
  const files = await listWorkspaceFiles(process.cwd());
  printWorkspaceSummary(files);
}

async function runReadCommand(filePath) {
  if (!filePath) {
    throw new Error("read command requires a file path");
  }

  const result = await readWorkspaceFile(filePath, process.cwd());
  console.log(`\n===== ${result.path} =====\n`);
  console.log(result.content);
  console.log("");
}

async function runSearchCommand(keyword) {
  if (!keyword) {
    throw new Error("search command requires a keyword");
  }

  const results = await searchWorkspaceText(keyword, process.cwd());
  if (results.length === 0) {
    console.log("\nNo matches found.\n");
    return;
  }

  console.log(`\nFound ${results.length} matches:\n`);
  results.slice(0, 100).forEach((item) => {
    console.log(`${item.file}:${item.line}  ${item.text}`);
  });
  if (results.length > 100) {
    console.log(`... ${results.length - 100} more not shown`);
  }
  console.log("");
}

async function runMenu(config) {
  const rl = createMenuInterface();

  try {
    while (true) {
      console.log("claw main menu");
      console.log("1. Chat mode");
      console.log("2. Single message");
      console.log("3. List workspace files");
      console.log("4. Read a file");
      console.log("5. Search workspace text");
      console.log("6. Start local gateway");
      console.log("7. Deploy to Vercel");
      console.log("8. Run setup wizard again");
      console.log("0. Exit\n");

      const choice = (await ask(rl, "Choose an option: ")).trim();
      console.log("");

      if (choice === "0") {
        break;
      }

      if (choice === "1") {
        rl.pause();
        await runAgent(config);
        rl.resume();
        continue;
      }

      if (choice === "2") {
        const prompt = await ask(rl, "Enter your prompt: ");
        console.log("");
        await runMessage(config, prompt);
        console.log("");
        continue;
      }

      if (choice === "3") {
        await runFilesCommand();
        continue;
      }

      if (choice === "4") {
        const filePath = await ask(rl, "File path: ");
        await runReadCommand(filePath.trim());
        continue;
      }

      if (choice === "5") {
        const keyword = await ask(rl, "Keyword: ");
        await runSearchCommand(keyword.trim());
        continue;
      }

      if (choice === "6") {
        console.log("Starting local gateway. Press Ctrl+C to stop.\n");
        rl.close();
        startGateway(config);
        return;
      }

      if (choice === "7") {
        const projectPath = (await ask(rl, "Project path [default current directory]: ")).trim() || ".";
        const prodAnswer = await ask(rl, "Deploy to production? y/N: ");
        const yesAnswer = await ask(rl, "Skip interactive Vercel prompts? y/N: ");
        console.log("");

        rl.pause();
        try {
          await deployToVercel({
            cwd: process.cwd(),
            projectPath,
            prod: isYes(prodAnswer),
            yes: isYes(yesAnswer)
          });
          console.log("\nVercel deployment finished.\n");
        } catch (error) {
          console.error(`\nVercel deployment failed: ${error.message}\n`);
        }
        rl.resume();
        continue;
      }

      if (choice === "8") {
        rl.pause();
        const result = await runOnboardWizard();
        rl.resume();
        config = result.config;
        if (result.launchedAgent) {
          rl.pause();
          await runAgent(config);
          rl.resume();
        }
        continue;
      }

      console.log("Invalid option.\n");
    }
  } finally {
    rl.close();
  }
}

async function ensureConfigured() {
  const exists = await hasUserConfig();
  if (exists) {
    return null;
  }

  printSetupHint();
  return runOnboardWizard();
}

async function runOnboard() {
  const result = await runOnboardWizard();
  if (result.launchedAgent) {
    await runAgent(result.config);
  }
}

async function runVercelCommand(rest) {
  const [subcommand = ""] = rest;

  if (subcommand === "login") {
    await vercelLogin({ cwd: process.cwd() });
    return;
  }

  if (subcommand === "whoami") {
    const result = await vercelWhoAmI({ cwd: process.cwd() });
    const text = (result.stdout || result.stderr || "").trim();
    if (text) {
      console.log(text);
    }
    if (result.code !== 0) {
      process.exit(result.code);
    }
    return;
  }

  throw new Error("vercel supports: login, whoami");
}

async function main() {
  const [command = "menu", ...rest] = process.argv.slice(2);

  if (command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const setupResult = await ensureConfigured();
  const config = setupResult?.config ?? (await loadConfig());

  if (command === "menu") {
    await runMenu(config);
    return;
  }

  if (command === "onboard") {
    await runOnboard();
    return;
  }

  if (command === "gateway") {
    startGateway(config);
    return;
  }

  if (command === "telegram") {
    await startTelegramBridge(config);
    return;
  }

  if (command === "agent") {
    await runAgent(config);
    return;
  }

  if (command === "message") {
    const userText = rest.join(" ").trim();
    if (!userText) {
      throw new Error("message command requires prompt text");
    }
    await runMessage(config, userText);
    return;
  }

  if (command === "deploy") {
    const [target = "", ...deployArgs] = rest;
    if (target !== "vercel") {
      throw new Error("deploy currently supports only: vercel");
    }
    await deployToVercel({
      cwd: process.cwd(),
      ...parseDeployVercelArgs(deployArgs)
    });
    return;
  }

  if (command === "vercel") {
    await runVercelCommand(rest);
    return;
  }

  if (command === "files") {
    await runFilesCommand();
    return;
  }

  if (command === "read") {
    await runReadCommand(rest.join(" ").trim());
    return;
  }

  if (command === "search") {
    await runSearchCommand(rest.join(" ").trim());
    return;
  }

  if (command === "config-path") {
    console.log(getUserConfigPath());
    return;
  }

  if (command === "config-reset") {
    const filePath = await writeUserConfig(config);
    console.log(`Default config rewritten to ${filePath}`);
    return;
  }

  printHelp();
}

main().catch((error) => {
  console.error(`fatal: ${error.message}`);
  process.exit(1);
});
