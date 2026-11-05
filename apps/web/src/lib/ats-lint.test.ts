import { describe, expect, it } from "vitest";

import type { Unit } from "./application-data";
import { atsSummary, cleanText, cleanUnits, lintUnits } from "./ats-lint";

const unit = (id: string, text: string): Unit => ({ id, label: id, text });

describe("making text safe for applicant-tracking parsers", () => {
  it("replaces the characters parsers drop or garble, and nothing else", () => {
    expect(cleanText("Led a team — 2019–2022 “quoted” it’s…")).toBe("Led a team - 2019-2022 \"quoted\" it's...");
    expect(cleanText("a​b﻿c d e f")).toBe("abc d e f");
    expect(cleanText("Plan → ship → learn")).toBe("Plan to ship to learn");
    expect(cleanText("Shipped **three** products")).toBe("Shipped three products");
  });

  it("leaves ordinary text, accents, symbols and non-Latin scripts alone", () => {
    const text = "Café Zürich €75k · 日本語 snake_case a_b 50%";
    expect(cleanText(text)).toBe(text);
  });

  it("returns new units and keeps the untouched ones as they were", () => {
    const units = [unit("summary", "Plan — do"), unit("skills", "Figma, Sketch")];
    const cleaned = cleanUnits(units);
    expect(cleaned.units).not.toBe(units);
    expect(cleaned.units[0]!.text).toBe("Plan - do");
    expect(cleaned.units[1]).toBe(units[1]);
    expect(units[0]!.text).toBe("Plan — do");
    expect(cleaned).toMatchObject({ changed: 1, unitIds: ["summary"] });
  });

  it("reports nothing changed for clean text", () => {
    const units = [unit("summary", "Plain text.")];
    expect(cleanUnits(units)).toMatchObject({ changed: 0, unitIds: [] });
  });
});

describe("what the lint finds", () => {
  it("counts each fixable problem, across units, and says where", () => {
    const findings = lintUnits([unit("summary", "A — B — C"), unit("experience:1", "x — y\n“q”"), unit("skills", "ok")]);
    const dash = findings.find((finding) => finding.rule === "em-dash")!;
    expect(dash).toMatchObject({ count: 3, fixable: true, unitIds: ["summary", "experience:1"] });
    expect(dash.message).toBe("3 long dashes (—)");
    expect(findings.find((finding) => finding.rule === "smart-double-quote")).toMatchObject({ count: 2, message: "2 curly double quotes" });
  });

  it("warns, without a fix, about a bullet or summary too long to scan", () => {
    const long = "word ".repeat(60).trim();
    const findings = lintUnits([unit("summary", "word ".repeat(150)), unit("experience:1", `short\n${long}`)]);
    expect(findings.find((finding) => finding.rule === "long-summary")).toMatchObject({ fixable: false, unitIds: ["summary"] });
    expect(findings.find((finding) => finding.rule === "long-bullet")).toMatchObject({ fixable: false, count: 1, unitIds: ["experience:1"] });
  });

  it("finds nothing in clean text", () => {
    expect(lintUnits([unit("summary", "Designer who ships calm products.")])).toEqual([]);
  });

  it("summarises for a notice", () => {
    expect(atsSummary(lintUnits([unit("a", "x — y “z”")]))).toEqual({ fixable: 3, notes: 0 });
  });
});
