import "server-only";

import { createHash } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { ActivityActor, type ApiScope } from "@/generated/prisma/enums";
import { cleanTokenName } from "@/lib/api-token-core";

// The assistants that have connected, for the Connect screen: API tokens (the
// pilot CLI, scripts, assistants working in a shell) and MCP clients (Claude,
// OpenCode and others through the connector).

/** How often an MCP client's "last seen" time is rewritten, so a busy client does not write on every call. */
const TOUCH_EVERY_MS = 60_000;

/** SHA-256 of an OAuth client id, in hex. The id itself is not kept. */
export const clientKey = (clientId: string) => createHash("sha256").update(clientId).digest("hex");

/** Notes that an MCP client made an authorised call. Cheap: at most one write a minute per client. */
export async function noteMcpClient(db: Pick<PrismaClient, "mcpClient">, clientId: string, name: string, now = new Date()): Promise<void> {
  const id = clientKey(clientId);
  const clean = cleanTokenName(name) || "An MCP app";
  const { count } = await db.mcpClient.updateMany({ where: { id, lastSeenAt: { lt: new Date(now.getTime() - TOUCH_EVERY_MS) } }, data: { name: clean, lastSeenAt: now } });
  if (count === 0) await db.mcpClient.createMany({ data: [{ id, name: clean, firstSeenAt: now, lastSeenAt: now }], skipDuplicates: true });
}

export type ConnectedAssistant = {
  /** Unique across both kinds: "token:<id>" or "mcp:<hash>". */
  key: string;
  via: "token" | "mcp";
  /** The token's id, for Revoke; empty for MCP clients. */
  id: string;
  name: string;
  scope: ApiScope | null;
  /** ISO time of the last call, or null if it has not called yet. */
  lastSeenAt: string | null;
  /** Ledger entries this assistant made since the start of today. Reading calls are not in the ledger, so this counts what it changed or ran. */
  callsToday: number;
  /** Runs it has reported, all time. */
  runs: number;
  /** Whether it can be revoked here (tokens can; MCP apps are signed out together in Settings → MCP connector). */
  revokable: boolean;
};

const keyed = (kind: ActivityActor, name: string) => `${kind}:${name}`;

export async function listConnectedAssistants(db: Pick<PrismaClient, "apiToken" | "mcpClient" | "activityEvent" | "agentRun">, dayStart: Date): Promise<ConnectedAssistant[]> {
  const [tokens, clients, events, runs] = await Promise.all([
    db.apiToken.findMany({ where: { revokedAt: null }, select: { id: true, name: true, scope: true, lastUsedAt: true } }),
    db.mcpClient.findMany({ select: { id: true, name: true, lastSeenAt: true } }),
    db.activityEvent.groupBy({ by: ["actorKind", "actorName"], where: { at: { gte: dayStart }, actorKind: { in: [ActivityActor.CLI, ActivityActor.MCP] } }, _count: { _all: true } }),
    db.agentRun.groupBy({ by: ["actorKind", "actorName"], where: { actorKind: { in: [ActivityActor.CLI, ActivityActor.MCP] } }, _count: { _all: true } }),
  ]);
  const calls = new Map(events.map((row) => [keyed(row.actorKind, row.actorName), row._count._all]));
  const runCounts = new Map(runs.map((row) => [keyed(row.actorKind, row.actorName), row._count._all]));

  const list: ConnectedAssistant[] = [
    ...tokens.map((token): ConnectedAssistant => ({
      key: `token:${token.id}`,
      via: "token",
      id: token.id,
      name: token.name,
      scope: token.scope,
      lastSeenAt: token.lastUsedAt?.toISOString() ?? null,
      callsToday: calls.get(keyed(ActivityActor.CLI, token.name)) ?? 0,
      runs: runCounts.get(keyed(ActivityActor.CLI, token.name)) ?? 0,
      revokable: true,
    })),
    ...clients.map((client): ConnectedAssistant => ({
      key: `mcp:${client.id}`,
      via: "mcp",
      id: "",
      name: client.name,
      scope: null,
      lastSeenAt: client.lastSeenAt.toISOString(),
      callsToday: calls.get(keyed(ActivityActor.MCP, client.name)) ?? 0,
      runs: runCounts.get(keyed(ActivityActor.MCP, client.name)) ?? 0,
      revokable: false,
    })),
  ];
  // Seen most recently first; never-used ones last.
  return list.sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "") || a.name.localeCompare(b.name));
}

/** The assistants that called after `since`: what "Test connection" waits for. */
export async function assistantsSeenSince(db: Parameters<typeof listConnectedAssistants>[0], since: Date, dayStart: Date): Promise<ConnectedAssistant[]> {
  return (await listConnectedAssistants(db, dayStart)).filter((assistant) => assistant.lastSeenAt !== null && new Date(assistant.lastSeenAt) > since);
}
