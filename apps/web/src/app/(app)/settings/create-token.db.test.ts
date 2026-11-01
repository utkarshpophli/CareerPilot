import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { createToken } from "./actions";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => ({ persistent: false, issuedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }),
  passwordMatches: async (candidate: string) => candidate === "correct horse",
  endSession: async () => {},
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: () => {} }));
vi.mock("@/lib/env", () => ({ env: { CAREERPILOT_DATA_DIR: "", CAREERPILOT_SECRET: "s".repeat(32) } }));
vi.mock("@/lib/backups", () => ({ deleteAllBackups: async () => {} }));
vi.mock("@/lib/downloads", () => ({ deleteAllDownloads: async () => {}, downloadsDir: () => "" }));

const prisma = () => db.client!;
beforeEach(() => resetDatabase(prisma()));
afterAll(() => prisma().$disconnect());

// Audit A-20: an API token is a permanent way in. A copied session cookie must not be enough to make one.
describe("createToken", () => {
  it("makes a token when the password is right", async () => {
    const result = await createToken({ name: "claude-code", scope: "WRITE", password: "correct horse" });
    expect(result).toMatchObject({ ok: true });
    expect(await prisma().apiToken.count()).toBe(1);
  });

  it("refuses a wrong or missing password, and makes nothing", async () => {
    expect(await createToken({ name: "claude-code", scope: "WRITE", password: "hunter2" })).toMatchObject({ ok: false, error: expect.stringMatching(/not the password/i) });
    expect(await createToken({ name: "claude-code", scope: "WRITE", password: "" })).toMatchObject({ ok: false, error: "Enter your password." });
    expect(await prisma().apiToken.count()).toBe(0);
  });

  it("counts wrong passwords against the same throttle as signing in", async () => {
    for (let attempt = 0; attempt < 5; attempt++) await createToken({ name: "x", scope: "READ", password: "wrong" });
    const blocked = await createToken({ name: "x", scope: "READ", password: "correct horse" });
    expect(blocked).toMatchObject({ ok: false, error: expect.stringMatching(/^Too many attempts/) });
    expect(await prisma().apiToken.count()).toBe(0);
  });
});
