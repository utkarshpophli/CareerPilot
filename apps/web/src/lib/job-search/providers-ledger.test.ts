import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// M4c's count must add up: every career-ops provider module is on the ledger exactly once.
const root = path.join(__dirname, "../../../../..");
const upstream = readdirSync(path.join(root, "upstream/career-ops/providers"))
  .filter((file) => file.endsWith(".mjs") && !file.startsWith("_"))
  .map((file) => file.slice(0, -4))
  .sort();
const ledger = readFileSync(path.join(root, "docs/sources/career-ops-providers.md"), "utf8").replace(/\r\n/g, "\n");
const rows = ledger.split("\n").filter((line) => /^\| [a-z0-9-]+ \|/.test(line) && !line.startsWith("| Provider"));

describe("career-ops provider ledger", () => {
  it("lists every upstream provider once, and nothing else", () => {
    expect(rows.map((row) => row.split("|")[1].trim()).sort()).toEqual(upstream);
  });

  it("has a verdict file for every provider it calls ported", () => {
    for (const row of rows) {
      const [, name, batch, , verdict] = row.split("|").map((cell) => cell.trim());
      if (batch !== "done") continue;
      if (verdict === "n/a") continue;
      expect(readFileSync(path.join(root, verdict), "utf8"), name).toContain("Verdict");
    }
  });

  it("states totals that match the rows", () => {
    const cells = rows.map((row) => row.split("|").map((cell) => cell.trim()));
    const count = (test: (batch: string, status: string) => boolean) => cells.filter(([, , batch, status]) => test(batch, status)).length;
    const ported = count((batch) => batch === "done");
    const dropped = count((batch) => batch === "dropped");
    const deferred = count((batch) => batch === "deferred");
    const written = count((batch, status) => status.startsWith("verdict written"));
    const queued = rows.length - ported - dropped - deferred - written;
    expect(ledger).toContain(`Totals: ${rows.length} providers; ${ported} ported, ${written} verdict written, ${dropped} dropped, ${deferred} deferred, ${queued} queued.`);
  });

  it("has a verdict file for every provider with a verdict, dropped or deferred", () => {
    for (const row of rows) {
      const [, name, batch, status, verdict] = row.split("|").map((cell) => cell.trim());
      if (!(batch === "dropped" || batch === "deferred" || status.startsWith("verdict written"))) continue;
      const file = /\(([^)]+\.md)\)/.exec(verdict)?.[1];
      expect(file, name).toBeTruthy();
      expect(readFileSync(path.join(root, "docs/sources", file!), "utf8"), name).toMatch(/\*\*Verdict: /);
    }
  });
});
