import "server-only";

import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/settings-data";

import { evaluateBudget, type Budget, type BudgetState } from "./budget";
import type { ModelPrice } from "./pricing";

/** The first moment of the month `now` is in, in UTC. A month's budget starts and ends there, whatever the owner's time zone. */
export const monthStart = (now: Date): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

/** More calls than this in a month are cut off at the newest; a personal install makes a few hundred. */
const MAX_ROWS = 50_000;

/** The budget, the prices and how far this month has got. */
export async function loadBudget(now: Date = new Date()): Promise<{ budget: Budget; prices: ModelPrice[]; state: BudgetState }> {
  const [settings, rows] = await Promise.all([
    loadSettings(),
    prisma.aiCall.findMany({ where: { at: { gte: monthStart(now) } }, select: { provider: true, model: true, inputTokens: true, outputTokens: true }, orderBy: { at: "desc" }, take: MAX_ROWS }),
  ]);
  return { budget: settings.aiBudget, prices: settings.modelPrices, state: evaluateBudget(rows, settings.modelPrices, settings.aiBudget) };
}
