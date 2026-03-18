class MockProvider {
  async generate(messages) {
    const last = [...messages].reverse().find((item) => item.role === "user");
    const content = last?.content ?? "";

    if (!content) {
      return "claw is ready.";
    }

    return [
      "This is a mock provider response.",
      `Echo: ${content}`,
      "Switch provider.type to openai-compatible when you are ready to use a real model."
    ].join(" ");
  }
}

class OpenAICompatibleProvider {
  constructor(config) {
    this.config = config;
  }

  async generate(messages) {
    const apiKey = process.env[this.config.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`Missing API key in environment variable ${this.config.apiKeyEnv}.`);
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages
      })
    });

    if (!response.ok) {
      throw new Error(`Provider request failed: ${response.status} ${await response.text()}`);
    }

    const payload = await response.json();
    return payload.choices?.[0]?.message?.content?.trim() || "No response content.";
  }
}

export function createProvider(providerConfig) {
  if (providerConfig.type === "openai-compatible") {
    return new OpenAICompatibleProvider(providerConfig);
  }

  return new MockProvider();
}
