import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { ACTIONS, runAsActor } from "./ledger";
import { confirmProposal, dismissProposal, listPendingProposals, MAX_PENDING, pendingProposalFor, PROPOSAL_TTL_MS, proposeStatus, pruneProposals } from "./proposals";
import { ServiceError } from "./service-error";
import { undoStatusChange } from "./status-changes";

const db = createTestClient();
beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

const now = new Date("2026-11-02T10:00:00Z");
const later = (ms: number) => new Date(now.getTime() + ms);
const assistant = <T>(work: () => Promise<T>) => runAsActor({ kind: "CLI", name: "claude-code" }, work);

async function application(data: Record<string, unknown> = {}) {
  return db.application.create({ data: { title: "Engineer at Acme", company: "Acme", ...data } });
}

const failsWith = async (work: Promise<unknown>, code: ServiceError["code"], message?: RegExp) => {
  const error = await work.then(() => null, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(ServiceError);
  expect((error as ServiceError).code).toBe(code);
  if (message) expect((error as ServiceError).message).toMatch(message);
};

describe("proposeStatus", () => {
  it("records the suggestion and leaves the application exactly as it was", async () => {
    const app = await application();
    const proposal = await assistant(() => proposeStatus(db, { applicationId: app.id, status: "SENT", reason: "The user said they submitted it" }, now));

    expect(proposal).toMatchObject({ applicationId: app.id, status: "SENT", state: "PENDING", reason: "The user said they submitted it", actorName: "claude-code", expiresAt: later(PROPOSAL_TTL_MS).toISOString() });
    // The whole point of the queue: an assistant cannot make progress happen, only ask for it.
    const after = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(after).toMatchObject({ status: "DRAFT", sentAt: null, furthestStage: null });
    expect(await db.statusEvent.count()).toBe(0);
  });

  it("notes it in the ledger under the assistant's name", async () => {
    const app = await application();
    await assistant(() => proposeStatus(db, { applicationId: app.id, status: "INTERVIEW", reason: "" }, now));
    const [event] = await db.activityEvent.findMany({ where: { action: ACTIONS.proposalCreated } });
    expect(event).toMatchObject({ actorKind: "CLI", actorName: "claude-code", applicationId: app.id, data: { status: "INTERVIEW" } });
  });

  it("only takes progress statuses: the others an assistant may set directly", async () => {
    const app = await application();
    for (const status of ["DRAFT", "REJECTED", "DECLINED"] as const) {
      await failsWith(proposeStatus(db, { applicationId: app.id, status, reason: "" }, now), "bad_request", /set it directly/i);
    }
    expect(await db.statusProposal.count()).toBe(0);
  });

  it("refuses an unknown application, a draft awaiting review, an archived one, and one already at that status", async () => {
    await failsWith(proposeStatus(db, { applicationId: "nope", status: "SENT", reason: "" }, now), "not_found");
    const waiting = await application({ awaitingReview: true });
    await failsWith(proposeStatus(db, { applicationId: waiting.id, status: "SENT", reason: "" }, now), "conflict", /waiting for the user's review/);
    const archived = await application({ archivedAt: now });
    await failsWith(proposeStatus(db, { applicationId: archived.id, status: "SENT", reason: "" }, now), "conflict", /archived/);
    const sent = await application({ status: "SENT" });
    await failsWith(proposeStatus(db, { applicationId: sent.id, status: "SENT", reason: "" }, now), "conflict", /already/);
  });

  it("keeps one pending proposal per application: a newer one replaces the older", async () => {
    const app = await application({ status: "SENT" });
    const first = await proposeStatus(db, { applicationId: app.id, status: "SCREENING", reason: "" }, now);
    const second = await proposeStatus(db, { applicationId: app.id, status: "INTERVIEW", reason: "" }, later(1000));
    expect((await db.statusProposal.findUniqueOrThrow({ where: { id: first.id } })).state).toBe("SUPERSEDED");
    expect(await db.statusProposal.findMany({ where: { applicationId: app.id, state: "PENDING" } })).toHaveLength(1);
    expect(second.state).toBe("PENDING");
  });

  it("answers a repeat of the same proposal with the one it already has", async () => {
    const app = await application();
    const first = await proposeStatus(db, { applicationId: app.id, status: "SENT", reason: "a" }, now);
    const again = await proposeStatus(db, { applicationId: app.id, status: "SENT", reason: "b" }, later(1000));
    expect(again.id).toBe(first.id);
    expect(await db.statusProposal.count()).toBe(1);
    expect(await db.activityEvent.count({ where: { action: ACTIONS.proposalCreated } })).toBe(1);
  });

  it("cleans the assistant's words: secrets redacted, control characters and line breaks gone, one short line", async () => {
    const app = await application();
    const proposal = await proposeStatus(
      db,
      { applicationId: app.id, status: "SENT", reason: `line one\nline two\u0000‮ with key sk-ant-api03-${"a".repeat(40)} ${"x".repeat(500)}` },
      now,
    );
    expect(proposal.reason).not.toMatch(/[\n\r\u0000‮]/);
    expect(proposal.reason).not.toContain("sk-ant-api03");
    expect(proposal.reason.length).toBeLessThanOrEqual(300);
    expect(proposal.reason).toContain("line one line two");
  });

  it("keeps a flood in check: no more than the allowed number may wait at once", async () => {
    const options = { maxPending: 2 };
    for (const title of ["a", "b"]) await proposeStatus(db, { applicationId: (await application({ title })).id, status: "SENT", reason: "" }, now, options);
    const third = await application({ title: "c" });
    await failsWith(proposeStatus(db, { applicationId: third.id, status: "SENT", reason: "" }, now, options), "conflict", /waiting/);
    // Replacing one's own does not count against the limit.
    const existing = (await db.statusProposal.findFirstOrThrow()).applicationId;
    await expect(proposeStatus(db, { applicationId: existing, status: "SCREENING", reason: "" }, now, options)).resolves.toMatchObject({ status: "SCREENING" });
    expect(MAX_PENDING).toBeGreaterThanOrEqual(20);
  });
});

describe("confirmProposal", () => {
  it("moves the application through the status machine, so the move can be undone", async () => {
    const app = await application();
    const proposal = await proposeStatus(db, { applicationId: app.id, status: "SENT", reason: "" }, now);
    const result = await confirmProposal(db, proposal.id, later(60_000));

    expect(result).toMatchObject({ applicationId: app.id, status: "SENT", changed: true });
    expect(result.eventId).toEqual(expect.any(String));
    expect(await db.application.findUniqueOrThrow({ where: { id: app.id } })).toMatchObject({ status: "SENT", furthestStage: "SENT" });
    expect(await db.statusProposal.findUniqueOrThrow({ where: { id: proposal.id } })).toMatchObject({ state: "CONFIRMED", statusEventId: result.eventId, resolvedAt: later(60_000) });

    await undoStatusChange(db, result.eventId!);
    expect((await db.application.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("DRAFT");
  });

  it("is recorded as the owner's doing, not the assistant's", async () => {
    const app = await application();
    const proposal = await assistant(() => proposeStatus(db, { applicationId: app.id, status: "SENT", reason: "" }, now));
    await confirmProposal(db, proposal.id, later(1000));
    const [event] = await db.activityEvent.findMany({ where: { action: ACTIONS.proposalConfirmed } });
    expect(event).toMatchObject({ actorKind: "USER", applicationId: app.id, data: { status: "SENT", proposedBy: "claude-code" } });
    const [moved] = await db.activityEvent.findMany({ where: { action: "application.status_changed" } });
    expect(moved?.actorKind).toBe("USER");
  });

  it("lets exactly one of two simultaneous confirmations through", async () => {
    const app = await application();
    const proposal = await proposeStatus(db, { applicationId: app.id, status: "SENT", reason: "" }, now);
    const outcomes = await Promise.allSettled([confirmProposal(db, proposal.id, later(1000)), confirmProposal(db, proposal.id, later(1000))]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ServiceError);
    expect(await db.statusEvent.count()).toBe(1);
  });

  it("refuses a proposal that has expired, and changes nothing", async () => {
    const app = await application();
    const proposal = await proposeStatus(db, { applicationId: app.id, status: "SENT", reason: "" }, now);
    await failsWith(confirmProposal(db, proposal.id, later(PROPOSAL_TTL_MS + 1)), "conflict", /expired/);
    expect((await db.application.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("DRAFT");
    expect((await db.statusProposal.findUniqueOrThrow({ where: { id: proposal.id } })).state).toBe("PENDING");
  });

  it("refuses one already resolved, replaced or unknown", async () => {
    const app = await application({ status: "SENT" });
    const first = await proposeStatus(db, { applicationId: app.id, status: "SCREENING", reason: "" }, now);
    await proposeStatus(db, { applicationId: app.id, status: "INTERVIEW", reason: "" }, later(1000));
    await failsWith(confirmProposal(db, first.id, later(2000)), "conflict", /no longer waiting/);
    await failsWith(confirmProposal(db, "nope", later(2000)), "not_found");
  });

  it("is fine when the application has reached that status meanwhile: confirmed, nothing to undo", async () => {
    const app = await application();
    const proposal = await proposeStatus(db, { applicationId: app.id, status: "SENT", reason: "" }, now);
    await db.application.update({ where: { id: app.id }, data: { status: "SENT" } });
    const result = await confirmProposal(db, proposal.id, later(1000));
    expect(result).toMatchObject({ changed: false, eventId: null });
    expect((await db.statusProposal.findUniqueOrThrow({ where: { id: proposal.id } })).state).toBe("CONFIRMED");
  });
});

describe("dismissProposal", () => {
  it("drops the proposal and leaves the application alone", async () => {
    const app = await application();
    const proposal = await proposeStatus(db, { applicationId: app.id, status: "OFFER", reason: "" }, now);
    await dismissProposal(db, proposal.id, later(1000));
    expect(await db.statusProposal.findUniqueOrThrow({ where: { id: proposal.id } })).toMatchObject({ state: "DISMISSED", resolvedAt: later(1000) });
    expect((await db.application.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("DRAFT");
    expect(await db.activityEvent.count({ where: { action: ACTIONS.proposalDismissed } })).toBe(1);
    await failsWith(dismissProposal(db, proposal.id, later(2000)), "conflict");
    await failsWith(confirmProposal(db, proposal.id, later(2000)), "conflict");
  });
});

describe("listPendingProposals", () => {
  it("lists what waits, newest first, with the application's name, and leaves out the resolved and the expired", async () => {
    const a = await application({ title: "A" });
    const b = await application({ title: "B" });
    const c = await application({ title: "C" });
    const d = await application({ title: "D" });
    await proposeStatus(db, { applicationId: a.id, status: "SENT", reason: "first" }, now);
    const second = await proposeStatus(db, { applicationId: b.id, status: "SENT", reason: "second" }, later(1000));
    const dismissed = await proposeStatus(db, { applicationId: c.id, status: "SENT", reason: "" }, later(2000));
    await dismissProposal(db, dismissed.id, later(3000));
    await proposeStatus(db, { applicationId: d.id, status: "SENT", reason: "stale" }, new Date(now.getTime() - PROPOSAL_TTL_MS - 5000));

    const pending = await listPendingProposals(db, later(10_000));
    expect(pending.map((proposal) => proposal.application.title)).toEqual(["B", "A"]);
    expect(pending[0]).toMatchObject({ id: second.id, reason: "second", application: { id: b.id, status: "DRAFT" } });
  });
});

describe("pendingProposalFor", () => {
  it("gives the proposal waiting for one application, and null once it is resolved, expired or never there", async () => {
    const app = await application();
    const other = await application({ title: "Other" });
    expect(await pendingProposalFor(db, app.id, now)).toBeNull();
    const proposal = await proposeStatus(db, { applicationId: app.id, status: "SENT", reason: "told me" }, now);
    expect(await pendingProposalFor(db, app.id, later(1000))).toMatchObject({ id: proposal.id, status: "SENT", reason: "told me" });
    expect(await pendingProposalFor(db, other.id, later(1000))).toBeNull();
    expect(await pendingProposalFor(db, app.id, later(PROPOSAL_TTL_MS + 1))).toBeNull();
    await dismissProposal(db, proposal.id, later(2000));
    expect(await pendingProposalFor(db, app.id, later(3000))).toBeNull();
  });
});

describe("pruneProposals", () => {
  it("removes old finished and expired proposals, never a live one", async () => {
    const app = await application();
    const old = new Date(now.getTime() - 200 * 86_400_000);
    await db.statusProposal.create({ data: { applicationId: app.id, status: "SENT", state: "DISMISSED", createdAt: old, resolvedAt: old, expiresAt: old } });
    await db.statusProposal.create({ data: { applicationId: app.id, status: "OFFER", state: "PENDING", createdAt: old, expiresAt: old } });
    const live = await proposeStatus(db, { applicationId: app.id, status: "INTERVIEW", reason: "" }, now);
    expect(await pruneProposals(db, now)).toBe(2);
    expect((await db.statusProposal.findMany()).map((proposal) => proposal.id)).toEqual([live.id]);
  });
});
