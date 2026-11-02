import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { addCompanyAction, removeCompanyAction, scanNowAction, setCompanyEnabledAction } from "./companies-actions";

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
vi.mock("@/lib/profile-data", async () => {
  const { demoProfile } = await import("@/lib/demo-profile");
  const profile = demoProfile();
  profile.basics.headline = "Product Designer";
  profile.basics.city = "Berlin";
  return { loadProfile: async () => profile };
});
const board = vi.hoisted(() => ({ missing: false }));
vi.mock("@/lib/job-search/boards/request", async (original) => {
  const real = await original<typeof import("@/lib/job-search/boards/request")>();
  return {
    ...real,
    requestBoardJson: async (address: string) => {
      if (board.missing || address.includes("/gone/")) throw new (await import("@/lib/job-search/boards/types")).BoardError("not-found", "The source has no such board. Check the name.");
      return { jobs: [{ id: 1, title: "Product Designer", absolute_url: "https://job-boards.greenhouse.io/acme/jobs/1", location: { name: "Berlin" }, content: "Figma." }] };
    },
  };
});

const prisma = () => db.client!;
beforeEach(async () => {
  session.signedIn = true;
  board.missing = false;
  await resetDatabase(prisma());
});
afterAll(() => prisma().$disconnect());

describe("addCompanyAction", () => {
  it("watches a board from a name or a careers address and shows it with its health", async () => {
    const result = await addCompanyAction({ board: "https://job-boards.greenhouse.io/acme", name: "Acme" });
    expect(result).toMatchObject({ ok: true, data: { name: "Acme", source: "GREENHOUSE", slug: "acme", enabled: true, lastScanAt: null, lastError: "" }, toast: "Now watching Acme." });
    expect(await addCompanyAction({ board: "acme", source: "GREENHOUSE" })).toMatchObject({ ok: true, toast: "Already watching Acme." });
  });

  it("says what is wrong in the owner's words, and adds nothing", async () => {
    expect(await addCompanyAction({ board: "acme" })).toMatchObject({ ok: false, error: expect.stringMatching(/which source/i) });
    expect(await addCompanyAction({ board: "a/b", source: "LEVER" })).toMatchObject({ ok: false });
    expect(await addCompanyAction({ board: "" })).toMatchObject({ ok: false });
    expect(await prisma().trackedCompany.count()).toBe(0);
  });

  it("does nothing for someone who is not signed in", async () => {
    session.signedIn = false;
    expect(await addCompanyAction({ board: "acme", source: "GREENHOUSE" })).toMatchObject({ ok: false });
    expect(await prisma().trackedCompany.count()).toBe(0);
  });
});

describe("setCompanyEnabledAction and removeCompanyAction", () => {
  it("turns a board off and on, and removes it", async () => {
    const added = await addCompanyAction({ board: "acme", source: "GREENHOUSE", name: "Acme" });
    const id = (added as { data: { id: string } }).data.id;
    expect(await setCompanyEnabledAction({ id, enabled: false })).toMatchObject({ ok: true, data: { enabled: false }, toast: "Acme is paused." });
    expect(await setCompanyEnabledAction({ id, enabled: true })).toMatchObject({ ok: true, toast: "Watching Acme again." });
    expect(await removeCompanyAction({ id })).toMatchObject({ ok: true, toast: "Removed Acme." });
    expect(await prisma().trackedCompany.count()).toBe(0);
    expect(await removeCompanyAction({ id })).toMatchObject({ ok: false, error: "That company is no longer in the list." });
  });

  it("do nothing for someone who is not signed in", async () => {
    const added = await addCompanyAction({ board: "acme", source: "GREENHOUSE" });
    const id = (added as { data: { id: string } }).data.id;
    session.signedIn = false;
    expect(await setCompanyEnabledAction({ id, enabled: false })).toMatchObject({ ok: false });
    expect(await removeCompanyAction({ id })).toMatchObject({ ok: false });
    expect(await prisma().trackedCompany.count()).toBe(1);
  });
});

describe("scanNowAction", () => {
  it("reads the watched boards, keeps and scores what it finds, and says how each board went", async () => {
    await addCompanyAction({ board: "acme", source: "GREENHOUSE", name: "Acme" });
    await addCompanyAction({ board: "gone", source: "GREENHOUSE", name: "Gone" });
    const result = await scanNowAction({});
    expect(result).toMatchObject({
      ok: true,
      data: { scanned: 2, added: 1, closed: 0, failed: 1, skipped: 0, companies: expect.arrayContaining([expect.objectContaining({ name: "Acme", lastError: "" }), expect.objectContaining({ name: "Gone", lastError: "The source has no such board. Check the name." })]) },
    });
    expect((result as { toast: string }).toast).toMatch(/1 new/);
    expect(await prisma().scannedPosting.findFirstOrThrow()).toMatchObject({ title: "Product Designer", state: "NEW", score: expect.any(Number) });
    expect(await prisma().agentRun.count()).toBe(0); // the owner's own scan is not an assistant's run
  });

  it("says plainly when nothing is watched, and does nothing for someone not signed in", async () => {
    expect(await scanNowAction({})).toMatchObject({ ok: true, data: { scanned: 0 }, toast: expect.stringMatching(/add a company/i) });
    session.signedIn = false;
    expect(await scanNowAction({})).toMatchObject({ ok: false });
  });
});
