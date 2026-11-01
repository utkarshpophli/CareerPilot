import "server-only";

import type { ActivityEvent, AgentRun, Prisma, PrismaClient } from "@/generated/prisma/client";
import { ActivityOutcome, RunStatus } from "@/generated/prisma/enums";
import { ACTIONS, currentActor, recordActivity } from "@/lib/ledger";
import { toRunView, type RunView } from "@/lib/runs-view";
import { ServiceError } from "@/lib/service-error";

// Runs: a piece of work (a scan, an evaluation) that an agent, the CLI or the
// app itself reports on while it happens. Each run is one AgentRun row plus
// ActivityEvents carrying its id, so the dashboard can show progress live and
// the ledger keeps the whole story. Every change to a run and the event that
// describes it commit together.

export class RunStateError extends ServiceError {}

const KIND_MAX = 40;
const TITLE_MAX = 200;
const SUMMARY_MAX = 300;

export { isStale, STALE_AFTER_MS } from "@/lib/runs-view";

export const RUNS_PAGE_SIZE = 50;

const FINAL_STATUSES: readonly RunStatus[] = [RunStatus.OK, RunStatus.FAILED, RunStatus.CANCELLED];

const isUniqueViolation = (error: unknown) => typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

export type StartRunInput = {
  kind: string;
  title: string;
  applicationId?: string | null;
  idempotencyKey?: string | null;
};

/** Opens a run for the acting client. With an idempotency key, a retry gets the same run back. */
export async function startRun(db: PrismaClient, input: StartRunInput): Promise<AgentRun> {
  const kind = input.kind.trim().toLowerCase().slice(0, KIND_MAX);
  const title = input.title.trim().slice(0, TITLE_MAX);
  if (!kind) throw new RunStateError("bad_request", "A run needs a kind, for example 'scan'.");
  if (!title) throw new RunStateError("bad_request", "A run needs a title.");
  const idempotencyKey = input.idempotencyKey?.trim().slice(0, 200) || null;

  if (idempotencyKey) {
    const existing = await db.agentRun.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;
  }

  const actor = currentActor();
  try {
    return await db.$transaction(async (tx) => {
      const run = await tx.agentRun.create({
        data: { kind, title, actorKind: actor.kind, actorName: actor.name ?? "", applicationId: input.applicationId ?? null, idempotencyKey },
      });
      await recordActivity(tx, {
        action: ACTIONS.runStarted,
        summary: `Started: ${title}`,
        targetType: "run",
        targetId: run.id,
        applicationId: run.applicationId,
        runId: run.id,
      });
      return run;
    });
  } catch (error) {
    // Two retries raced: the other one won, so hand back its run.
    if (idempotencyKey && isUniqueViolation(error)) {
      const existing = await db.agentRun.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }
    throw error;
  }
}

export type RunStepInput = { summary: string; data?: Prisma.InputJsonValue };

/** Adds a step to a RUNNING run: bumps the counter and writes run.step. */
export async function addRunStep(db: PrismaClient, runId: string, input: RunStepInput): Promise<AgentRun> {
  const summary = input.summary.trim().slice(0, SUMMARY_MAX);
  if (!summary) throw new RunStateError("bad_request", "A step needs a summary.");

  return db.$transaction(async (tx) => {
    const { count } = await tx.agentRun.updateMany({
      where: { id: runId, status: RunStatus.RUNNING },
      data: { stepCount: { increment: 1 }, lastStep: summary, lastActivityAt: new Date() },
    });
    if (count === 0) throw await whyNotRunning(tx, runId);
    const run = await tx.agentRun.findUniqueOrThrow({ where: { id: runId } });
    await recordActivity(tx, {
      action: ACTIONS.runStep,
      summary,
      targetType: "run",
      targetId: run.id,
      applicationId: run.applicationId,
      runId: run.id,
      data: input.data,
    });
    return run;
  });
}

