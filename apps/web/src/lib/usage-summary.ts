// Totals of the AI calls the app made (M5.4), by day, model, task and who asked. Tokens are what the servers reported;
// a call whose server gave no numbers is counted in `unmeasured` and adds nothing, so nothing here is an estimate.

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

export type UsageGroup = { key: string; calls: number; inputTokens: number; outputTokens: number };

export type UsageSummary = {
  calls: number;
  measured: number;
  unmeasured: number;
  inputTokens: number;
  outputTokens: number;
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

function group(rows: UsageRow[], keyOf: (row: UsageRow) => string): UsageGroup[] {
  const groups = new Map<string, UsageGroup>();
  for (const row of rows) {
    const key = keyOf(row);
    const entry = groups.get(key) ?? { key, calls: 0, inputTokens: 0, outputTokens: 0 };
    entry.calls++;
    entry.inputTokens += row.inputTokens ?? 0;
    entry.outputTokens += row.outputTokens ?? 0;
    groups.set(key, entry);
  }
  return [...groups.values()];
}

const byTokens = (a: UsageGroup, b: UsageGroup) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens) || b.calls - a.calls || a.key.localeCompare(b.key);

export function summarizeUsage(rows: UsageRow[], timeZone: string): UsageSummary {
  const measured = rows.filter((row) => row.inputTokens !== null && row.outputTokens !== null).length;
  return {
    calls: rows.length,
    measured,
    unmeasured: rows.length - measured,
    inputTokens: rows.reduce((sum, row) => sum + (row.inputTokens ?? 0), 0),
    outputTokens: rows.reduce((sum, row) => sum + (row.outputTokens ?? 0), 0),
    byDay: group(rows, (row) => dayOf(row.at, timeZone)).sort((a, b) => b.key.localeCompare(a.key)),
    byModel: group(rows, (row) => row.model).sort(byTokens),
    byTask: group(rows, (row) => row.task).sort(byTokens),
    byActor: group(rows, actorLabel).sort(byTokens),
  };
}
