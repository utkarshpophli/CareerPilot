import { describe, expect, it } from "vitest";

import { DEFAULT_BUDGET, evaluateBudget, type Budget } from "./budget";
import type { ModelPrice } from "./pricing";

const sonnet: ModelPrice = { model: "claude-sonnet-5", currency: "EUR", inputPerMillion: 3, outputPerMillion: 15 };
const call = (over: Record<string, unknown> = {}) => ({ provider: "ANTHROPIC", model: "claude-sonnet-5", inputTokens: 100_000, outputTokens: 10_000, ...over }) as { provider: string; model: string; inputTokens: number | null; outputTokens: number | null };
const budget = (over: Partial<Budget> = {}): Budget => ({ ...DEFAULT_BUDGET, ...over });

describe("evaluateBudget", () => {
  it("is off while no cap is set, whatever was spent", () => {
    expect(evaluateBudget([call()], [sonnet], budget())).toMatchObject({ state: "off", percent: null });
  });

  it("measures a money cap in the cap's own currency: 0.30 + 0.15 = 0.45 of 1.00", () => {
    const state = evaluateBudget([call()], [sonnet], budget({ monthlyLimit: { amount: 1, currency: "EUR" } }));
    expect(state).toMatchObject({ state: "ok", spent: { amount: 0.45, currency: "EUR" }, unpriced: 0 });
    expect(state.percent).toBeCloseTo(45, 6);
  });

  it("warns at the chosen percent and is over at 100", () => {
    const limit = { amount: 0.5, currency: "EUR" };
    expect(evaluateBudget([call()], [sonnet], budget({ monthlyLimit: limit, warnPercent: 80 })).state).toBe("warn"); // 90%
    expect(evaluateBudget([call()], [sonnet], budget({ monthlyLimit: limit, warnPercent: 95 })).state).toBe("ok");
    expect(evaluateBudget([call(), call()], [sonnet], budget({ monthlyLimit: limit })).state).toBe("over"); // 180%
  });

  it("never counts what it cannot price: hosted calls without a price and prices in another currency are reported, not guessed", () => {
    const rows = [call(), call({ model: "mystery" }), call({ model: "dollar" })];
    const prices = [sonnet, { model: "dollar", currency: "USD", inputPerMillion: 1, outputPerMillion: 1 }];
    const state = evaluateBudget(rows, prices, budget({ monthlyLimit: { amount: 1, currency: "EUR" } }));
    expect(state.spent?.amount).toBeCloseTo(0.45, 6);
    expect(state).toMatchObject({ unpriced: 1, otherCurrency: 1 });
  });

  it("does not count models on the owner's machine, in money or in tokens", () => {
    const rows = [call({ provider: "LOCAL", model: "qwen", inputTokens: 5_000_000, outputTokens: 1_000_000 })];
    expect(evaluateBudget(rows, [], budget({ monthlyLimit: { amount: 1, currency: "EUR" }, monthlyTokens: 1000 }))).toMatchObject({ state: "ok", tokens: 0, spent: { amount: 0 } });
  });

  it("measures a token cap without any price, and takes the stricter of the two caps", () => {
    const rows = [call({ model: "mystery" })]; // 110,000 tokens, no price
    const tokensOnly = evaluateBudget(rows, [], budget({ monthlyTokens: 100_000 }));
    expect(tokensOnly).toMatchObject({ state: "over", tokens: 110_000 });
    expect(tokensOnly.percent).toBeCloseTo(110, 6);
    const both = evaluateBudget([call()], [sonnet], budget({ monthlyTokens: 1_000_000, monthlyLimit: { amount: 0.5, currency: "EUR" } }));
    expect(both.state).toBe("warn");
    expect(both.percent).toBeCloseTo(90, 6);
  });

  it("ignores a call whose server gave no numbers", () => {
    expect(evaluateBudget([call({ inputTokens: null, outputTokens: null })], [sonnet], budget({ monthlyTokens: 10 }))).toMatchObject({ state: "ok", tokens: 0 });
  });
});
