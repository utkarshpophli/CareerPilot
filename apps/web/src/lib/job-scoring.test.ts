import { describe, expect, it } from "vitest";

import { bandOf, SCORE_VERSION, scorePosting, type Preferences, type Scorable } from "./job-scoring";

const now = new Date("2026-11-02T12:00:00Z");

const prefs = (extra: Partial<Preferences> = {}): Preferences => ({
  titles: ["Product Designer"],
  skills: ["Figma", "User research", "Prototyping", "Design systems"],
  places: ["Berlin"],
  remote: "unknown",
  excludeKeywords: [],
  excludeCompanies: [],
  ...extra,
});

const posting = (extra: Partial<Scorable> = {}): Scorable => ({
  title: "Senior Product Designer",
  companyName: "Acme",
  location: "Berlin, Germany",
  remote: null,
  description: "You will own our design systems in Figma, run user research and build prototypes.",
  salary: null,
  postedAt: new Date("2026-10-30T00:00:00Z"),
  guardAlarm: false,
  ...extra,
});

describe("scorePosting", () => {
  it("is decided by code from the posting and the preferences, the same every time", () => {
    const a = scorePosting(posting(), prefs(), now);
    expect(a).toEqual(scorePosting(posting(), prefs(), now));
    expect(a!.version).toBe(SCORE_VERSION);
  });

  it("scores a strong match high and shows the evidence for each part", () => {
    const score = scorePosting(posting(), prefs(), now)!;
    // title 35 + skills 3 of 4 (Figma, user research, design systems; "prototypes" is not "Prototyping") of min(4,8) = 22.5 + location 20 + recency 5 of 90 applicable
    expect(score.score).toBeGreaterThanOrEqual(85);
    expect(score.band).toBe("excellent");
    expect(score.reasons.join("\n")).toMatch(/title.*Product Designer/i);
    expect(score.reasons.join("\n")).toMatch(/Figma/);
    expect(score.reasons.join("\n")).toMatch(/Berlin/);
    expect(score.redFlags).toEqual([]);
    expect(score.vetoed).toBe(false);
  });

  it("pins the weights: title 35, skills 30, place 20, pay 10, freshness 5", () => {
    const only = (extra: Partial<Preferences>, p: Partial<Scorable>) => scorePosting(posting(p), { titles: [], skills: [], places: [], remote: "unknown", excludeKeywords: [], excludeCompanies: [], ...extra }, now)!.score;
    // Each part alone is the whole of what applies, so each comes out as 100 when matched fully.
    expect(only({ titles: ["Product Designer"] }, { title: "Product Designer" })).toBe(100);
    expect(only({ skills: ["Figma"] }, { description: "We use Figma." })).toBe(100);
    expect(only({ places: ["Berlin"] }, { location: "Berlin" })).toBe(100);
    // Together: the title and the freshness earned (35 + 5), skills (30) and place (20) applied but missed, out of 90.
    const mixed = scorePosting(posting({ title: "Product Designer", description: "Nothing relevant here.", location: "Paris" }), prefs({ skills: ["Figma"] }), now)!;
    expect(mixed.score).toBe(Math.round(((35 + 5) / (35 + 30 + 20 + 5)) * 100));
  });

  it("leaves out what it has no data to judge instead of guessing", () => {
    const noPay = scorePosting(posting({ salary: null }), prefs({ minSalary: { amount: 60000, currency: "EUR" } }), now)!;
    expect(noPay.reasons.join("\n")).not.toMatch(/salary/i);
    const noDate = scorePosting(posting({ postedAt: null }), prefs(), now)!;
    expect(noDate.score).toBeGreaterThanOrEqual(85);
  });

  it("gives nothing to compare with no preferences, and says so rather than a number", () => {
    expect(scorePosting(posting(), { titles: [], skills: [], places: [], remote: "unknown", excludeKeywords: [], excludeCompanies: [] }, now)).toBeNull();
  });

  it("matches titles by phrase first, then by shared words, and not at all for a different role", () => {
    const full = scorePosting(posting({ title: "Lead Product Designer, Maps" }), prefs({ skills: [], places: [] }), now)!;
    const partial = scorePosting(posting({ title: "Product Manager" }), prefs({ skills: [], places: [] }), now)!;
    const none = scorePosting(posting({ title: "Warehouse Operative" }), prefs({ skills: [], places: [] }), now)!;
    expect(full.score).toBeGreaterThan(partial.score);
    expect(partial.score).toBeGreaterThan(none.score);
  });

  it("matches skills as whole words, not inside other words", () => {
    const score = scorePosting(posting({ title: "Cook", description: "Good Google Cargo handling", location: "Paris" }), prefs({ titles: [], skills: ["Go", "C"], places: [] }), now)!;
    expect(score.reasons.join("\n")).not.toMatch(/skill/i);
    const yes = scorePosting(posting({ title: "Cook", description: "We write Go and C daily", location: "Paris" }), prefs({ titles: [], skills: ["Go", "C"], places: [] }), now)!;
    expect(yes.reasons.join("\n")).toMatch(/Go, C|C, Go/);
    expect(scorePosting(posting({ description: "C++ and C#" }), prefs({ titles: [], places: [], skills: ["C++"] }), now)!.score).toBeGreaterThan(0);
  });

  it("treats a remote posting by what the profile says about remote work, and never invents a preference", () => {
    const remote = posting({ location: "Anywhere", remote: true });
    const unknown = scorePosting(remote, prefs({ remote: "unknown", skills: [], titles: [] }), now)!;
    const yes = scorePosting(remote, prefs({ remote: "yes", skills: [], titles: [] }), now)!;
    const no = scorePosting(remote, prefs({ remote: "no", skills: [], titles: [] }), now)!;
    expect(yes.score).toBeGreaterThan(unknown.score);
    expect(unknown.score).toBeGreaterThan(no.score);
    expect(unknown.reasons.join("\n")).toMatch(/remote.*does not say/i);
  });

  it("compares pay only when the currency is the same, and flags pay below the minimum", () => {
    const low = scorePosting(posting({ salary: { min: 40000, max: 50000, currency: "EUR" } }), prefs({ minSalary: { amount: 60000, currency: "EUR" } }), now)!;
    expect(low.redFlags.join("\n")).toMatch(/50,000.*below.*60,000/);
    const ok = scorePosting(posting({ salary: { min: 55000, max: 70000, currency: "EUR" } }), prefs({ minSalary: { amount: 60000, currency: "EUR" } }), now)!;
    expect(ok.reasons.join("\n")).toMatch(/70,000/);
    expect(ok.score).toBeGreaterThan(low.score);
    const other = scorePosting(posting({ salary: { min: 40000, max: 50000, currency: "USD" } }), prefs({ minSalary: { amount: 60000, currency: "EUR" } }), now)!;
    expect(other.redFlags).toEqual([]);
    expect(other.reasons.join("\n")).toMatch(/USD.*EUR/);
  });

  it("vetoes a posting the owner excluded, with the reason", () => {
    const word = scorePosting(posting({ description: "Must relocate. Commission only." }), prefs({ excludeKeywords: ["commission only"] }), now)!;
    expect(word).toMatchObject({ score: 0, band: "poor", vetoed: true });
    expect(word.redFlags.join("\n")).toMatch(/commission only/);
    const company = scorePosting(posting({ companyName: "Evil Corp Ltd" }), prefs({ excludeCompanies: ["evil corp"] }), now)!;
    expect(company).toMatchObject({ score: 0, vetoed: true });
  });

  it("never recommends a posting whose text tried to instruct an AI", () => {
    const score = scorePosting(posting({ guardAlarm: true }), prefs(), now)!;
    expect(score.score).toBeLessThanOrEqual(49);
    expect(score.band).toBe("poor");
    expect(score.redFlags.join("\n")).toMatch(/instruction/i);
  });

  it("scores older postings a little lower than fresh ones", () => {
    const fresh = scorePosting(posting({ postedAt: new Date("2026-11-01T00:00:00Z") }), prefs({ titles: ["Cook"] }), now)!;
    const old = scorePosting(posting({ postedAt: new Date("2026-08-01T00:00:00Z") }), prefs({ titles: ["Cook"] }), now)!;
    expect(fresh.score).toBeGreaterThan(old.score);
  });

  it("keeps reasons short and few", () => {
    const score = scorePosting(posting({ description: "Figma ".repeat(500) }), prefs(), now)!;
    expect(score.reasons.length).toBeLessThanOrEqual(6);
    expect(score.reasons.every((reason) => reason.length <= 200)).toBe(true);
  });
});

describe("bandOf", () => {
  it("puts the lines at 85, 70 and 50", () => {
    expect([100, 85, 84, 70, 69, 50, 49, 0].map(bandOf)).toEqual(["excellent", "excellent", "good", "good", "possible", "possible", "poor", "poor"]);
  });
});