export type FinishRunInput = { status: RunStatus; summary?: string };

/** Closes a run. Finishing again with the same status changes nothing; with a different one it is a conflict. */
export async function finishRun(db: PrismaClient, runId: string, input: FinishRunInput): Promise<AgentRun> {
  if (!FINAL_STATUSES.includes(input.status)) throw new RunStateError("bad_request", "A run finishes as OK, FAILED or CANCELLED.");
  const summary = input.summary?.trim().slice(0, SUMMARY_MAX) ?? "";

  return db.$transaction(async (tx) => {
    const now = new Date();
    const { count } = await tx.agentRun.updateMany({
      where: { id: runId, status: RunStatus.RUNNING },
      data: { status: input.status, finishedAt: now, lastActivityAt: now, summary },
    });
    const run = await tx.agentRun.findUnique({ where: { id: runId } });
    if (!run) throw new RunStateError("not_found", "No such run.");
    if (count === 0) {
      if (run.status === input.status) return run;
      throw new RunStateError("conflict", `This run already finished as ${run.status}.`);
    }
    const label = input.status === RunStatus.OK ? "Finished" : input.status === RunStatus.FAILED ? "Failed" : "Cancelled";
    await recordActivity(tx, {
      action: ACTIONS.runFinished,
      summary: summary || `${label}: ${run.title}`,
      targetType: "run",
      targetId: run.id,
      applicationId: run.applicationId,
      runId: run.id,
      outcome: input.status === RunStatus.FAILED ? ActivityOutcome.ERROR : ActivityOutcome.OK,
    });
    return run;
  });
}

async function whyNotRunning(tx: Pick<Prisma.TransactionClient, "agentRun">, runId: string): Promise<RunStateError> {
  const run = await tx.agentRun.findUnique({ where: { id: runId }, select: { status: true } });
  return run ? new RunStateError("conflict", `This run already finished as ${run.status}.`) : new RunStateError("not_found", "No such run.");
}

export type RunDetail = AgentRun & { events: ActivityEvent[] };

/** A run with every event that belongs to it, oldest first; null when there is no such run. */
export async function getRun(db: PrismaClient, runId: string): Promise<RunDetail | null> {
  const run = await db.agentRun.findUnique({ where: { id: runId } });
  if (!run) return null;
  const events = await db.activityEvent.findMany({ where: { runId }, orderBy: [{ at: "asc" }, { id: "asc" }] });
  return { ...run, events };
}

/**
 * What the Runs screen and the "Running now" card show: every run still going,
 * then the newest finished ones, newest first overall, as plain values.
 */
export async function loadRunsSnapshot(db: Pick<PrismaClient, "agentRun">, limit = 20, now: Date = new Date()): Promise<RunView[]> {
  const [running, recent] = await Promise.all([
    db.agentRun.findMany({ where: { status: RunStatus.RUNNING }, orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: limit }),
    db.agentRun.findMany({ orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: limit }),
  ]);
  const byId = new Map([...running, ...recent].map((run) => [run.id, run]));
  return [...byId.values()]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || (a.id < b.id ? 1 : -1))
    .slice(0, limit)
    .map((run) => toRunView(run, now));
}

export type RunFilter = { status?: RunStatus };
export type RunPage = {
  runs: AgentRun[];
  /** Pass as `before` to get the next, older page; null when there is none. */
  next: string | null;
};

/** Newest first. `before` is the `next` of the previous page. */
export async function listRuns(
  db: Pick<PrismaClient, "agentRun">,
  filter: RunFilter = {},
  { before, limit = RUNS_PAGE_SIZE }: { before?: string; limit?: number } = {},
): Promise<RunPage> {
  const rows = await db.agentRun.findMany({
    where: filter.status ? { status: filter.status } : {},
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
  });
  const runs = rows.slice(0, limit);
  return { runs, next: rows.length > limit ? runs[runs.length - 1]!.id : null };
}
