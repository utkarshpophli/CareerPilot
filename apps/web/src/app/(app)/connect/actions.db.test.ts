import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { OPENCODE_REDIRECT_URI } from "@/lib/connect/instructions";
import { loadSettings } from "@/lib/settings-data";
import { createTestClient, resetDatabase } from "@/test/db";

import { checkConnection, prepareOpenCode } from "./actions";

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

describe("prepareOpenCode", () => {
  it("turns the connector on and allows OpenCode's callback address", async () => {
    expect(await prepareOpenCode({})).toEqual({ ok: true, data: { connectorOn: true, redirectAllowed: true } });
    const settings = await loadSettings();
    expect(settings.connectorEnabledAt).not.toBeNull();
    expect(settings.connectorRedirects).toEqual([OPENCODE_REDIRECT_URI]);
  });

  it("changes nothing the second time, and keeps the apps already allowed", async () => {
    await prisma().setting.create({ data: { key: "connectorRedirects", value: JSON.stringify(["https://n8n.example/callback"]) } });
    await prepareOpenCode({});
    const first = await loadSettings();
    await prepareOpenCode({});
    const second = await loadSettings();
    expect(second.connectorRedirects).toEqual(["https://n8n.example/callback", OPENCODE_REDIRECT_URI]);
    expect(second.connectorEnabledAt).toBe(first.connectorEnabledAt);
  });

  it("refuses when signed out", async () => {
    session.signedIn = false;
    expect(await prepareOpenCode({})).toMatchObject({ ok: false });
    expect((await loadSettings()).connectorRedirects).toEqual([]);
  });
});

describe("checkConnection", () => {
  it("reports assistants that called after the moment it was asked from", async () => {
    const before = new Date(Date.now() - 60_000);
    await prisma().apiToken.create({ data: { id: "t1", name: "claude-code", tokenHash: "a".repeat(64), prefix: "cp_aaaaaa", lastUsedAt: new Date() } });
    await prisma().apiToken.create({ data: { id: "t2", name: "old", tokenHash: "b".repeat(64), prefix: "cp_bbbbbb", lastUsedAt: new Date(Date.now() - 3_600_000) } });
    const result = await checkConnection({ since: before.toISOString() });
    expect(result.ok && result.data.seen.map((assistant) => assistant.name)).toEqual(["claude-code"]);
  });

  it("answers nothing seen when nobody has called", async () => {
    const result = await checkConnection({ since: new Date().toISOString() });
    expect(result).toEqual({ ok: true, data: { seen: [] } });
  });

  it("rejects a malformed time and a signed-out caller", async () => {
    expect(await checkConnection({ since: "yesterday" })).toMatchObject({ ok: false });
    session.signedIn = false;
    expect(await checkConnection({ since: new Date().toISOString() })).toMatchObject({ ok: false });
  });
});
