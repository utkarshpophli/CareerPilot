import { describe, expect, it, vi } from "vitest";

import { AiError } from "./errors";
import { DEFAULT_BUDGET, type Budget, type BudgetState } from "./budget";
import { BudgetedProvider } from "./budgeted-provider";
import { MockProvider } from "./providers/mock";

const ask = { system: "Be brief.", messages: [{ role: "user" as const, content: "Hi" }] };
const state = (over: Partial<BudgetState> = {}): BudgetState => ({ state: "ok", percent: 10, spent: null, tokens: 0, unpriced: 0, otherCurrency: 0, ...over });
const loader = (budget: Budget, current: BudgetState) => vi.fn(async () => ({ budget, state: current }));

describe("BudgetedProvider", () => {
  it("passes calls through while the budget is off, fine, or only warning", async () => {
    for (const current of [state({ state: "off", percent: null }), state(), state({ state: "warn", percent: 90 })]) {
      const inner = new MockProvider({ model: "big", reply: () => "from big" });
      const provider = new BudgetedProvider(inner, { budget: loader({ ...DEFAULT_BUDGET, monthlyTokens: 100 }, current), fallback: () => null });
      expect(await provider.complete(ask)).toBe("from big");
    }
  });

  it("reports the inner provider's kind and model", () => {
    const provider = new BudgetedProvider(new MockProvider({ model: "big" }), { budget: loader(DEFAULT_BUDGET, state()), fallback: () => null });
    expect(provider.kind).toBe("MOCK");
    expect(provider.model).toBe("big");
  });

  it("stops at the cap with a message that says why and where to change it, and makes no call", async () => {
    const inner = new MockProvider({ model: "big", reply: () => "from big" });
    const over = state({ state: "over", percent: 112, spent: { amount: 5.6, currency: "EUR" }, tokens: 2_200_000 });
    const provider = new BudgetedProvider(inner, { budget: loader({ ...DEFAULT_BUDGET, monthlyLimit: { amount: 5, currency: "EUR" } }, over), fallback: () => null });
    const error = await provider.complete(ask).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).message).toBe("Your monthly AI budget is used up (5.6 EUR of 5 EUR). Raise the cap in Settings → Budget, or wait until next month.");
    expect((error as AiError).retryable).toBe(false);
    expect(inner.calls).toHaveLength(0);
  });

  it("says it in tokens when the cap is a token cap", async () => {
    const over = state({ state: "over", percent: 120, tokens: 1_200_000 });
    const provider = new BudgetedProvider(new MockProvider({ model: "big" }), { budget: loader({ ...DEFAULT_BUDGET, monthlyTokens: 1_000_000 }, over), fallback: () => null });
    await expect(provider.complete(ask)).rejects.toThrow("Your monthly AI budget is used up (1,200,000 of 1,000,000 tokens). Raise the cap in Settings → Budget, or wait until next month.");
  });

  it("switches to the cheaper model at the cap when asked to, and leaves that one uncapped", async () => {
    const inner = new MockProvider({ model: "big", reply: () => "from big" });
    const cheap = new MockProvider({ model: "small", reply: () => "from small" });
    const made: string[] = [];
    const over = state({ state: "over", percent: 130, tokens: 1_300_000 });
    const provider = new BudgetedProvider(inner, {
      budget: loader({ ...DEFAULT_BUDGET, monthlyTokens: 1_000_000, atLimit: "fallback", fallbackModel: "small" }, over),
      fallback: (model) => (made.push(model), cheap),
    });
    expect(await provider.complete(ask)).toBe("from small");
    expect(made).toEqual(["small"]);
    expect(inner.calls).toHaveLength(0);
  });

  it("stops anyway when the cheaper model is the one already in use, or is not named", async () => {
    const over = state({ state: "over", percent: 130, tokens: 1_300_000 });
    for (const fallbackModel of ["big", null]) {
      const provider = new BudgetedProvider(new MockProvider({ model: "big" }), { budget: loader({ ...DEFAULT_BUDGET, monthlyTokens: 1_000_000, atLimit: "fallback", fallbackModel }, over), fallback: () => new MockProvider({ model: "x" }) });
      await expect(provider.complete(ask)).rejects.toBeInstanceOf(AiError);
    }
  });

  it("asks for the budget at most once every ten seconds, and never blocks a connection test", async () => {
    const load = loader(DEFAULT_BUDGET, state());
    let now = 1_000;
    const provider = new BudgetedProvider(new MockProvider({ model: "big" }), { budget: load, fallback: () => null, now: () => now });
    await provider.complete(ask);
    await provider.complete(ask);
    expect(load).toHaveBeenCalledTimes(1);
    now += 11_000;
    await provider.complete(ask);
    expect(load).toHaveBeenCalledTimes(2);

    const over = loader({ ...DEFAULT_BUDGET, monthlyTokens: 1 }, state({ state: "over", percent: 500, tokens: 5 }));
    const capped = new BudgetedProvider(new MockProvider({ model: "big" }), { budget: over, fallback: () => null });
    await expect(capped.test()).resolves.toMatchObject({ model: "big" });
    expect(over).not.toHaveBeenCalled();
  });
});
