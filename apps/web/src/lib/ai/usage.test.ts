import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AnthropicProvider } from "./providers/anthropic";
import { MockProvider } from "./providers/mock";
import { OllamaProvider } from "./providers/ollama";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import { json, stubFetch } from "./test-http";
import { emitAiCall, onAiCall, type AiCall } from "./usage";

afterEach(() => vi.unstubAllGlobals());

const ask = { system: "Be brief.", messages: [{ role: "user" as const, content: "Hi" }] };

/** Every call the providers report while `run` goes. */
async function calls(run: () => Promise<unknown>): Promise<AiCall[]> {
  const seen: AiCall[] = [];
  const off = onAiCall((call) => void seen.push(call));
  try {
    await run();
  } finally {
    off();
  }
  return seen;
}

describe("the listener", () => {
  it("hears every call, can be removed, and cannot break the call it hears about", async () => {
    const heard: string[] = [];
    const off = onAiCall(() => {
      throw new Error("a listener that fails");
    });
    const keep = onAiCall((call) => void heard.push(call.task));
    expect(() => emitAiCall({ provider: "MOCK", model: "m", task: "text", usage: null, at: new Date() })).not.toThrow();
    off();
    keep();
    emitAiCall({ provider: "MOCK", model: "m", task: "after", usage: null, at: new Date() });
    expect(heard).toEqual(["text"]);
  });
});

describe("tokens reported by each provider", () => {
  it("Anthropic: input and output tokens of the message", async () => {
    stubFetch(() => json({ id: "m1", type: "message", role: "assistant", model: "claude", content: [{ type: "text", text: "Hello" }], stop_reason: "end_turn", usage: { input_tokens: 11, output_tokens: 7 } }));
    const provider = new AnthropicProvider("https://api.anthropic.com", "sk-ant-key", "claude-sonnet-5", 60_000);
    const [call, ...rest] = await calls(() => provider.complete(ask));
    expect(rest).toEqual([]);
    expect(call).toMatchObject({ provider: "ANTHROPIC", model: "claude-sonnet-5", task: "text", usage: { inputTokens: 11, outputTokens: 7 } });
    expect(call.at).toBeInstanceOf(Date);
  });

  it("OpenAI-compatible: prompt and completion tokens", async () => {
    stubFetch(() =>
      json({ id: "c1", object: "chat.completion", created: 0, model: "gpt", choices: [{ index: 0, message: { role: "assistant", content: "Hello" }, finish_reason: "stop" }], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } }),
    );
    const provider = new OpenAICompatibleProvider("OPENAI", "https://api.openai.com/v1", "sk-key", "gpt-5", 60_000);
    const [call] = await calls(() => provider.complete(ask));
    expect(call).toMatchObject({ provider: "OPENAI", usage: { inputTokens: 20, outputTokens: 5 } });
  });

  it("Ollama: evaluated prompt and generated tokens", async () => {
    stubFetch(() => json({ model: "qwen", message: { role: "assistant", content: "Hello" }, done: true, prompt_eval_count: 31, eval_count: 9 }));
    const provider = new OllamaProvider("http://ollama:11434", "qwen2.5:3b", 60_000);
    const [call] = await calls(() => provider.complete(ask));
    expect(call).toMatchObject({ provider: "LOCAL", usage: { inputTokens: 31, outputTokens: 9 } });
  });

  it("a server that reports no tokens is still counted as a call, with no numbers made up", async () => {
    stubFetch(() => json({ model: "qwen", message: { role: "assistant", content: "Hello" }, done: true }));
    const provider = new OllamaProvider("http://ollama:11434", "qwen2.5:3b", 60_000);
    const [call] = await calls(() => provider.complete(ask));
    expect(call.usage).toBeNull();
  });
});

describe("what a call is named, and the retry", () => {
  const Person = z.object({ name: z.string() });

  it("names a structured call by its schema, and counts the second try as its own call", async () => {
    const replies = ["not json", '{"name":"Jane"}'];
    const provider = new MockProvider({ reply: () => replies.shift() });
    const seen = await calls(() => provider.complete({ ...ask, schema: Person, schemaName: "extracted_posting" }));
    expect(seen.map((call) => call.task)).toEqual(["extracted_posting", "extracted_posting"]);
  });

  it("does not report a call that failed: there are no tokens to count", async () => {
    const provider = new MockProvider({
      reply: () => {
        throw new Error("boom");
      },
    });
    expect(await calls(() => provider.complete(ask).catch(() => undefined))).toEqual([]);
  });
});
