import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});

import { saveSettings } from "@/lib/settings-data";

import { loadBudget, monthStart } from "./budget-data";

const prisma = () => db.client!;
beforeEach(() => resetDatabase(prisma()));
afterAll(() => prisma().$disconnect());

const call = (at: string, over: Record<string, unknown> = {}) => ({ at: new Date(at), provider: "ANTHROPIC", model: "claude-sonnet-5", task: "text", inputTokens: 100_000, outputTokens: 10_000, ...over });

describe("monthStart", () => {
  it("is the first moment of the month in UTC", () => {
    expect(monthStart(new Date("2026-11-30T23:59:59Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(monthStart(new Date("2026-12-01T00:00:00Z")).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
});

describe("loadBudget", () => {
  it("counts only this month's calls to hosted models, against the saved prices and caps", async () => {
    await prisma().aiCall.createMany({
      data: [
        call("2026-10-31T23:59:59Z"), // last month: not counted
        call("2026-11-02T10:00:00Z"),
        call("2026-11-03T10:00:00Z", { provider: "LOCAL", model: "qwen", inputTokens: 9_000_000 }), // own machine: free
        call("2026-11-04T10:00:00Z", { inputTokens: null, outputTokens: null }), // no numbers: not counted
      ],
    });
    await saveSettings({
      modelPrices: [{ model: "claude-sonnet-5", currency: "EUR", inputPerMillion: 3, outputPerMillion: 15 }],
      aiBudget: { monthlyLimit: { amount: 1, currency: "EUR" }, monthlyTokens: null, warnPercent: 80, atLimit: "stop", fallbackModel: null },
    });
    const { state, budget, prices } = await loadBudget(new Date("2026-11-05T12:00:00Z"));
    expect(budget.monthlyLimit).toEqual({ amount: 1, currency: "EUR" });
    expect(prices).toHaveLength(1);
    expect(state).toMatchObject({ state: "ok", tokens: 110_000, unpriced: 0 });
    expect(state.spent?.amount).toBeCloseTo(0.45, 6);
  });

  it("is off when no cap was ever set", async () => {
    await prisma().aiCall.create({ data: call("2026-11-02T10:00:00Z") });
    expect((await loadBudget(new Date("2026-11-05T12:00:00Z"))).state.state).toBe("off");
  });
});
