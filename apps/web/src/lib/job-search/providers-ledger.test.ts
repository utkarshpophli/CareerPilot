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
    const done = rows.filter((row) => row.split("|")[2].trim() === "done").length;
    const dropped = rows.filter((row) => row.split("|")[2].trim() === "dropped").length;
    expect(ledger).toContain(`Totals: ${rows.length} providers; ${done} ported, ${dropped} dropped, ${rows.length - done - dropped} queued.`);
  });
});
