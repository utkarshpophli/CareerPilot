import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { noteMcpClient } from "./connect/assistants";
import { loadFrontDoor } from "./front-door-data";
import { dismissProposal, proposeStatus } from "./proposals";
import { toRunView } from "./runs-view";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
const prisma = () => db.client!;

beforeEach(() => resetDatabase(prisma()));
afterAll(() => prisma().$disconnect());

const now = new Date("2026-11-04T10:00:00Z");

describe("loadFrontDoor", () => {
  it("is all zeros on an empty database", async () => {
    const door = await loadFrontDoor({ runs: [], attention: 0, timeZone: "UTC", now });
    expect(door.applications).toMatchObject({ total: 0, sent: 0, trend: "flat" });
    expect(door.assistants).toMatchObject({ connected: 0, running: [] });
    expect(door.needsYou).toEqual({ agentDrafts: 0, attention: 0, proposals: [], proposalCount: 0, newPostings: 0, closedDrafts: { count: 0, firstId: null }, total: 0 });
  });

  it("counts applications, platforms and resume versions from real rows", async () => {
    const theme = await prisma().theme.create({ data: { name: "Ledger", headFont: "GEIST", bodyFont: "GEIST", accent: "#224466" } });
    const sent = await prisma().application.create({
      data: { title: "Engineer", status: "SCREENING", furthestStage: "SCREENING", sentAt: new Date("2026-11-03T10:00:00Z"), createdAt: new Date("2026-11-03T09:00:00Z"), postingUrl: "https://jobs.lever.co/acme/1" },
    });
    await prisma().document.create({
      data: { applicationId: sent.id, kind: "RESUME", units: [], themeId: theme.id, versions: { create: [{ units: [], cause: "WRITTEN" }, { units: [], cause: "REFINED" }] } },
    });
    await prisma().application.create({ data: { title: "Draft", createdAt: new Date("2026-11-03T12:00:00Z") } });

    const door = await loadFrontDoor({ runs: [], attention: 1, timeZone: "UTC", now });
    expect(door.applications).toMatchObject({ total: 2, drafts: 1, sent: 1 });
    expect(door.where.rows.find((row) => row.key === "lever")).toMatchObject({ applications: 1, heardBack: 1 });
    expect(door.where.rows.map((row) => row.key).sort()).toEqual(["(no link)", "lever"]);
    expect(door.resume).toMatchObject({ resumes: 1, versions: 2, revisions: 1, bestTemplate: { key: "Ledger" } });
    expect(door.needsYou.attention).toBe(1);
  });

  it("counts agent drafts waiting for review, but not them as applications", async () => {
    await prisma().application.create({ data: { title: "Waiting", awaitingReview: true, origin: "AGENT" } });
    await prisma().application.create({ data: { title: "Approved", origin: "AGENT" } });
    const door = await loadFrontDoor({ runs: [], attention: 0, timeZone: "UTC", now });
    expect(door.needsYou.agentDrafts).toBe(1);
    expect(door.applications.total).toBe(1);
  });

  it("counts the postings scans found that nobody has looked at, and not dismissed, saved, closed or copied ones", async () => {
    const row = (id: string, extra: Record<string, unknown> = {}) => ({
      source: "GREENHOUSE" as const, externalId: `acme:${id}`, companyName: "Acme", title: `Role ${id}`, url: `https://example.test/${id}`, canonicalKey: `acme_${id}`, fingerprint: id,
      firstSeenAt: now, lastSeenAt: now, ...extra,
    });
    await prisma().scannedPosting.createMany({
      data: [row("1"), row("2"), row("3", { state: "SAVED" }), row("4", { state: "DISMISSED" }), row("5", { closedAt: now }), row("6", { duplicateOfId: "x" })],
    });
    const door = await loadFrontDoor({ runs: [], attention: 0, timeZone: "UTC", now });
    expect(door.needsYou).toMatchObject({ newPostings: 2, total: 2 });
  });

  it("counts drafts whose job was found closed, and not sent, archived, unchecked or still-open ones", async () => {
    const make = (id: string, data: Record<string, unknown>) => prisma().application.create({ data: { id, title: id, ...data } });
    await make("closed-1", { postingOpen: false, createdAt: new Date("2026-11-01T00:00:00Z") });
    await make("closed-2", { postingOpen: false, createdAt: new Date("2026-11-02T00:00:00Z") });
    await make("open", { postingOpen: true });
    await make("unknown", {});
    await make("sent", { postingOpen: false, status: "SENT", sentAt: now });
    await make("archived", { postingOpen: false, archivedAt: now });
    await make("agent-draft", { postingOpen: false, awaitingReview: true });
    const door = await loadFrontDoor({ runs: [], attention: 0, timeZone: "UTC", now });
    // The newest first, as the rest of the dashboard lists them.
    expect(door.needsYou.closedDrafts).toEqual({ count: 2, firstId: "closed-2" });
  });

  it("lists the assistants' proposals waiting for the owner, and not the ones already answered", async () => {
    const waiting = await prisma().application.create({ data: { title: "Engineer at Acme" } });
    const answered = await prisma().application.create({ data: { title: "Designer at Beta" } });
    await proposeStatus(prisma(), { applicationId: waiting.id, status: "SENT", reason: "told me" }, now);
    const done = await proposeStatus(prisma(), { applicationId: answered.id, status: "OFFER", reason: "" }, now);
    await dismissProposal(prisma(), done.id, now);

    const door = await loadFrontDoor({ runs: [], attention: 0, timeZone: "UTC", now });
    expect(door.needsYou.proposalCount).toBe(1);
    expect(door.needsYou.proposals[0]).toMatchObject({ status: "SENT", reason: "told me", application: { title: "Engineer at Acme" } });
    expect(door.needsYou.total).toBe(1);
  });

  it("lists assistants and only the runs that are going now", async () => {
    await prisma().apiToken.create({ data: { name: "claude-code", tokenHash: "a".repeat(64), prefix: "cp_aaaaaa", lastUsedAt: now } });
    await noteMcpClient(prisma(), "client", "OpenCode", now);
    const going = await prisma().agentRun.create({ data: { kind: "scan", title: "Scan Berlin", actorName: "claude-code", lastStep: "Fetched 3 boards", lastActivityAt: now } });
    const done = await prisma().agentRun.create({ data: { kind: "scan", title: "Earlier", actorName: "claude-code", status: "OK" } });
    const runs = [going, done].map((run) => toRunView(run, now));

    const door = await loadFrontDoor({ runs, attention: 0, timeZone: "UTC", now });
    expect(door.assistants.connected).toBe(2);
    expect(door.assistants.shown.map((assistant) => assistant.name).sort()).toEqual(["OpenCode", "claude-code"]);
    expect(door.assistants.running).toEqual([{ id: going.id, title: "Scan Berlin", actorName: "claude-code", lastStep: "Fetched 3 boards", stalled: false }]);
  });
});
