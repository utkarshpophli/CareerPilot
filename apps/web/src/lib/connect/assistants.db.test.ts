import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { assistantsSeenSince, clientKey, listConnectedAssistants, noteMcpClient } from "./assistants";

const db = createTestClient();
beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

const t0 = new Date("2026-11-02T10:00:00Z");
const at = (seconds: number) => new Date(t0.getTime() + seconds * 1000);
const dayStart = new Date("2026-11-02T00:00:00Z");

describe("noteMcpClient", () => {
  it("remembers a client by a hash of its id, never the id itself", async () => {
    await noteMcpClient(db, "signed.client.id.value", "OpenCode", t0);
    const [row] = await db.mcpClient.findMany();
    expect(row).toMatchObject({ id: clientKey("signed.client.id.value"), name: "OpenCode", firstSeenAt: t0, lastSeenAt: t0 });
    expect(JSON.stringify(row)).not.toContain("signed.client.id.value");
    expect(clientKey("a")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("moves 'last seen' on later calls, at most once a minute, and keeps when it was first seen", async () => {
    await noteMcpClient(db, "c", "Claude", t0);
    await noteMcpClient(db, "c", "Claude", at(20));
    expect((await db.mcpClient.findFirstOrThrow()).lastSeenAt).toEqual(t0);
    await noteMcpClient(db, "c", "Claude Code", at(61));
    expect(await db.mcpClient.findFirstOrThrow()).toMatchObject({ name: "Claude Code", firstSeenAt: t0, lastSeenAt: at(61) });
    expect(await db.mcpClient.count()).toBe(1);
  });

  it("keeps a client's name to a short printable line", async () => {
    await noteMcpClient(db, "c", "  Evil\n<script>alert(1)</script>".padEnd(200, "x"), t0);
    const { name } = await db.mcpClient.findFirstOrThrow();
    expect(name).not.toMatch(/[\n<>]/);
    expect(name.length).toBeLessThanOrEqual(60);
  });
});

describe("listConnectedAssistants", () => {
  async function seed() {
    await db.apiToken.create({ data: { id: "tok-1", name: "claude-code", tokenHash: "a".repeat(64), prefix: "cp_aaaaaa", scope: "WRITE", lastUsedAt: at(300) } });
    await db.apiToken.create({ data: { id: "tok-2", name: "never used", tokenHash: "b".repeat(64), prefix: "cp_bbbbbb", scope: "READ" } });
    await db.apiToken.create({ data: { id: "tok-3", name: "revoked one", tokenHash: "c".repeat(64), prefix: "cp_cccccc", scope: "READ", lastUsedAt: at(500), revokedAt: at(600) } });
    await noteMcpClient(db, "client-oc", "OpenCode", at(100));
    // Ledger events and runs by name, today and before today.
    await db.activityEvent.createMany({
      data: [
        { action: "application.created", summary: "x", actorKind: "CLI", actorName: "claude-code", at: at(10) },
        { action: "run.finished", summary: "y", actorKind: "CLI", actorName: "claude-code", at: at(20) },
        { action: "application.created", summary: "old", actorKind: "CLI", actorName: "claude-code", at: new Date("2026-11-01T10:00:00Z") },
        { action: "mcp.tool_called", summary: "z", actorKind: "MCP", actorName: "OpenCode", at: at(30) },
        { action: "application.created", summary: "other kind", actorKind: "USER", actorName: "claude-code", at: at(40) },
      ],
    });
    await db.agentRun.create({ data: { kind: "scan", title: "Scan", actorKind: "CLI", actorName: "claude-code" } });
    await db.agentRun.create({ data: { kind: "scan", title: "Scan 2", actorKind: "CLI", actorName: "claude-code" } });
    await db.agentRun.create({ data: { kind: "scan", title: "Someone else", actorKind: "CLI", actorName: "other" } });
  }

  it("merges tokens and MCP clients, newest first, with today's actions and runs", async () => {
    await seed();
    const list = await listConnectedAssistants(db, dayStart);
    expect(list.map((a) => [a.name, a.via])).toEqual([
      ["claude-code", "token"],
      ["OpenCode", "mcp"],
      ["never used", "token"],
    ]);
    const code = list[0]!;
    expect(code).toMatchObject({ id: "tok-1", scope: "WRITE", callsToday: 2, runs: 2, revokable: true, lastSeenAt: at(300).toISOString() });
    expect(list[1]).toMatchObject({ callsToday: 1, runs: 0, revokable: false, lastSeenAt: at(100).toISOString() });
    expect(list[2]).toMatchObject({ lastSeenAt: null, callsToday: 0 });
  });

  it("leaves revoked tokens out, and never exposes a hash", async () => {
    await seed();
    const list = await listConnectedAssistants(db, dayStart);
    expect(list.some((a) => a.name === "revoked one")).toBe(false);
    expect(JSON.stringify(list)).not.toMatch(/a{20}|tokenHash/);
  });

  it("is empty when nothing is connected", async () => {
    expect(await listConnectedAssistants(db, dayStart)).toEqual([]);
  });
});

describe("assistantsSeenSince", () => {
  it("returns only the assistants whose first call came after the moment given", async () => {
    await db.apiToken.create({ data: { id: "tok-1", name: "old", tokenHash: "a".repeat(64), prefix: "cp_aaaaaa", lastUsedAt: at(10) } });
    await db.apiToken.create({ data: { id: "tok-2", name: "new", tokenHash: "b".repeat(64), prefix: "cp_bbbbbb", lastUsedAt: at(200) } });
    await noteMcpClient(db, "c", "OpenCode", at(300));
    const seen = await assistantsSeenSince(db, at(100), dayStart);
    expect(seen.map((a) => a.name).sort()).toEqual(["OpenCode", "new"]);
    expect(await assistantsSeenSince(db, at(1000), dayStart)).toEqual([]);
  });
});
