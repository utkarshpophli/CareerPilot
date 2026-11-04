import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { runAsActor } from "@/lib/ledger";
import { createTestClient, resetDatabase } from "@/test/db";

import { emitAiCall } from "./usage";
import { keepAiCalls } from "./usage-store";

const db = createTestClient();
beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

const flush = () => new Promise((resolve) => setTimeout(resolve, 100));

describe("keepAiCalls", () => {
  it("writes a row for each call, with who asked, and never anything of the prompt or the answer", async () => {
    const stop = keepAiCalls(db);
    try {
      emitAiCall({ provider: "ANTHROPIC", model: "claude-sonnet-5", task: "extracted_posting", usage: { inputTokens: 120, outputTokens: 30 }, at: new Date("2026-11-03T10:00:00Z") });
      runAsActor({ kind: "CLI", name: "claude-code" }, () => emitAiCall({ provider: "LOCAL", model: "qwen", task: "text", usage: null, at: new Date("2026-11-03T11:00:00Z") }));
      await flush();
    } finally {
      stop();
    }
    const rows = await db.aiCall.findMany({ orderBy: { at: "asc" } });
    expect(rows).toMatchObject([
      { provider: "ANTHROPIC", model: "claude-sonnet-5", task: "extracted_posting", inputTokens: 120, outputTokens: 30, actorKind: "USER", actorName: "" },
      { provider: "LOCAL", model: "qwen", task: "text", inputTokens: null, outputTokens: null, actorKind: "CLI", actorName: "claude-code" },
    ]);
  });

  it("stops listening when asked, and a failing database never reaches the caller", async () => {
    const stop = keepAiCalls(db);
    stop();
    emitAiCall({ provider: "MOCK", model: "m", task: "text", usage: null, at: new Date() });
    await flush();
    expect(await db.aiCall.count()).toBe(0);
    const broken = keepAiCalls({ aiCall: { create: async () => Promise.reject(new Error("db down")) } } as never);
    expect(() => emitAiCall({ provider: "MOCK", model: "m", task: "text", usage: null, at: new Date() })).not.toThrow();
    await flush();
    broken();
  });
});
