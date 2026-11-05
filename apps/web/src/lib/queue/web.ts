import "server-only";

import type { PgBoss } from "pg-boss";

import { env } from "@/lib/env";

import { createClientBoss } from "./boss";

// The web process's connection to the queue, made on first use and only when CAREERPILOT_WORKER is on.

/** Whether this server hands scans to a worker. */
export const workerEnabled = (): boolean => env.CAREERPILOT_WORKER === "on";

const holder = globalThis as unknown as { __careerpilotBoss?: Promise<PgBoss> };

/** The started queue client; a rejected start is forgotten so the next call tries again. */
export function queueClient(): Promise<PgBoss> {
  if (!holder.__careerpilotBoss) {
    const boss = createClientBoss(env.DATABASE_URL);
    boss.on("error", () => {});
    holder.__careerpilotBoss = boss.start().catch((error: unknown) => {
      holder.__careerpilotBoss = undefined;
      throw error;
    });
  }
  return holder.__careerpilotBoss;
}
