import { describe, expect, it } from "vitest";

import { readStep, stepData } from "./run-step";

describe("stepData", () => {
  it("keeps the replay fields as one tidy line each and the counts as they are, leaving out what is empty", () => {
    expect(stepData({ source: "Greenhouse · stripe", decision: "kept 3 new,\n closed 1", promptVersion: "", scorerVersion: "score@1", found: 12, added: 3 })).toEqual({
      source: "Greenhouse · stripe",
      decision: "kept 3 new, closed 1",
      scorerVersion: "score@1",
      found: 12,
      added: 3,
    });
  });

  it("cuts a long line, and never lets a field be anything but text", () => {
    const data = stepData({ source: "x".repeat(500) });
    expect((data.source as string).length).toBe(200);
    expect(data.source).toMatch(/…$/);
  });
});

describe("readStep", () => {
  it("separates the replay fields from the rest of a step's data", () => {
    expect(readStep({ source: "Lever · acme", promptVersion: "extract-posting@1", decision: "kept as new", found: 4 })).toEqual({
      detail: { source: "Lever · acme", promptVersion: "extract-posting@1", decision: "kept as new" },
      rest: { found: 4 },
    });
  });

  it("has no detail and no rest for a step without data, and ignores fields that are not text", () => {
    expect(readStep(null)).toEqual({ detail: {}, rest: null });
    expect(readStep(undefined)).toEqual({ detail: {}, rest: null });
    expect(readStep({ source: 5, decision: { a: 1 }, found: 1 })).toEqual({ detail: {}, rest: { source: 5, decision: { a: 1 }, found: 1 } });
    expect(readStep(["not", "an", "object"])).toEqual({ detail: {}, rest: null });
  });

  it("reads what an assistant posted the same way as what the app wrote, tidying it for display", () => {
    expect(readStep({ decision: "  skipped\n(too senior)  " }).detail.decision).toBe("skipped (too senior)");
  });
});
