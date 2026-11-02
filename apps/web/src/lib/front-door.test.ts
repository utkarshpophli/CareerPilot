import { describe, expect, it } from "vitest";

import type { ConnectedAssistant } from "./connect/assistants";
import { computeFrontDoor } from "./front-door";
import { computeInsights, type InsightApplication } from "./insights";

const now = new Date("2026-11-04T10:00:00Z"); // a Wednesday; this week starts Monday 2 Nov

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

const assistant = (overrides: Partial<ConnectedAssistant>): ConnectedAssistant => ({
  key: "token:1",
  via: "token",
  id: "1",
  name: "claude-code",
  scope: "WRITE",
  lastSeenAt: "2026-11-04T09:00:00.000Z",
  callsToday: 2,
  runs: 1,
  revokable: true,
  ...overrides,
});

const base = { assistants: [] as ConnectedAssistant[], running: [], agentDrafts: 0, attention: 0 };
const door = (apps: InsightApplication[], extra: Partial<Parameters<typeof computeFrontDoor>[0]> = {}) => computeFrontDoor({ insights: computeInsights(apps, now), ...base, ...extra });

describe("with nothing at all", () => {
  const empty = door([]);

  it("is zeros and honest empties, never NaN", () => {
    expect(empty.applications).toMatchObject({ total: 0, drafts: 0, sent: 0, thisWeek: { started: 0, sent: 0 }, trend: "flat" });
    expect(empty.where).toEqual({ rows: [], more: 0 });
    expect(empty.resume).toMatchObject({ resumes: 0, versions: 0, revisions: 0, perApplication: 0, templates: [], bestTemplate: null });
    expect(empty.assistants).toMatchObject({ connected: 0, shown: [], more: 0, running: [], callsToday: 0, runs: 0 });
    expect(empty.needsYou).toEqual({ agentDrafts: 0, attention: 0, total: 0 });
  });
});

describe("applications", () => {
  it("counts drafted against sent and this week, with the last weeks for a sparkline", () => {
    const front = door([
      app({ id: "a", sentAt: new Date("2026-11-03T10:00:00Z"), status: "SENT", furthestStage: "SENT" }), // this week
      app({ id: "b", createdAt: new Date("2026-10-28T10:00:00Z"), sentAt: new Date("2026-10-28T11:00:00Z"), status: "SENT", furthestStage: "SENT" }), // last week
      app({ id: "c" }), // a draft, started this week
    ]);
    expect(front.applications).toMatchObject({ total: 3, drafts: 1, sent: 2, thisWeek: { started: 2, sent: 1 } });
    expect(front.applications.weeks).toHaveLength(8);
    expect(front.applications.weeks.at(-1)).toEqual({ weekStart: "2026-11-02", started: 2, sent: 1 });
    expect(front.applications.weeks.at(-2)).toEqual({ weekStart: "2026-10-26", started: 1, sent: 1 });
  });

  it("says up, down or flat by comparing this week's sent with last week's", () => {
    const sentIn = (id: string, day: string) => app({ id, createdAt: new Date(day), sentAt: new Date(day), status: "SENT", furthestStage: "SENT" });
    expect(door([sentIn("a", "2026-11-03T10:00:00Z"), sentIn("b", "2026-11-03T11:00:00Z"), sentIn("c", "2026-10-28T10:00:00Z")]).applications.trend).toBe("up");
    expect(door([sentIn("a", "2026-11-03T10:00:00Z"), sentIn("b", "2026-10-28T11:00:00Z"), sentIn("c", "2026-10-29T10:00:00Z")]).applications.trend).toBe("down");
    expect(door([sentIn("a", "2026-11-03T10:00:00Z"), sentIn("b", "2026-10-28T11:00:00Z")]).applications.trend).toBe("flat");
  });
});

