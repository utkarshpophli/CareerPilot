import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { allows, createApiToken, listApiTokens, revokeApiToken, verifyApiToken } from "./api-tokens";
import { hashToken } from "./api-token-core";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
const prisma = () => db.client!;

beforeEach(() => resetDatabase(prisma()));
afterAll(() => prisma().$disconnect());

describe("API tokens", () => {
  it("stores only a hash and recognises the token it gave out", async () => {
    const { id, token } = await createApiToken("claude-code @ laptop", "WRITE");
    const row = await prisma().apiToken.findUniqueOrThrow({ where: { id } });
    expect(row.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(await verifyApiToken(`Bearer ${token}`)).toEqual({ id, name: "claude-code @ laptop", scope: "WRITE" });
  });

  it("turns away unknown, malformed and revoked tokens", async () => {
    const { id, token } = await createApiToken("a", "READ");
    expect(await verifyApiToken(null)).toBeNull();
    expect(await verifyApiToken("Bearer cp_unknown")).toBeNull();
    expect(await verifyApiToken(`Basic ${token}`)).toBeNull();
    expect(await revokeApiToken(id)).toBe(true);
    expect(await revokeApiToken(id)).toBe(false);
    expect(await verifyApiToken(`Bearer ${token}`)).toBeNull();
  });

  it("notes when a token was last used, at most once a minute", async () => {
    const { id, token } = await createApiToken("a", "READ");
    const t0 = new Date("2026-11-01T10:00:00Z");
    await verifyApiToken(`Bearer ${token}`, t0);
    expect((await prisma().apiToken.findUniqueOrThrow({ where: { id } })).lastUsedAt).toEqual(t0);
    await verifyApiToken(`Bearer ${token}`, new Date(t0.getTime() + 10_000));
    expect((await prisma().apiToken.findUniqueOrThrow({ where: { id } })).lastUsedAt).toEqual(t0);
    const later = new Date(t0.getTime() + 61_000);
    await verifyApiToken(`Bearer ${token}`, later);
    expect((await prisma().apiToken.findUniqueOrThrow({ where: { id } })).lastUsedAt).toEqual(later);
  });

  it("lists tokens without their hash", async () => {
    await createApiToken("a", "READ");
    const [row] = await listApiTokens();
    expect(Object.keys(row!).sort()).toEqual(["createdAt", "id", "lastUsedAt", "name", "prefix", "revokedAt", "scope"]);
  });

  it("refuses a token with no usable name", async () => {
    await expect(createApiToken("  \n ", "READ")).rejects.toThrow("needs a name");
  });

  it("lets a write token do everything and a read token only read", () => {
    expect(allows({ id: "1", name: "a", scope: "WRITE" }, "WRITE")).toBe(true);
    expect(allows({ id: "1", name: "a", scope: "READ" }, "READ")).toBe(true);
    expect(allows({ id: "1", name: "a", scope: "READ" }, "WRITE")).toBe(false);
  });
});
