import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { runAsActor } from "./ledger";
import { addRunStep, finishRun, getRun, isStale, listRuns, RunStateError, startRun, STALE_AFTER_MS } from "./runs";

const db = createTestClient();

beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

const agent = { kind: "CLI", name: "claude-code" } as const;

describe("startRun", () => {
  it("opens a RUNNING run for the acting client and writes run.started", async () => {
    const run = await runAsActor(agent, () => startRun(db, { kind: "scan", title: "Daily scan" }));
    expect(run).toMatchObject({ kind: "scan", title: "Daily scan", status: "RUNNING", stepCount: 0, actorKind: "CLI", actorName: "claude-code" });
    const events = await db.activityEvent.findMany({ where: { runId: run.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "run.started", actorName: "claude-code", targetType: "run", targetId: run.id });
  });

  it("returns the same run for the same idempotency key, without a second event", async () => {
    const first = await startRun(db, { kind: "scan", title: "A", idempotencyKey: "key-1" });
    const second = await startRun(db, { kind: "scan", title: "A", idempotencyKey: "key-1" });
    expect(second.id).toBe(first.id);
    expect(await db.agentRun.count()).toBe(1);
    expect(await db.activityEvent.count()).toBe(1);
  });

  it("keeps the kind and title short and non-empty", async () => {
    const run = await startRun(db, { kind: "  Scan  ", title: "x".repeat(500) });
    expect(run.kind).toBe("scan");
    expect(run.title).toHaveLength(200);
    await expect(startRun(db, { kind: " ", title: "t" })).rejects.toThrow(RunStateError);
    await expect(startRun(db, { kind: "scan", title: " " })).rejects.toThrow(RunStateError);
  });
});

describe("addRunStep", () => {
  it("counts the step, remembers the latest, and writes run.step in order", async () => {
    const run = await startRun(db, { kind: "scan", title: "Scan" });
    await addRunStep(db, run.id, { summary: "Fetched Greenhouse", data: { found: 12 } });
    const updated = await addRunStep(db, run.id, { summary: "Scored 12 postings" });
    expect(updated).toMatchObject({ stepCount: 2, lastStep: "Scored 12 postings" });
    const events = await db.activityEvent.findMany({ where: { runId: run.id }, orderBy: [{ at: "asc" }, { id: "asc" }] });
    expect(events.map((event) => event.action)).toEqual(["run.started", "run.step", "run.step"]);
    expect(events[1]).toMatchObject({ summary: "Fetched Greenhouse", data: { found: 12 } });
  });

  it("refuses a step on a finished run", async () => {
    const run = await startRun(db, { kind: "scan", title: "Scan" });
    await finishRun(db, run.id, { status: "OK" });
    await expect(addRunStep(db, run.id, { summary: "late" })).rejects.toThrow(RunStateError);
  });

  it("refuses an unknown run and an empty step", async () => {
    await expect(addRunStep(db, "missing", { summary: "x" })).rejects.toMatchObject({ code: "not_found" });
    const run = await startRun(db, { kind: "scan", title: "Scan" });
    await expect(addRunStep(db, run.id, { summary: "  " })).rejects.toThrow(RunStateError);
  });

  it("rolls the counter back when the event cannot be written", async () => {
    const run = await startRun(db, { kind: "scan", title: "Scan" });
    const circular: Record<string, unknown> = {};
    circular.self = circular; // cannot be stored as JSON, so the event fails after the counter moved
    await expect(addRunStep(db, run.id, { summary: "bad", data: circular as never })).rejects.toThrow();
    expect((await db.agentRun.findUniqueOrThrow({ where: { id: run.id } })).stepCount).toBe(0);
  });
});

describe("finishRun", () => {
  it("closes the run and writes run.finished", async () => {
    const run = await startRun(db, { kind: "scan", title: "Scan" });
    const done = await finishRun(db, run.id, { status: "OK", summary: "12 new postings" });
    expect(done).toMatchObject({ status: "OK", summary: "12 new postings" });
    expect(done.finishedAt).toBeInstanceOf(Date);
    const last = await db.activityEvent.findFirstOrThrow({ where: { runId: run.id, action: "run.finished" } });
    expect(last).toMatchObject({ outcome: "OK", summary: "12 new postings" });
  });

  it("records a failed run as an error", async () => {
    const run = await startRun(db, { kind: "scan", title: "Scan" });
    await finishRun(db, run.id, { status: "FAILED", summary: "Source timed out" });
    const last = await db.activityEvent.findFirstOrThrow({ where: { runId: run.id, action: "run.finished" } });
    expect(last.outcome).toBe("ERROR");
  });

  it("is a no-op when finished again with the same status, and refuses a different one", async () => {
    const run = await startRun(db, { kind: "scan", title: "Scan" });
    const first = await finishRun(db, run.id, { status: "OK" });
    const again = await finishRun(db, run.id, { status: "OK" });
    expect(again.finishedAt?.getTime()).toBe(first.finishedAt?.getTime());
    expect(await db.activityEvent.count({ where: { runId: run.id, action: "run.finished" } })).toBe(1);
    await expect(finishRun(db, run.id, { status: "FAILED" })).rejects.toMatchObject({ code: "conflict" });
  });

  it("will not 'finish' a run as RUNNING", async () => {
    const run = await startRun(db, { kind: "scan", title: "Scan" });
    await expect(finishRun(db, run.id, { status: "RUNNING" as never })).rejects.toThrow(RunStateError);
  });
});

describe("getRun and listRuns", () => {
  it("returns a run with its events oldest first", async () => {
    const run = await startRun(db, { kind: "scan", title: "Scan" });
    await addRunStep(db, run.id, { summary: "one" });
    await finishRun(db, run.id, { status: "OK" });
    const detail = await getRun(db, run.id);
    expect(detail?.events.map((event) => event.action)).toEqual(["run.started", "run.step", "run.finished"]);
    expect(await getRun(db, "missing")).toBeNull();
  });

  it("lists newest first, can filter by status, and pages by cursor", async () => {
    const a = await startRun(db, { kind: "scan", title: "A" });
    const b = await startRun(db, { kind: "scan", title: "B" });
    await startRun(db, { kind: "scan", title: "C" });
    await finishRun(db, a.id, { status: "OK" });
    await finishRun(db, b.id, { status: "FAILED" });
    expect((await listRuns(db)).runs.map((run) => run.title)).toEqual(["C", "B", "A"]);
    expect((await listRuns(db, { status: "RUNNING" })).runs.map((run) => run.title)).toEqual(["C"]);
    const first = await listRuns(db, {}, { limit: 2 });
    expect(first.next).not.toBeNull();
    expect((await listRuns(db, {}, { limit: 2, before: first.next! })).runs.map((run) => run.title)).toEqual(["A"]);
  });
});

describe("isStale", () => {
  const base = { status: "RUNNING" as const, lastActivityAt: new Date("2026-11-01T12:00:00Z") };
  it("flags a running run that has been quiet for a long time", () => {
    expect(isStale(base, new Date(base.lastActivityAt.getTime() + STALE_AFTER_MS + 1))).toBe(true);
    expect(isStale(base, new Date(base.lastActivityAt.getTime() + STALE_AFTER_MS - 1))).toBe(false);
  });
  it("never flags a finished run", () => {
    expect(isStale({ ...base, status: "OK" }, new Date("2030-01-01"))).toBe(false);
  });
});
