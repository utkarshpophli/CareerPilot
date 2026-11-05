import { describe, expect, it } from "vitest";

import { BUILT_IN_PRICES, costOf, isHosted, PRICING_AS_OF, priceOf, type ModelPrice } from "./pricing";

const sonnet: ModelPrice = { model: "claude-sonnet-5", currency: "EUR", inputPerMillion: 3, outputPerMillion: 15 };

describe("pricing", () => {
  it("dates its built-in table, and holds no figure nobody has read off a provider's page", () => {
    expect(PRICING_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Every entry that is there carries where it was read; today the list is empty, and the Usage page says prices are the owner's.
    for (const entry of BUILT_IN_PRICES) expect(entry.source, entry.model).toMatch(/^https:\/\//);
  });

  it("treats models on the owner's own machine as free of charge, and hosted ones as needing a price", () => {
    expect(isHosted("LOCAL")).toBe(false);
    expect(isHosted("LMSTUDIO")).toBe(false);
    for (const provider of ["OPENAI", "ANTHROPIC", "MISTRAL"]) expect(isHosted(provider)).toBe(true);
    expect(priceOf({ provider: "LOCAL", model: "qwen2.5:3b" }, [])).toBe("free");
  });

  it("finds a hosted model's price by its exact name, the owner's first, and says none when there is none", () => {
    expect(priceOf({ provider: "ANTHROPIC", model: "claude-sonnet-5" }, [sonnet])).toEqual(sonnet);
    expect(priceOf({ provider: "ANTHROPIC", model: "claude-sonnet-5" }, [])).toBeNull();
    expect(priceOf({ provider: "ANTHROPIC", model: "claude-sonnet-5" }, [{ ...sonnet, model: "claude-haiku-5" }])).toBeNull();
    const cheaper = { ...sonnet, inputPerMillion: 1 };
    expect(priceOf({ provider: "ANTHROPIC", model: "claude-sonnet-5" }, [cheaper, sonnet])).toEqual(cheaper);
  });

  it("works a cost out from tokens and the price per million, to a hundredth of a cent", () => {
    expect(costOf({ inputTokens: 1_000_000, outputTokens: 0 }, sonnet)).toBe(3);
    expect(costOf({ inputTokens: 2_500, outputTokens: 400 }, sonnet)).toBeCloseTo(0.0135, 6);
    expect(costOf({ inputTokens: 0, outputTokens: 0 }, sonnet)).toBe(0);
  });
});
