import type { AgentRun } from "@/generated/prisma/client";

// What a run looks like to a screen or an API client: plain values only (dates
// as ISO strings), so it can cross from the server to the browser. No server
// imports here, because browser code uses it too.

/** A RUNNING run with no step for this long is shown as stalled (its agent probably died). */
export const STALE_AFTER_MS = 30 * 60 * 1000;

export function isStale(run: Pick<AgentRun, "status" | "lastActivityAt">, now: Date = new Date()): boolean {
  return run.status === "RUNNING" && now.getTime() - run.lastActivityAt.getTime() > STALE_AFTER_MS;
}

export type RunView = {
  id: string;
  kind: string;
  title: string;
  actorKind: AgentRun["actorKind"];
  actorName: string;
  status: AgentRun["status"];
  startedAt: string;
  lastActivityAt: string;
  finishedAt: string | null;
  stepCount: number;
  lastStep: string;
  summary: string;
  applicationId: string | null;
  stalled: boolean;
};

export function toRunView(run: AgentRun, now: Date = new Date()): RunView {
  return {
    id: run.id,
    kind: run.kind,
    title: run.title,
    actorKind: run.actorKind,
    actorName: run.actorName,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    lastActivityAt: run.lastActivityAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    stepCount: run.stepCount,
    lastStep: run.lastStep,
    summary: run.summary,
    applicationId: run.applicationId,
    stalled: isStale(run, now),
  };
}

/** Changes whenever anything a screen shows about these runs changes; used to send updates only when needed. */
export const runsSignature = (runs: RunView[]) =>
  runs.map((run) => `${run.id}:${run.status}:${run.stepCount}:${run.lastActivityAt}:${run.stalled ? 1 : 0}`).join("|");
