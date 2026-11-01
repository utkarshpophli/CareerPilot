import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { buildExport } from "@/lib/data-export";
import { createTestClient, resetDatabase } from "@/test/db";

import { deleteEverything, signOutEverywhere } from "./actions";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
const ended = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => ({ persistent: false, issuedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }),
  endSession: async () => {
    ended.count++;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirected = vi.hoisted(() => ({ to: "" }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirected.to = to;
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${to};307;` });
  },
  unstable_rethrow: (error: unknown) => {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
  },
}));
vi.mock("@/lib/env", () => ({ env: { DOSSIER_DATA_DIR: "", DOSSIER_SECRET: "s".repeat(32) } }));
vi.mock("@/lib/backups", () => ({ deleteAllBackups: async () => {} }));
vi.mock("@/lib/downloads", () => ({ deleteAllDownloads: async () => {}, downloadsDir: () => "" }));

const prisma = () => db.client!;
const epochRow = () => prisma().setting.findUnique({ where: { key: "sessionEpoch" } });

beforeEach(async () => {
  ended.count = 0;
  redirected.to = "";
  await resetDatabase(prisma());
});
afterAll(() => prisma().$disconnect());

describe("signOutEverywhere (audit A-04)", () => {
  it("moves to the next session epoch, ends this device's session and goes to the sign-in page", async () => {
    await expect(signOutEverywhere({})).rejects.toThrow("NEXT_REDIRECT");
    expect((await epochRow())?.value).toBe("1");
    expect(ended.count).toBe(1);
    expect(redirected.to).toBe("/login");
    await expect(signOutEverywhere({})).rejects.toThrow("NEXT_REDIRECT");
    expect((await epochRow())?.value).toBe("2");
  });

  it("is kept by Delete everything, so the session that stays is still valid", async () => {
    await prisma().setting.create({ data: { key: "sessionEpoch", value: "4" } });
    await prisma().setting.create({ data: { key: "paper", value: "LETTER" } });
    await expect(deleteEverything({ confirm: "DELETE" })).rejects.toThrow("NEXT_REDIRECT");
    expect((await epochRow())?.value).toBe("4");
    expect(await prisma().setting.findUnique({ where: { key: "paper" } })).toBeNull();
  });

  it("never travels in an export", async () => {
    await prisma().setting.create({ data: { key: "sessionEpoch", value: "4" } });
    const file = await buildExport(prisma(), { now: new Date() });
    expect(file.settings.map((setting) => setting.key)).not.toContain("sessionEpoch");
  });
});