describe("where", () => {
  const site = (id: string, host: string, sent = true, reply = false) =>
    app({
      id,
      postingUrl: `https://${host}/jobs/${id}`,
      sentAt: sent ? new Date("2026-11-03T10:00:00Z") : null,
      status: reply ? "SCREENING" : sent ? "SENT" : "DRAFT",
      furthestStage: reply ? "SCREENING" : sent ? "SENT" : null,
    });

  it("lists the five busiest platforms with reply rates and says how many more there are", () => {
    const apps = [
      ...["a1", "a2", "a3"].map((id) => site(id, "jobs.lever.co")),
      ...["b1", "b2"].map((id, index) => site(id, "boards.greenhouse.io", true, index === 0)),
      site("c1", "www.linkedin.com"),
      site("d1", "jobs.ashbyhq.com"),
      site("e1", "careers.acme.com"),
      site("f1", "careers.other.io"),
      site("g1", "careers.third.dev"),
    ];
    const { where } = door(apps);
    expect(where.rows).toHaveLength(5);
    expect(where.rows[0]).toMatchObject({ key: "lever", applications: 3 });
    expect(where.rows[1]).toMatchObject({ key: "greenhouse", applications: 2, heardBack: 1, replyRate: 0.5 });
    expect(where.more).toBe(2);
  });
});

describe("resume", () => {
  const withResume = (id: string, theme: string | null, causes: InsightApplication["documents"][number]["versionCauses"], reply = false) =>
    app({
      id,
      sentAt: new Date("2026-11-03T10:00:00Z"),
      status: reply ? "SCREENING" : "SENT",
      furthestStage: reply ? "SCREENING" : "SENT",
      documents: [{ kind: "RESUME", themeName: theme, versionCauses: causes }],
    });

  it("counts versions and revisions, in total and per application", () => {
    const { resume } = door([withResume("a", "Ledger", ["WRITTEN", "REFINED", "REFINED"]), withResume("b", "Editorial", ["WRITTEN"])]);
    expect(resume).toMatchObject({ resumes: 2, versions: 4, revisions: 2, perApplication: 1 });
  });

  it("lists the templates used, busiest first, three at most, and names the one with the most replies", () => {
    const { resume } = door([
      withResume("a", "Ledger", ["WRITTEN"], false),
      withResume("b", "Ledger", ["WRITTEN"], false),
      withResume("c", "Ledger", ["WRITTEN"], true),
      withResume("d", "Editorial", ["WRITTEN"], true),
      withResume("e", "Editorial", ["WRITTEN"], true),
      withResume("f", "Modern", ["WRITTEN"], false),
      withResume("g", null, ["WRITTEN"], false),
    ]);
    expect(resume.templates.map((row) => row.key)).toEqual(["Ledger", "Editorial", "Base theme"]);
    expect(resume.moreTemplates).toBe(1);
    expect(resume.bestTemplate).toMatchObject({ key: "Editorial", heardBack: 2, sent: 2 });
  });

  it("breaks a tie on replies by the better reply rate, and names none when nothing was answered", () => {
    const tie = door([withResume("a", "Ledger", ["WRITTEN"], true), withResume("b", "Ledger", ["WRITTEN"], false), withResume("c", "Editorial", ["WRITTEN"], true)]);
    expect(tie.resume.bestTemplate?.key).toBe("Editorial");
    expect(door([withResume("a", "Ledger", ["WRITTEN"], false)]).resume.bestTemplate).toBeNull();
  });
});

describe("assistants", () => {
  it("shows the three most recently seen, how many more, and today's totals", () => {
    const list = ["a", "b", "c", "d"].map((name, index) => assistant({ key: `token:${name}`, id: name, name, callsToday: index + 1, runs: 1, lastSeenAt: `2026-11-04T0${9 - index}:00:00.000Z` }));
    const { assistants } = door([], { assistants: list });
    expect(assistants.connected).toBe(4);
    expect(assistants.shown.map((a) => a.name)).toEqual(["a", "b", "c"]);
    expect(assistants.more).toBe(1);
    expect(assistants.callsToday).toBe(10);
    expect(assistants.runs).toBe(4);
  });

  it("lists what is running now, stalled ones marked", () => {
    const { assistants } = door([], {
      running: [
        { id: "r1", title: "Scan Berlin", actorName: "claude-code", lastStep: "Fetched 3 boards", stalled: false },
        { id: "r2", title: "Old", actorName: "opencode", lastStep: "", stalled: true },
      ],
    });
    expect(assistants.running).toEqual([
      { id: "r1", title: "Scan Berlin", actorName: "claude-code", lastStep: "Fetched 3 boards", stalled: false },
      { id: "r2", title: "Old", actorName: "opencode", lastStep: "", stalled: true },
    ]);
  });
});

describe("needs you", () => {
  it("adds agent drafts waiting for review to the things worth a look", () => {
    expect(door([], { agentDrafts: 2, attention: 3 }).needsYou).toEqual({ agentDrafts: 2, attention: 3, total: 5 });
  });
});
