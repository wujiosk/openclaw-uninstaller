import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { createProvider } from "./provider.mjs";

function buildInitialMessages(config) {
  return config.systemPrompt ? [{ role: "system", content: config.systemPrompt }] : [];
}

export async function runMessage(config, userText) {
  const provider = createProvider(config.provider);
  const messages = buildInitialMessages(config);
  messages.push({ role: "user", content: userText });
  const reply = await provider.generate(messages, config);
  console.log(reply);
}

export async function generateSingleReply(config, userText) {
  const provider = createProvider(config.provider);
  const messages = buildInitialMessages(config);
  messages.push({ role: "user", content: userText });
  return provider.generate(messages, config);
}

export async function runAgent(config) {
  const provider = createProvider(config.provider);
  let messages = buildInitialMessages(config);
  const rl = readline.createInterface({ input, output, terminal: true });

  const ask = (prompt) =>
    new Promise((resolve) => {
      rl.question(prompt, resolve);
    });

  console.log(`claw agent ready on provider: ${config.provider.type}`);
  console.log("Commands: /help /clear /exit\n");

  while (true) {
    const line = (await ask("you> ")).trim();
    if (!line) {
      continue;
    }

    if (line === "/exit") {
      break;
    }

    if (line === "/help") {
      console.log("Commands: /help /clear /exit\n");
      continue;
    }

    if (line === "/clear") {
      messages = buildInitialMessages(config);
      console.log("Conversation cleared.\n");
      continue;
    }

    try {
      messages.push({ role: "user", content: line });
      const reply = await provider.generate(messages, config);
      messages.push({ role: "assistant", content: reply });
      console.log(`assistant> ${reply}\n`);
    } catch (error) {
      console.error(`request failed: ${error.message}\n`);
    }
  }

  rl.close();
}
