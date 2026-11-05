import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { proposeStatus } from "@/lib/proposals";
import { createTestClient, resetDatabase } from "@/test/db";

import { confirmProposalAction, dismissProposalAction } from "./actions";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
const session = vi.hoisted(() => ({ signedIn: true }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (session.signedIn ? { persistent: false, issuedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) } : null),
}));
vi.mock("@/lib/env", () => ({ env: { CAREERPILOT_SECRET: "a".repeat(32) } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prisma = () => db.client!;
beforeEach(async () => {
  session.signedIn = true;
  await resetDatabase(prisma());
});
afterAll(() => prisma().$disconnect());

async function waiting(status: "SENT" | "OFFER" = "SENT") {
  const app = await prisma().application.create({ data: { title: "Engineer at Acme" } });
  const proposal = await proposeStatus(prisma(), { applicationId: app.id, status, reason: "told me" });
  return { app, proposal };
}

describe("confirmProposalAction", () => {
  it("moves the application, says so, and hands back what undoes it", async () => {
    const { app, proposal } = await waiting();
    const result = await confirmProposalAction({ id: proposal.id });
    expect(result).toMatchObject({ ok: true, data: { applicationId: app.id, status: "SENT", eventId: expect.any(String) }, toast: expect.stringContaining("sent") });
    expect(await prisma().application.findUniqueOrThrow({ where: { id: app.id } })).toMatchObject({ status: "SENT" });
  });

  it("does nothing for someone who is not signed in", async () => {
    const { app, proposal } = await waiting();
    session.signedIn = false;
    expect(await confirmProposalAction({ id: proposal.id })).toMatchObject({ ok: false });
    expect((await prisma().application.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("DRAFT");
    expect((await prisma().statusProposal.findUniqueOrThrow({ where: { id: proposal.id } })).state).toBe("PENDING");
  });

  it("tells the user plainly when a proposal is gone, already done, or the input is wrong", async () => {
    const { proposal } = await waiting();
    await confirmProposalAction({ id: proposal.id });
    expect(await confirmProposalAction({ id: proposal.id })).toMatchObject({ ok: false, error: expect.stringContaining("no longer waiting") });
    expect(await confirmProposalAction({ id: "missing" })).toMatchObject({ ok: false, error: "No such proposal." });
    expect(await confirmProposalAction({ id: "" })).toMatchObject({ ok: false });
  });
});

describe("dismissProposalAction", () => {
  it("drops the proposal and leaves the application alone", async () => {
    const { app, proposal } = await waiting("OFFER");
    expect(await dismissProposalAction({ id: proposal.id })).toMatchObject({ ok: true });
    expect((await prisma().application.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("DRAFT");
    expect((await prisma().statusProposal.findUniqueOrThrow({ where: { id: proposal.id } })).state).toBe("DISMISSED");
  });

  it("does nothing for someone who is not signed in", async () => {
    const { proposal } = await waiting();
    session.signedIn = false;
    expect(await dismissProposalAction({ id: proposal.id })).toMatchObject({ ok: false });
    expect((await prisma().statusProposal.findUniqueOrThrow({ where: { id: proposal.id } })).state).toBe("PENDING");
  });
});
