import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ACTIONS, runAsActor } from "@/lib/ledger";
import { ServiceError } from "@/lib/service-error";
import { createTestClient, resetDatabase } from "@/test/db";

import { moveApplication, proposeStatus, trackApplication } from "./applications";
import { checkPostingText, saveFitScores } from "./postings";
import { reportAsRun } from "./runs";

const db = createTestClient();
beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

const asAssistant = <T>(work: () => Promise<T>, kind: "CLI" | "MCP" = "CLI") => runAsActor({ kind, name: "claude-code" }, work);

describe("reportAsRun", () => {
  it("reports an assistant's operation as a finished run with one step, under the assistant's name", async () => {
    const result = await asAssistant(() => reportAsRun(db, { kind: "searches.run", title: "Search: designer" }, async () => 7, (found) => ({ summary: `Found ${found} postings`, data: { found } })));
    expect(result).toBe(7);
    const [run] = await db.agentRun.findMany();
    expect(run).toMatchObject({ kind: "searches.run", title: "Search: designer", status: "OK", stepCount: 1, lastStep: "Found 7 postings", actorKind: "CLI", actorName: "claude-code" });
    const events = await db.activityEvent.findMany({ where: { runId: run!.id }, orderBy: { at: "asc" } });
    expect(events.map((event) => event.action)).toEqual([ACTIONS.runStarted, ACTIONS.runStep, ACTIONS.runFinished]);
    expect(events[1]!.data).toEqual({ found: 7 });
  });

  it("reports nothing for the owner's own clicks or for the app's own work", async () => {
    await reportAsRun(db, { kind: "searches.run", title: "x" }, async () => 1);
    await runAsActor({ kind: "SYSTEM" }, () => reportAsRun(db, { kind: "searches.run", title: "x" }, async () => 1));
    await runAsActor({ kind: "SCHEDULER" }, () => reportAsRun(db, { kind: "searches.run", title: "x" }, async () => 1));
    expect(await db.agentRun.count()).toBe(0);
  });

  it("finishes the run as failed with the reason, and lets the error through", async () => {
    const boom = new ServiceError("conflict", "The source is down");
    await expect(asAssistant(() => reportAsRun(db, { kind: "searches.run", title: "x" }, async () => Promise.reject(boom)))).rejects.toBe(boom);
    expect(await db.agentRun.findFirstOrThrow()).toMatchObject({ status: "FAILED", summary: "The source is down" });
  });

  it("does not put an unexpected error's text in the run, which anyone with the dashboard can read", async () => {
    await expect(asAssistant(() => reportAsRun(db, { kind: "searches.run", title: "x" }, async () => Promise.reject(new TypeError("password=hunter2 at /srv/app/secret.ts"))))).rejects.toThrow();
    const run = await db.agentRun.findFirstOrThrow();
    expect(run.status).toBe("FAILED");
    expect(run.summary).not.toContain("hunter2");
  });

  it("never fails the work because reporting failed", async () => {
    for (let index = 0; index < 50; index++) await db.agentRun.create({ data: { kind: "scan", title: `Going ${index}` } });
    await expect(asAssistant(() => reportAsRun(db, { kind: "searches.run", title: "x" }, async () => "done"))).resolves.toBe("done");
    expect(await db.agentRun.count({ where: { kind: "searches.run" } })).toBe(0);
  });
});

describe("the operations report as runs when an assistant does them", () => {
  it("track, move, propose, check and score each leave a run; the same by hand leaves none", async () => {
    const tracked = await asAssistant(() => trackApplication(db, { company: "Acme", role: "Engineer" }), "MCP");
    await asAssistant(() => moveApplication(db, tracked.id, "REJECTED"));
    await asAssistant(() => proposeStatus(db, { applicationId: tracked.id, status: "SENT", reason: "The user said so" }));
    await asAssistant(() => checkPostingText(db, "A posting.", "api"));
    await asAssistant(() => saveFitScores(db, { scoredWith: "x", scores: [{ postingId: "none", score: 1, reasons: ["x"], redFlags: [] }] }));

    const runs = await db.agentRun.findMany({ orderBy: { startedAt: "asc" } });
    expect(runs.map((run) => run.kind)).toEqual(["applications.track", "applications.move", "proposals.propose", "postings.check", "postings.score"]);
    expect(runs.every((run) => run.status === "OK" && run.stepCount === 1)).toBe(true);
    expect(runs[0]).toMatchObject({ actorKind: "MCP", actorName: "claude-code" });
    expect(runs[1]!.applicationId).toBe(tracked.id);

    const before = await db.agentRun.count();
    await trackApplication(db, { company: "Beta" });
    expect(await db.agentRun.count()).toBe(before);
  });

  it("a failed operation is a failed run", async () => {
    await expect(asAssistant(() => trackApplication(db, {}))).rejects.toThrow();
    expect(await db.agentRun.findFirstOrThrow()).toMatchObject({ kind: "applications.track", status: "FAILED", summary: expect.stringContaining("company or a role") });
  });
});
