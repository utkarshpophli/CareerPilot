import type { Unit } from "./application-data";

// The ATS check (M7.3): characters that applicant-tracking parsers and PDF text extractors drop or garble, and
// text too long to scan. The replacements are the ones career-ops (MIT, Santiago Fernández de Valderrama) makes
// in generate-pdf.mjs, normalizeTextForATS; here they are reported first and applied only when the owner asks, as
// a version that can be restored. Pure: it reads text and returns text.

type Fix = {
  id: string;
  /** "3 long dashes (—)" for a count. */
  message: (count: number) => string;
  pattern: RegExp;
  replace: string | ((match: string) => string);
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const FIXES: readonly Fix[] = [
  { id: "em-dash", message: (n) => `${plural(n, "long dash", "long dashes")} (—)`, pattern: /—/g, replace: "-" },
  { id: "en-dash", message: (n) => `${plural(n, "en dash", "en dashes")} (–)`, pattern: /–/g, replace: "-" },
  { id: "smart-double-quote", message: (n) => plural(n, "curly double quote", "curly double quotes"), pattern: /[“”„‟]/g, replace: '"' },
  { id: "smart-single-quote", message: (n) => plural(n, "curly single quote or apostrophe", "curly single quotes or apostrophes"), pattern: /[‘’‚‛]/g, replace: "'" },
  { id: "ellipsis", message: (n) => plural(n, "ellipsis character", "ellipsis characters"), pattern: /…/g, replace: "..." },
  { id: "zero-width", message: (n) => plural(n, "invisible character", "invisible characters"), pattern: /[​‌‍⁠﻿]/g, replace: "" },
  { id: "nbsp", message: (n) => plural(n, "non-breaking space", "non-breaking spaces"), pattern: /[  ]/g, replace: " " },
  { id: "right-arrow", message: (n) => plural(n, "arrow (→)", "arrows (→)"), pattern: /\s*→\s*/g, replace: " to " },
  { id: "markdown-bold", message: (n) => plural(n, "**bold** mark shown as stars", "**bold** marks shown as stars"), pattern: /\*\*([^*\n]+?)\*\*/g, replace: (match) => match.slice(2, -2) },
];

/** A bullet longer than this is hard to scan, for a person or a parser. */
export const LONG_BULLET = 240;
/** A summary longer than this stops being a summary. */
export const LONG_SUMMARY = 700;

export type AtsFinding = {
  rule: string;
  message: string;
  count: number;
  /** The units it was found in, in reading order. */
  unitIds: string[];
  /** True when "Make ATS-safe" fixes it; false when only the owner can (shorten it). */
  fixable: boolean;
};

const countOf = (text: string, pattern: RegExp) => [...text.matchAll(new RegExp(pattern.source, pattern.flags))].length;

/** `text` with every fixable character replaced. */
export function cleanText(text: string): string {
  let result = text;
  for (const fix of FIXES) result = result.replace(new RegExp(fix.pattern.source, fix.pattern.flags), fix.replace as string);
  return result;
}

/** The units with their text cleaned; units that needed nothing are the same objects. */
export function cleanUnits(units: Unit[]): { units: Unit[]; changed: number; unitIds: string[] } {
  const unitIds: string[] = [];
  const cleaned = units.map((unit) => {
    const text = cleanText(unit.text);
    if (text === unit.text) return unit;
    unitIds.push(unit.id);
    return { ...unit, text };
  });
  return { units: cleaned, changed: unitIds.length, unitIds };
}

/** What is wrong with the units for an ATS, the fixable ones first. Nothing for clean text. */
export function lintUnits(units: Unit[]): AtsFinding[] {
  const findings: AtsFinding[] = [];
  for (const fix of FIXES) {
    let count = 0;
    const unitIds: string[] = [];
    for (const unit of units) {
      const found = countOf(unit.text, fix.pattern);
      if (found === 0) continue;
      count += found;
      unitIds.push(unit.id);
    }
    if (count > 0) findings.push({ rule: fix.id, message: fix.message(count), count, unitIds, fixable: true });
  }

  const summary = units.find((unit) => unit.id === "summary");
  if (summary && summary.text.trim().length > LONG_SUMMARY) {
    findings.push({ rule: "long-summary", message: `The summary is ${summary.text.trim().length} characters; under ${LONG_SUMMARY} reads better`, count: 1, unitIds: [summary.id], fixable: false });
  }
  let long = 0;
  const longIn: string[] = [];
  for (const unit of units) {
    if (unit.id === "summary") continue;
    const lines = unit.text.split("\n").filter((line) => line.trim().length > LONG_BULLET).length;
    if (lines === 0) continue;
    long += lines;
    longIn.push(unit.id);
  }
  if (long > 0) findings.push({ rule: "long-bullet", message: `${plural(long, "bullet is", "bullets are")} over ${LONG_BULLET} characters`, count: long, unitIds: longIn, fixable: false });
  return findings;
}

/** The numbers a notice shows: how many things "Make ATS-safe" would fix, and how many only the owner can. */
export function atsSummary(findings: AtsFinding[]): { fixable: number; notes: number } {
  return {
    fixable: findings.filter((finding) => finding.fixable).reduce((sum, finding) => sum + finding.count, 0),
    notes: findings.filter((finding) => !finding.fixable).length,
  };
}
