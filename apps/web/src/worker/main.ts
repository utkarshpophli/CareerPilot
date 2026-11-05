// The worker process (docs/adr/0004): `node worker.mjs`, built from this file by the Dockerfile (esbuild) or run in
// development with `yarn worker`. It needs the same environment as the web process (database, secret, settings), because it
// uses the same services. It serves the queue until it is told to stop.

import { env } from "@/lib/env";
import { logServerError } from "@/lib/log";
import { createWorkerBoss } from "@/lib/queue/boss";
import { prisma } from "@/lib/prisma";
import { loadProfile } from "@/lib/profile-data";
import { preferencesFor } from "@/lib/services/preferences";
import { loadSettings } from "@/lib/settings-data";
import { appVersion } from "@/lib/version";

import { startWorker } from "./worker";

const NAME = process.env.CAREERPILOT_WORKER_NAME?.trim() || "worker-1";
/** The web container applies the migrations; wait for them rather than crash if this container is first up. */
const MIGRATION_WAIT_MS = 120_000;

/** Whether the database answered that the table is not there (yet): the one thing worth waiting for. Anything else is a real failure. */
const tableMissing = (error: unknown) => (error as { code?: string }).code === "P2021" || /does not exist/i.test((error as Error).message);

async function waitForMigrations() {
  const until = Date.now() + MIGRATION_WAIT_MS;
  for (;;) {
    try {
      await prisma.workerHeartbeat.count();
      return;
    } catch (error) {
      if (!tableMissing(error)) throw error;
      if (Date.now() > until) throw new Error(`the database has no worker table after ${MIGRATION_WAIT_MS / 1000}s; has the web process applied the migrations? (${(error as Error).message})`);
      console.log("worker: waiting for the database migrations…");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

async function main() {
  // Reading the settings checks them all: a missing or weak one stops the worker here with its own message.
  const databaseUrl = env.DATABASE_URL;
  await waitForMigrations();
  const boss = createWorkerBoss(databaseUrl);
  boss.on("error", (error) => logServerError("queue", error));
  const worker = await startWorker(
    boss,
    { db: prisma, preferences: async () => preferencesFor(await loadProfile(), (await loadSettings()).scanPreferences) },
    { name: NAME, version: appVersion, scanSchedule: env.CAREERPILOT_SCAN_SCHEDULE, livenessSchedule: env.CAREERPILOT_LIVENESS_SCHEDULE },
  );
  console.log(`worker ${NAME} ready (version ${appVersion})${env.CAREERPILOT_SCAN_SCHEDULE ? `, scanning on "${env.CAREERPILOT_SCAN_SCHEDULE}"` : ", no scan schedule"}${env.CAREERPILOT_LIVENESS_SCHEDULE ? `, checking drafts on "${env.CAREERPILOT_LIVENESS_SCHEDULE}"` : ", no liveness schedule"}, pruning proposals daily`);

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`worker ${NAME}: ${signal}, finishing the job in hand`);
    await worker.stop();
    await prisma.$disconnect();
    process.exitCode = 0;
    process.exit();
  };
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

main().catch((error: unknown) => {
  console.error("worker failed to start:", error);
  process.exit(1);
});
