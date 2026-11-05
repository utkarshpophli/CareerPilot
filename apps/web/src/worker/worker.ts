import type { PgBoss } from "pg-boss";

import type { PrismaClient } from "@/generated/prisma/client";
import { ActivityActor } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/action";
import type { Preferences } from "@/lib/job-scoring";
import type { boardAdapter } from "@/lib/job-search/boards";
import { ACTIONS, recordActivitySafe, runAsActor } from "@/lib/ledger";
import { enqueueBoardScans, enqueueLivenessChecks } from "@/lib/queue/enqueue";
import {
  BOARD_SCAN_ALL_OPTIONS,
  BOARD_SCAN_OPTIONS,
  LIVENESS_CHECK_OPTIONS,
  LIVENESS_MAX_AGE_MS,
  LIVENESS_SWEEP_OPTIONS,
  PROPOSAL_PRUNE_CRON,
  PROPOSAL_PRUNE_OPTIONS,
  QUEUES,
  type BoardScanJob,
  type LivenessCheckJob,
} from "@/lib/queue/queues";
import { pruneProposals } from "@/lib/proposals";
import { checkApplicationPosting } from "@/lib/services/liveness";
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

/** One queued liveness check. An application that is gone is skipped quietly. */
export async function handleLivenessCheck(deps: Pick<WorkerDeps, "db">, job: LivenessCheckJob): Promise<void> {
  await runAsActor(ACTOR, async () => {
    try {
      await checkApplicationPosting(deps.db, job.applicationId);
    } catch (error) {
      // "That application no longer exists" is an answer, not a failure worth a retry.
      if (error instanceof ActionError) return;
      throw error;
    }
  });
}

/** The liveness schedule's tick: a check for every draft with a link whose last check is missing or over a day old (at most 200 a tick). */
export async function handleLivenessSweep(deps: Pick<WorkerDeps, "db">, boss: Pick<PgBoss, "send">, now: Date = new Date()) {
  const due = await deps.db.application.findMany({
    where: {
      status: "DRAFT",
      archivedAt: null,
      awaitingReview: false,
      postingUrl: { startsWith: "http" },
      OR: [{ postingCheckedAt: null }, { postingCheckedAt: { lt: new Date(now.getTime() - LIVENESS_MAX_AGE_MS) } }],
    },
    select: { id: true },
    orderBy: [{ postingCheckedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    take: 200,
  });
  return enqueueLivenessChecks(boss, due.map((application) => application.id));
}

/** The daily prune: proposals that finished or expired long ago. Returns how many were deleted. */
export function handleProposalPrune(deps: Pick<WorkerDeps, "db">, now: Date = new Date()): Promise<number> {
  return pruneProposals(deps.db, now);
}

export type RunningWorker = { stop: () => Promise<void> };

export type StartOptions = {
  name: string;
  version: string;
  /** A cron expression for a scan of every board; undefined removes any schedule. */
  scanSchedule?: string;
  /** A cron expression for the liveness sweep; undefined removes any schedule. */
  livenessSchedule?: string;
  heartbeatMs?: number;
  /** How often the queue is looked at, in seconds. */
  pollSeconds?: number;
};

export async function startWorker(boss: PgBoss, deps: WorkerDeps, options: StartOptions): Promise<RunningWorker> {
  await boss.start();
  await boss.createQueue(QUEUES.boardScan, BOARD_SCAN_OPTIONS);
  await boss.createQueue(QUEUES.boardScanAll, BOARD_SCAN_ALL_OPTIONS);
  await boss.createQueue(QUEUES.livenessCheck, LIVENESS_CHECK_OPTIONS);
  await boss.createQueue(QUEUES.livenessSweep, LIVENESS_SWEEP_OPTIONS);
  await boss.createQueue(QUEUES.proposalPrune, PROPOSAL_PRUNE_OPTIONS);
  const polling = { pollingIntervalSeconds: options.pollSeconds ?? 5 };

  await boss.work<BoardScanJob>(QUEUES.boardScan, polling, async ([job]) => {
    await handleBoardScan(deps, job.data);
  });
  await boss.work(QUEUES.boardScanAll, polling, async () => {
    await handleScanAll(deps, boss);
  });

  await boss.work<LivenessCheckJob>(QUEUES.livenessCheck, polling, async ([job]) => {
    await handleLivenessCheck(deps, job.data);
  });
  await boss.work(QUEUES.livenessSweep, polling, async () => {
    await handleLivenessSweep(deps, boss);
  });
  await boss.work(QUEUES.proposalPrune, polling, async () => {
    await handleProposalPrune(deps);
  });

  if (options.scanSchedule) await boss.schedule(QUEUES.boardScanAll, options.scanSchedule, {});
  else await boss.unschedule(QUEUES.boardScanAll).catch(() => {});
  if (options.livenessSchedule) await boss.schedule(QUEUES.livenessSweep, options.livenessSchedule, {});
  else await boss.unschedule(QUEUES.livenessSweep).catch(() => {});
  await boss.schedule(QUEUES.proposalPrune, PROPOSAL_PRUNE_CRON, {});

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
