import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { setPostingStateAction } from "./actions";

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

const posting = () =>
  prisma().scannedPosting.create({
    data: { source: "GREENHOUSE", externalId: "acme:1", companyName: "Acme", title: "Product Designer", url: "https://example.test/1", canonicalKey: "acme_product-designer", fingerprint: "x", firstSeenAt: new Date(), lastSeenAt: new Date() },
  });

describe("setPostingStateAction", () => {
  it("saves, dismisses and restores a posting, and says what happened", async () => {
    const row = await posting();
    expect(await setPostingStateAction({ id: row.id, state: "SAVED" })).toMatchObject({ ok: true, data: { state: "SAVED", changed: true }, toast: expect.stringMatching(/saved/i) });
    expect((await prisma().scannedPosting.findUniqueOrThrow({ where: { id: row.id } })).state).toBe("SAVED");
    expect(await setPostingStateAction({ id: row.id, state: "DISMISSED" })).toMatchObject({ ok: true, toast: expect.stringMatching(/dismissed/i) });
    expect(await setPostingStateAction({ id: row.id, state: "NEW" })).toMatchObject({ ok: true, toast: expect.stringMatching(/review/i) });
  });

  it("does nothing for someone who is not signed in", async () => {
    const row = await posting();
    session.signedIn = false;
    expect(await setPostingStateAction({ id: row.id, state: "DISMISSED" })).toMatchObject({ ok: false });
    expect((await prisma().scannedPosting.findUniqueOrThrow({ where: { id: row.id } })).state).toBe("NEW");
  });

  it("tells the user plainly when the posting is gone or the input is wrong", async () => {
    expect(await setPostingStateAction({ id: "gone", state: "SAVED" })).toMatchObject({ ok: false, error: "That posting is no longer in the list." });
    expect(await setPostingStateAction({ id: "", state: "SAVED" })).toMatchObject({ ok: false });
    expect(await setPostingStateAction({ id: "x", state: "OPEN" as never })).toMatchObject({ ok: false });
  });
});
