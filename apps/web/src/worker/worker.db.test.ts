import { PgBoss } from "pg-boss";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { BoardAdapter, BoardPosting, BoardSource } from "@/lib/job-search/boards";
import { enqueueBoardScans } from "@/lib/queue/enqueue";
import { QUEUES } from "@/lib/queue/queues";
import { addCompany } from "@/lib/services/companies";
import { createTestClient, resetDatabase, testDatabaseUrl } from "@/test/db";

import { handleBoardScan, handleLivenessCheck, handleLivenessSweep, handleProposalPrune, handleScanAll, startWorker } from "./worker";

const db = createTestClient();
const schema = `queue_test_${process.pid}`;
const newBoss = () => new PgBoss({ connectionString: testDatabaseUrl(), schema, max: 3 });
beforeEach(() => resetDatabase(db));
afterAll(async () => {
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
});

const posting = (slug: string, id: string, title: string): BoardPosting => ({
  source: "GREENHOUSE", externalId: `${slug}:${id}`, title, company: slug, location: "Berlin", remote: null,
  url: `https://example.test/${slug}/${id}`, description: "Design systems in Figma.", postedAt: null, salary: null,
});
const adapters = (boards: Record<string, BoardPosting[]>) => ((source: string) => ({ source, name: source, hosts: [], refFrom: () => null, fetchBoard: async (ref: { slug: string }) => boards[ref.slug] ?? [] })) as unknown as (s: BoardSource) => BoardAdapter;
const deps = (boards: Record<string, BoardPosting[]> = {}) => ({ db, preferences: async () => undefined, adapters: adapters(boards) });

async function until<T>(read: () => Promise<T | null | undefined | false>, ms = 15_000): Promise<T> {
  const stop = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > stop) throw new Error("timed out waiting");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe("handleBoardScan", () => {
  it("scans the board and writes one ledger line as the scheduler", async () => {
    const acme = await addCompany(db, { source: "GREENHOUSE", board: "acme", name: "Acme" });
    await handleBoardScan(deps({ acme: [posting("acme", "1", "Designer")] }), { companyId: acme.id });
    expect(await db.scannedPosting.count({ where: { companyId: acme.id } })).toBe(1);
    const events = await db.activityEvent.findMany({ where: { action: "boards.scanned" } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorKind: "SCHEDULER", actorName: "worker", targetId: acme.id });
    expect(events[0]!.summary).toBe("Scanned Acme: 1 postings (1 new, 0 closed)");
  });

  it("does nothing for a company that is gone", async () => {
    await handleBoardScan(deps(), { companyId: "missing" });
    expect(await db.activityEvent.count()).toBe(0);
  });
});

describe("handleScanAll", () => {
  it("queues every enabled board, once each", async () => {
    const a = await addCompany(db, { source: "GREENHOUSE", board: "a", name: "A" });
    const b = await addCompany(db, { source: "GREENHOUSE", board: "b", name: "B" });
    const off = await addCompany(db, { source: "GREENHOUSE", board: "c", name: "C" });
    await db.trackedCompany.update({ where: { id: off.id }, data: { enabled: false } });
    const sent: { name: string; data: unknown; options: { singletonKey?: string } }[] = [];
    const boss = { send: async (name: string, data: object, options: { singletonKey?: string }) => (sent.push({ name, data, options }), "id") };
    expect(await handleScanAll({ db }, boss as never)).toEqual({ queued: 2, alreadyWaiting: 0 });
    expect(sent.map((job) => job.options.singletonKey).sort()).toEqual([a.id, b.id].sort());
    expect(sent.every((job) => job.name === QUEUES.boardScan)).toBe(true);
  });
});

describe("the queue, with a real worker", () => {
  it("runs a queued scan, refuses a duplicate while one waits, and leaves a heartbeat while it runs", async () => {
    const acme = await addCompany(db, { source: "GREENHOUSE", board: "acme", name: "Acme" });
    const worker = newBoss();
    const client = newBoss();
    const running = await startWorker(worker, deps({ acme: [posting("acme", "1", "Designer"), posting("acme", "2", "Cook")] }), { name: "test-worker", version: "0", pollSeconds: 1 });
    try {
      expect(await until(() => db.workerHeartbeat.findUnique({ where: { id: "test-worker" } }))).toMatchObject({ version: "0" });
      await client.start();
      // Two presses of Scan now: the second finds one already waiting (or already taken, in which case it is a new job).
      const first = await enqueueBoardScans(client, [acme.id]);
      expect(first.queued).toBe(1);
      await until(async () => (await db.trackedCompany.findUniqueOrThrow({ where: { id: acme.id } })).lastOkAt);
      expect(await db.scannedPosting.count({ where: { companyId: acme.id } })).toBe(2);
      expect((await db.activityEvent.findMany({ where: { action: "boards.scanned" } }))[0]).toMatchObject({ actorKind: "SCHEDULER" });
    } finally {
      await client.stop({ graceful: true, timeout: 2000 });
      await running.stop();
    }
    expect(await db.workerHeartbeat.count()).toBe(0);
  }, 40_000);

  it("refuses to queue a board that already has a job waiting", async () => {
    const acme = await addCompany(db, { source: "GREENHOUSE", board: "acme", name: "Acme" });
    // A client with no worker: nothing takes the job, so the second send meets the first.
    const worker = newBoss();
    const running = await startWorker(worker, deps(), { name: "dedupe-worker", version: "0", pollSeconds: 600 });
    await running.stop();
    const client = newBoss();
    await client.start();
    try {
      expect(await enqueueBoardScans(client, [acme.id])).toEqual({ queued: 1, alreadyWaiting: 0 });
      expect(await enqueueBoardScans(client, [acme.id])).toEqual({ queued: 0, alreadyWaiting: 1 });
    } finally {
      await client.stop({ graceful: true, timeout: 2000 });
    }
  }, 40_000);
});

