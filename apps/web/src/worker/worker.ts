import type { PgBoss } from "pg-boss";

import type { PrismaClient } from "@/generated/prisma/client";
import { ActivityActor } from "@/generated/prisma/enums";
import type { Preferences } from "@/lib/job-scoring";
import type { boardAdapter } from "@/lib/job-search/boards";
import { ACTIONS, recordActivitySafe, runAsActor } from "@/lib/ledger";
import { BOARD_SCAN_ALL_OPTIONS, BOARD_SCAN_OPTIONS, QUEUES, type BoardScanJob } from "@/lib/queue/queues";
import { enqueueBoardScans } from "@/lib/queue/enqueue";
import { scanOneBoard } from "@/lib/services/companies";

// What the worker process does (docs/adr/0004). No top-level side effects, so tests can start and stop it; main.ts is the
// process entry. Everything a job does is a service the web process also uses, recorded in the Activity Ledger as the
// scheduler, so a queued scan and a clicked one look alike.

const ACTOR = { kind: ActivityActor.SCHEDULER, name: "worker" } as const;
const HEARTBEAT_MS = 30_000;

export type WorkerDeps = {
  db: PrismaClient;
  /** What a scan scores new postings against; undefined scores nothing. */
  preferences: () => Promise<Preferences | undefined>;
  adapters?: (source: Parameters<typeof boardAdapter>[0]) => ReturnType<typeof boardAdapter>;
};

/** One queued board scan. A company that is gone or paused is skipped quietly. */
export async function handleBoardScan(deps: WorkerDeps, job: BoardScanJob): Promise<void> {
  await runAsActor(ACTOR, async () => {
    const outcome = await scanOneBoard(deps.db, job.companyId, { preferences: await deps.preferences() }, deps.adapters ? { adapters: deps.adapters } : {});
    if (!outcome) return;
    const summary = outcome.error ? `Scanned ${outcome.name}: could not be read (${outcome.error})` : `Scanned ${outcome.name}: ${outcome.found} postings (${outcome.added} new, ${outcome.closed} closed)`;
    await recordActivitySafe(deps.db, {
      action: ACTIONS.boardsScanned,
      summary,
      targetType: "company",
      targetId: outcome.id,
      data: { found: outcome.found, added: outcome.added ?? 0, closed: outcome.closed ?? 0, failed: outcome.error ? 1 : 0 },
    });
  });
}

/** The schedule's tick: one board-scan job for every enabled board. */
export async function handleScanAll(deps: Pick<WorkerDeps, "db">, boss: Pick<PgBoss, "send">) {
  const companies = await deps.db.trackedCompany.findMany({ where: { enabled: true }, select: { id: true }, orderBy: { id: "asc" } });
  return enqueueBoardScans(boss, companies.map((company) => company.id));
}

export type RunningWorker = { stop: () => Promise<void> };

export type StartOptions = {
  name: string;
  version: string;
  /** A cron expression for a scan of every board; undefined removes any schedule. */
  scanSchedule?: string;
  heartbeatMs?: number;
  /** How often the queue is looked at, in seconds. */
  pollSeconds?: number;
};

export async function startWorker(boss: PgBoss, deps: WorkerDeps, options: StartOptions): Promise<RunningWorker> {
  await boss.start();
  await boss.createQueue(QUEUES.boardScan, BOARD_SCAN_OPTIONS);
  await boss.createQueue(QUEUES.boardScanAll, BOARD_SCAN_ALL_OPTIONS);
  const polling = { pollingIntervalSeconds: options.pollSeconds ?? 5 };

  await boss.work<BoardScanJob>(QUEUES.boardScan, polling, async ([job]) => {
    await handleBoardScan(deps, job.data);
  });
  await boss.work(QUEUES.boardScanAll, polling, async () => {
    await handleScanAll(deps, boss);
  });

  if (options.scanSchedule) await boss.schedule(QUEUES.boardScanAll, options.scanSchedule, {});
  else await boss.unschedule(QUEUES.boardScanAll).catch(() => {});

  const startedAt = new Date();
  const beat = () =>
    deps.db.workerHeartbeat
      .upsert({ where: { id: options.name }, create: { id: options.name, startedAt, beatAt: new Date(), version: options.version }, update: { beatAt: new Date(), version: options.version } })
      .catch(() => {});
  await beat();
  const timer = setInterval(() => void beat(), options.heartbeatMs ?? HEARTBEAT_MS);
  timer.unref();

  return {
    stop: async () => {
      clearInterval(timer);
      await boss.stop({ graceful: true, timeout: 10_000 });
      await deps.db.workerHeartbeat.deleteMany({ where: { id: options.name } }).catch(() => {});
    },
  };
}
