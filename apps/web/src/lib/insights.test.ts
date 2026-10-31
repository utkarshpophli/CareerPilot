import { describe, expect, it } from "vitest";

import { BASE_TEMPLATE, NO_PLATFORM, computeInsights, weekStart, type InsightApplication } from "./insights";

const now = new Date("2026-11-04T10:00:00Z"); // a Wednesday

function app(overrides: Partial<InsightApplication> & { id: string }): InsightApplication {
  return {
    title: overrides.id,
    createdAt: new Date("2026-11-03T09:00:00Z"),
    sentAt: null,
    status: "DRAFT",
    furthestStage: null,
    origin: "MANUAL",
    postingUrl: "",
    postingSource: null,
    documents: [],
    ...overrides,
  };
}

describe("weekStart", () => {
  it("is the Monday on or before the day, in UTC", () => {
    expect(weekStart(new Date("2026-11-04T10:00:00Z"))).toBe("2026-11-02");
    expect(weekStart(new Date("2026-11-02T00:00:00Z"))).toBe("2026-11-02");
    expect(weekStart(new Date("2026-11-08T23:59:00Z"))).toBe("2026-11-02");
    expect(weekStart(new Date("2026-11-09T00:00:00Z"))).toBe("2026-11-09");
  });
});

describe("computeInsights", () => {
  const applications = [
    app({ id: "a", postingUrl: "https://jobs.lever.co/x/1", sentAt: new Date("2026-11-03T10:00:00Z"), status: "INTERVIEW", furthestStage: "INTERVIEW" }),
    app({ id: "b", postingUrl: "https://jobs.lever.co/y/2", sentAt: new Date("2026-10-27T10:00:00Z"), status: "REJECTED", furthestStage: "SENT" }),
    app({ id: "c", postingUrl: "https://boards.greenhouse.io/z/3", sentAt: new Date("2026-10-28T10:00:00Z"), status: "OFFER", furthestStage: "OFFER", origin: "AGENT" }),
    app({ id: "d", status: "DRAFT" }),
  ];

  it("counts the funnel overall", () => {
    const { totals } = computeInsights(applications, now);
    expect(totals).toMatchObject({ applications: 4, sent: 3, heardBack: 2, interviews: 2, offers: 1, drafts: 1, byAgent: 1 });
    expect(totals.replyRate).toBeCloseTo(2 / 3);
  });

  it("groups by platform, busiest first, with reply rates", () => {
    const { byPlatform } = computeInsights(applications, now);
    expect(byPlatform.map((row) => [row.key, row.applications, row.sent, row.heardBack])).toEqual([
      ["lever", 2, 2, 1],
      [NO_PLATFORM, 1, 0, 0],
      ["greenhouse", 1, 1, 1],
    ].sort((a, b) => (b[1] as number) - (a[1] as number) || String(a[0]).localeCompare(String(b[0]))));
    expect(byPlatform.find((row) => row.key === "lever")?.replyRate).toBe(0.5);
    expect(byPlatform.find((row) => row.key === NO_PLATFORM)?.replyRate).toBeNull();
  });

  it("counts resume revisions after the first draft, not the first draft", () => {
    const withDocuments = [
      app({
        id: "r1",
        title: "Engineer",
        documents: [
          { kind: "RESUME", themeName: "Ledger", versionCauses: ["WRITTEN", "REGENERATED", "REFINED", "REFINED"] },
          { kind: "COVER_LETTER", themeName: "Ledger", versionCauses: ["WRITTEN", "REFINED"] },
        ],
      }),
      app({ id: "r2", title: "Designer", documents: [{ kind: "RESUME", themeName: null, versionCauses: ["WRITTEN"] }] }),
    ];
    const { resume } = computeInsights(withDocuments, now);
    expect(resume.revisions).toBe(3);
    expect(resume.perApplication).toBe(1.5);
    expect(resume.byCause).toEqual({ REGENERATED: 1, REFINED: 2 });
    expect(resume.mostRevised).toEqual([{ applicationId: "r1", title: "Engineer", revisions: 3 }]);
  });

  it("groups by resume template, falling back to the base theme", () => {
    const rows = computeInsights(
      [
        app({ id: "t1", documents: [{ kind: "RESUME", themeName: "Ledger", versionCauses: [] }] }),
        app({ id: "t2", documents: [{ kind: "RESUME", themeName: "Ledger", versionCauses: [] }] }),
        app({ id: "t3", documents: [{ kind: "RESUME", themeName: null, versionCauses: [] }] }),
        app({ id: "t4", documents: [{ kind: "COVER_LETTER", themeName: "Other", versionCauses: [] }] }),
      ],
      now,
    ).byTemplate;
    expect(rows.map((row) => [row.key, row.applications])).toEqual([["Ledger", 2], [BASE_TEMPLATE, 1]]);
  });

  it("buckets created and sent per week over the last twelve weeks", () => {
    const { weekly } = computeInsights(applications, now);
    expect(weekly).toHaveLength(12);
    expect(weekly.at(-1)).toEqual({ weekStart: "2026-11-02", created: 4, sent: 1 });
    expect(weekly.at(-2)).toEqual({ weekStart: "2026-10-26", created: 0, sent: 2 });
  });

  it("is all zeros with nothing to count", () => {
    const insights = computeInsights([], now);
    expect(insights.totals).toMatchObject({ applications: 0, sent: 0, replyRate: null });
    expect(insights.resume).toMatchObject({ revisions: 0, perApplication: 0, mostRevised: [] });
    expect(insights.byPlatform).toEqual([]);
  });
});
