import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { workerStatus } from "@/lib/worker-status";
import { appVersion } from "@/lib/version";

/** A database that doesn't answer within this counts as down. */
const DB_TIMEOUT_MS = 3_000;

/**
 * GET /api/health (E12-4), for CapRover's and Docker's health checks: 200
 * when the database answers, 503 when it doesn't. Open without a session
 * (the proxy skips it), so it says nothing private: only the version and whether a worker is reporting.
 */
export async function GET() {
  const db = await Promise.race([
    prisma.$queryRaw`SELECT 1`.then(() => "ok" as const),
    new Promise<"unreachable">((resolve) => setTimeout(() => resolve("unreachable"), DB_TIMEOUT_MS).unref()),
  ]).catch(() => "unreachable" as const);
  // Whether a worker process is reporting (docs/adr/0004). It never makes the check fail: a server without a worker is fine.
  const worker = db === "ok" ? workerStatus(await prisma.workerHeartbeat.findMany({ select: { beatAt: true } }).catch(() => [])) : "none";
  return NextResponse.json(
    { status: db === "ok" ? "ok" : "unavailable", version: appVersion, db, worker },
    { status: db === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
