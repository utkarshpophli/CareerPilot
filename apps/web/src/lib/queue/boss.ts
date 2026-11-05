import { PgBoss } from "pg-boss";

import { QUEUE_SCHEMA } from "./queues";

// The one place that constructs the queue client (docs/adr/0004). A worker owns the queue's tables (it installs and
// upgrades them, and runs its maintenance and schedules); the web process only puts jobs in, on a small pool of its own.

/** The worker's side: installs the schema, supervises, runs schedules. */
export function createWorkerBoss(connectionString: string): PgBoss {
  return new PgBoss({ connectionString, schema: QUEUE_SCHEMA, max: 4 });
}

/** The web side: no installing, no maintenance, no schedules. Fails to start if no worker has installed the tables yet. */
export function createClientBoss(connectionString: string): PgBoss {
  return new PgBoss({ connectionString, schema: QUEUE_SCHEMA, max: 2, migrate: false, supervise: false, schedule: false });
}
