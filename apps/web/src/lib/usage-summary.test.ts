import { describe, expect, it } from "vitest";

import { summarizeUsage, type UsageRow } from "./usage-summary";

const row = (over: Partial<UsageRow>): UsageRow => ({ at: new Date("2026-11-03T10:00:00Z"), provider: "ANTHROPIC", model: "claude-sonnet-5", task: "text", inputTokens: 100, outputTokens: 20, actorKind: "USER", actorName: "", ...over });

describe("summarizeUsage", () => {
  it("is zeros and empty lists when nothing was called", () => {
    expect(summarizeUsage([], "UTC")).toEqual({ calls: 0, measured: 0, unmeasured: 0, inputTokens: 0, outputTokens: 0, byDay: [], byModel: [], byTask: [], byActor: [] });
  });

  it("totals the tokens a server reported, and counts a call without numbers separately instead of guessing", () => {
    const summary = summarizeUsage([row({}), row({ inputTokens: 50, outputTokens: 10 }), row({ inputTokens: null, outputTokens: null })], "UTC");
    expect(summary).toMatchObject({ calls: 3, measured: 2, unmeasured: 1, inputTokens: 150, outputTokens: 30 });
  });

  it("groups by day in the owner's time zone, newest first", () => {
    // 23:30 UTC on the 3rd is already the 4th in Berlin.
    const rows = [row({ at: new Date("2026-11-03T23:30:00Z") }), row({ at: new Date("2026-11-03T08:00:00Z") }), row({ at: new Date("2026-11-01T12:00:00Z") })];
    expect(summarizeUsage(rows, "UTC").byDay.map((d) => [d.key, d.calls])).toEqual([["2026-11-03", 2], ["2026-11-01", 1]]);
    expect(summarizeUsage(rows, "Europe/Berlin").byDay.map((d) => [d.key, d.calls])).toEqual([["2026-11-04", 1], ["2026-11-03", 1], ["2026-11-01", 1]]);
  });

  it("groups by model, task and who asked, most tokens first", () => {
    const rows = [
      row({ model: "a", task: "extracted_posting", inputTokens: 10, outputTokens: 1 }),
      row({ model: "b", task: "text", inputTokens: 500, outputTokens: 50, actorKind: "CLI", actorName: "claude-code" }),
      row({ model: "b", task: "text", inputTokens: 500, outputTokens: 50, actorKind: "CLI", actorName: "claude-code" }),
    ];
    const summary = summarizeUsage(rows, "UTC");
    expect(summary.byModel.map((m) => [m.key, m.calls, m.inputTokens + m.outputTokens])).toEqual([["b", 2, 1100], ["a", 1, 11]]);
    expect(summary.byTask.map((t) => t.key)).toEqual(["text", "extracted_posting"]);
    expect(summary.byActor.map((a) => a.key)).toEqual(["claude-code (assistant)", "you"]);
  });
});
