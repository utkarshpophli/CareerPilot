import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { saveVersion } from "./document-versions";
import { ACTIONS, currentActor, listActivity, recordActivity, runAsActor } from "./ledger";
import { applyStatusChange, undoStatusChange } from "./status-changes";

const db = createTestClient();

beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

describe("recordActivity", () => {
  it("writes an event for the dashboard user by default", async () => {
    await recordActivity(db, { action: ACTIONS.applicationCreated, summary: "Created application: Engineer", platform: "lever" });
    const [event] = await db.activityEvent.findMany();
    expect(event).toMatchObject({ actorKind: "USER", actorName: "", action: "application.created", platform: "lever", outcome: "OK" });
  });

  it("records who acted when a client says so, however deep the call", async () => {
    const nested = async () => recordActivity(db, { action: ACTIONS.jobQueued, summary: "Queued refine" });
    await runAsActor({ kind: "MCP", name: " claude-code " }, async () => {
      expect(currentActor()).toEqual({ kind: "MCP", name: "claude-code" });
      await nested();
    });
    const [event] = await db.activityEvent.findMany();
    expect(event).toMatchObject({ actorKind: "MCP", actorName: "claude-code" });
    expect(currentActor()).toEqual({ kind: "USER" });
  });

  it("keeps a summary to one short line's worth", async () => {
    await recordActivity(db, { action: ACTIONS.jobQueued, summary: "x".repeat(1000) });
    expect((await db.activityEvent.findFirstOrThrow()).summary).toHaveLength(300);
  });

  it("rolls back with the transaction it was written in", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await recordActivity(tx, { action: ACTIONS.jobQueued, summary: "never happened" });
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect(await db.activityEvent.count()).toBe(0);
  });
});

describe("listActivity", () => {
  async function seed() {
    for (let index = 0; index < 5; index++) {
      await db.activityEvent.create({
        data: {
          at: new Date(Date.UTC(2026, 10, 1, 12, index)),
          action: index % 2 === 0 ? "application.created" : "job.finished",
          actorKind: index === 4 ? "MCP" : "USER",
          applicationId: index < 2 ? "app-1" : "app-2",
          platform: index === 0 ? "lever" : "",
          summary: `event ${index}`,
        },
      });
    }
  }

  it("lists newest first and pages by cursor", async () => {
    await seed();
    const first = await listActivity(db, {}, { limit: 2 });
    expect(first.events.map((event) => event.summary)).toEqual(["event 4", "event 3"]);
    expect(first.next).not.toBeNull();
    const second = await listActivity(db, {}, { limit: 2, before: first.next! });
    expect(second.events.map((event) => event.summary)).toEqual(["event 2", "event 1"]);
    const last = await listActivity(db, {}, { limit: 2, before: second.next! });
    expect(last.events.map((event) => event.summary)).toEqual(["event 0"]);
    expect(last.next).toBeNull();
  });

  it("filters by actor, action or prefix, application and platform", async () => {
    await seed();
    expect((await listActivity(db, { actorKind: "MCP" })).events.map((event) => event.summary)).toEqual(["event 4"]);
    expect((await listActivity(db, { action: "job.finished" })).events).toHaveLength(2);
    expect((await listActivity(db, { action: "application." })).events).toHaveLength(3);
    expect((await listActivity(db, { applicationId: "app-1" })).events).toHaveLength(2);
    expect((await listActivity(db, { platform: "lever" })).events.map((event) => event.summary)).toEqual(["event 0"]);
  });
});

describe("the writers", () => {
  it("record a status change and its undo, with the platform", async () => {
    const { id } = await db.application.create({ data: { title: "Engineer at Acme", postingUrl: "https://jobs.lever.co/acme/1" } });
    const result = await applyStatusChange(db, id, "SENT", new Date(Date.UTC(2026, 10, 1, 12)));
    expect(result.outcome).toBe("changed");
    if (result.outcome !== "changed") return;
    await undoStatusChange(db, result.event.id);

    const events = await db.activityEvent.findMany({ orderBy: { at: "asc" } });
    expect(events.map((event) => event.action)).toEqual(["application.status_changed", "application.status_undone"]);
    expect(events[0]).toMatchObject({ applicationId: id, platform: "lever", summary: "Engineer at Acme: Draft to Sent", data: { from: "DRAFT", to: "SENT" } });
  });

  it("record nothing for a status change that did not happen", async () => {
    const { id } = await db.application.create({ data: {} });
    await applyStatusChange(db, id, "DRAFT");
    expect(await db.activityEvent.count()).toBe(0);
  });

  it("record a saved document version with its cause and kind", async () => {
    const application = await db.application.create({ data: { title: "Engineer" } });
    const document = await db.document.create({ data: { applicationId: application.id, kind: "RESUME", units: [], writtenWith: "claude-sonnet" } });
    await db.$transaction((tx) => saveVersion(tx, document.id, [], { cause: "REFINED", detail: "shorter" }));

    const [event] = await db.activityEvent.findMany();
    expect(event).toMatchObject({
      action: "document.version_saved",
      applicationId: application.id,
      targetId: document.id,
      model: "claude-sonnet",
      summary: "Saved a resume version (refined)",
      data: { cause: "REFINED", kind: "RESUME" },
    });
  });
});