describe("handleLivenessCheck", () => {
  it("checks the application's job and keeps the answer on it", async () => {
    await db.application.create({ data: { id: "lv1", title: "Designer", postingUrl: "https://example.test/jobs/1" } });
    await handleLivenessCheck(deps(), { applicationId: "lv1" });
    const app = await db.application.findUniqueOrThrow({ where: { id: "lv1" } });
    expect(app.postingCheckedAt).toBeInstanceOf(Date);
    expect(app.postingOpen).toBeNull(); // a link nobody can read: "can't tell", never "closed"
  });

  it("does nothing for an application that is gone", async () => {
    await expect(handleLivenessCheck(deps(), { applicationId: "missing" })).resolves.toBeUndefined();
  });
});

describe("handleLivenessSweep", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const make = (id: string, data: Record<string, unknown>) => db.application.create({ data: { id, title: id, postingUrl: "https://example.test/jobs/" + id, ...data } });

  it("queues the drafts never checked or last checked over a day ago, and not the rest", async () => {
    await make("never", {});
    await make("stale", { postingCheckedAt: new Date("2026-11-03T12:00:00Z") });
    await make("fresh", { postingCheckedAt: new Date("2026-11-05T06:00:00Z") });
    await make("sent", { status: "SENT", sentAt: now });
    await make("archived", { archivedAt: now });
    await make("agent-draft", { awaitingReview: true });
    await make("no-link", { postingUrl: "" });
    const sent: { name: string; options: { singletonKey?: string } }[] = [];
    const boss = { send: async (name: string, _data: object, options: { singletonKey?: string }) => (sent.push({ name, options }), "id") };
    expect(await handleLivenessSweep({ db }, boss as never, now)).toEqual({ queued: 2, alreadyWaiting: 0 });
    expect(sent.map((job) => job.options.singletonKey).sort()).toEqual(["never", "stale"]);
    expect(sent.every((job) => job.name === "liveness-check")).toBe(true);
  });
});

describe("handleProposalPrune", () => {
  it("deletes proposals that finished or expired long ago and keeps the rest", async () => {
    await db.application.create({ data: { id: "pp", title: "App" } });
    const base = { applicationId: "pp", status: "SENT" as const, reason: "r", actorKind: "CLI" as const, actorName: "x" };
    const old = new Date("2026-06-01T00:00:00Z");
    await db.statusProposal.create({ data: { ...base, state: "PENDING", createdAt: old, expiresAt: new Date("2026-06-15T00:00:00Z") } });
    await db.statusProposal.create({ data: { ...base, state: "CONFIRMED", createdAt: old, expiresAt: new Date("2026-11-20T00:00:00Z"), resolvedAt: new Date("2026-06-02T00:00:00Z") } });
    await db.statusProposal.create({ data: { ...base, state: "PENDING", createdAt: new Date("2026-11-04T00:00:00Z"), expiresAt: new Date("2026-11-18T00:00:00Z") } });
    expect(await handleProposalPrune({ db }, new Date("2026-11-05T12:00:00Z"))).toBe(2);
    expect(await db.statusProposal.count()).toBe(1);
  });
});

describe("the worker's schedules", () => {
  it("schedules the daily prune always, and the liveness sweep only when asked", async () => {
    const worker = newBoss();
    const running = await startWorker(worker, deps(), { name: "sched-worker", version: "0", pollSeconds: 600, livenessSchedule: "30 5 * * *" });
    const peek = newBoss();
    await peek.start();
    try {
      const names = (await peek.getSchedules()).map((schedule) => `${schedule.name} ${schedule.cron}`).sort();
      expect(names).toEqual(["liveness-sweep 30 5 * * *", "proposal-prune 17 3 * * *"]);
    } finally {
      await peek.stop({ graceful: true, timeout: 2000 });
      await running.stop();
    }
    const again = await startWorker(newBoss(), deps(), { name: "sched-worker-2", version: "0", pollSeconds: 600 });
    const peek2 = newBoss();
    await peek2.start();
    try {
      expect((await peek2.getSchedules()).map((schedule) => schedule.name)).toEqual(["proposal-prune"]);
    } finally {
      await peek2.stop({ graceful: true, timeout: 2000 });
      await again.stop();
    }
  }, 40_000);
});
