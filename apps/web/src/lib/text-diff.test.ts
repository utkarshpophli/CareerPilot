import { describe, expect, it } from "vitest";

import type { Unit } from "./application-data";
import { diffUnits, diffWords, hasChanges } from "./text-diff";

const unit = (id: string, text: string, label = id): Unit => ({ id, label, text });

describe("diffing words", () => {
  it("returns one unchanged piece for equal text", () => {
    expect(diffWords("same words", "same words")).toEqual([{ type: "same", text: "same words" }]);
  });

  it("marks removed and added words and keeps the rest", () => {
    expect(diffWords("Led a small team", "Led a large team")).toEqual([
      { type: "same", text: "Led a " },
      { type: "del", text: "small" },
      { type: "add", text: "large" },
      { type: "same", text: " team" },
    ]);
  });

  it("handles added and removed text at the ends, and empty sides", () => {
    expect(diffWords("", "new")).toEqual([{ type: "add", text: "new" }]);
    expect(diffWords("old", "")).toEqual([{ type: "del", text: "old" }]);
    expect(diffWords("b", "a b c")).toEqual([
      { type: "add", text: "a " },
      { type: "same", text: "b" },
      { type: "add", text: " c" },
    ]);
  });

  it("keeps line breaks, so bullets stay separate", () => {
    const parts = diffWords("one\ntwo", "one\nthree");
    expect(parts.map((part) => part.text).join("")).toContain("\n");
    expect(parts.filter((part) => part.type === "add").map((part) => part.text)).toEqual(["three"]);
  });

  it("does not take long unrelated texts for ever", () => {
    const a = Array.from({ length: 3000 }, (_, index) => `a${index}`).join(" ");
    const b = Array.from({ length: 3000 }, (_, index) => `b${index}`).join(" ");
    const started = performance.now();
    const parts = diffWords(a, b);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(parts.map((part) => part.text).join("")).toContain("a0");
  });
});

describe("diffing a document's units", () => {
  it("says which parts were added, removed, changed or left alone, in the newer order", () => {
    const before = [unit("summary", "designer", "Summary"), unit("skills", "Figma"), unit("old", "Gone", "Old role")];
    const after = [unit("summary", "Senior designer", "Summary"), unit("skills", "Figma"), unit("new", "Fresh", "New role")];
    const changes = diffUnits(before, after);
    expect(changes.map((change) => [change.id, change.kind])).toEqual([["summary", "changed"], ["skills", "same"], ["new", "added"], ["old", "removed"]]);
    expect(changes[0]!.parts).toEqual([{ type: "add", text: "Senior " }, { type: "same", text: "designer" }]);
    expect(changes[2]).toMatchObject({ label: "New role", parts: [{ type: "add", text: "Fresh" }] });
    expect(changes[3]).toMatchObject({ label: "Old role", parts: [{ type: "del", text: "Gone" }] });
  });

  it("knows when nothing changed", () => {
    const units = [unit("a", "x")];
    expect(hasChanges(diffUnits(units, units))).toBe(false);
    expect(hasChanges(diffUnits(units, [unit("a", "y")]))).toBe(true);
  });
});
