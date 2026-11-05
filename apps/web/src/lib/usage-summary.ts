// Totals of the AI calls the app made (M5.4), by day, model, task and who asked. Tokens are what the servers reported;
// a call whose server gave no numbers is counted in `unmeasured` and adds nothing, so nothing here is an estimate.

import { costOf, priceOf, type ModelPrice } from "./ai/pricing";

export type UsageRow = {
  at: Date;
  provider: string;
  model: string;
  task: string;
  inputTokens: number | null;
  outputTokens: number | null;
  actorKind: string;
  actorName: string;
};

export type Money = { currency: string; amount: number };
export type UsageGroup = { key: string; calls: number; inputTokens: number; outputTokens: number; /** Priced calls only, per currency. */ cost: Money[]; /** Calls to a model on the owner's machine. */ free: number; /** Measured hosted calls with no price. */ unpriced: number };

export type UsageSummary = {
  calls: number;
  measured: number;
  unmeasured: number;
  inputTokens: number;
  outputTokens: number;
  /** Money for the calls that have a price, per currency (never added across currencies). */
  cost: Money[];
  /** Hosted calls with token numbers and no price: not in `cost`. */
  unpriced: number;
  byDay: UsageGroup[];
  byModel: UsageGroup[];
  byTask: UsageGroup[];
  byActor: UsageGroup[];
};

const dayOf = (at: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);

/** "claude-code (assistant)" for a client, "worker (scheduler)" for the worker, "you" for the dashboard. */
function actorLabel(row: UsageRow): string {
  if (row.actorKind === "USER") return "you";
  const who = row.actorName || row.actorKind.toLowerCase();
  return row.actorKind === "SCHEDULER" ? `${who} (scheduler)` : row.actorKind === "SYSTEM" ? `${who} (system)` : `${who} (assistant)`;
}

/** What a call cost, in its price's currency; null when it has no price (a hosted call), a call without numbers, or a model on the owner's machine (free, so nothing). */
function costOfRow(row: UsageRow, prices: ModelPrice[]): Money | null {
  if (row.inputTokens === null || row.outputTokens === null) return null;
  const price = priceOf(row, prices);
  if (price === null || price === "free") return null;
  return { currency: price.currency, amount: costOf({ inputTokens: row.inputTokens, outputTokens: row.outputTokens }, price) };
}

function addMoney(into: Money[], money: Money | null) {
  if (!money) return;
  const entry = into.find((item) => item.currency === money.currency);
  if (entry) entry.amount += money.amount;
  else into.push({ ...money });
}

const tidy = (money: Money[]): Money[] => money.map((item) => ({ currency: item.currency, amount: Math.round(item.amount * 1e8) / 1e8 })).sort((a, b) => a.currency.localeCompare(b.currency));

function group(rows: UsageRow[], keyOf: (row: UsageRow) => string, prices: ModelPrice[]): UsageGroup[] {
  const groups = new Map<string, UsageGroup>();
  for (const row of rows) {
    const key = keyOf(row);
    const entry = groups.get(key) ?? { key, calls: 0, inputTokens: 0, outputTokens: 0, cost: [], free: 0, unpriced: 0 };
    entry.calls++;
    entry.inputTokens += row.inputTokens ?? 0;
    entry.outputTokens += row.outputTokens ?? 0;
    addMoney(entry.cost, costOfRow(row, prices));
    const price = priceOf(row, prices);
    if (price === "free") entry.free++;
    else if (price === null && row.inputTokens !== null && row.outputTokens !== null) entry.unpriced++;
    groups.set(key, entry);
  }
  return [...groups.values()].map((entry) => ({ ...entry, cost: tidy(entry.cost) }));
}

const byTokens = (a: UsageGroup, b: UsageGroup) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens) || b.calls - a.calls || a.key.localeCompare(b.key);

export function summarizeUsage(rows: UsageRow[], timeZone: string, prices: ModelPrice[]): UsageSummary {
  const measured = rows.filter((row) => row.inputTokens !== null && row.outputTokens !== null).length;
  return {
    calls: rows.length,
    measured,
    unmeasured: rows.length - measured,
    inputTokens: rows.reduce((sum, row) => sum + (row.inputTokens ?? 0), 0),
    outputTokens: rows.reduce((sum, row) => sum + (row.outputTokens ?? 0), 0),
    cost: tidy(rows.reduce((into, row) => (addMoney(into, costOfRow(row, prices)), into), [] as Money[])),
    unpriced: rows.filter((row) => row.inputTokens !== null && row.outputTokens !== null && priceOf(row, prices) === null).length,
    byDay: group(rows, (row) => dayOf(row.at, timeZone), prices).sort((a, b) => b.key.localeCompare(a.key)),
    byModel: group(rows, (row) => row.model, prices).sort(byTokens),
    byTask: group(rows, (row) => row.task, prices).sort(byTokens),
    byActor: group(rows, actorLabel, prices).sort(byTokens),
  };
}
