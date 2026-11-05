import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import type { Prisma } from "@/generated/prisma/client";
import { ActivityActor, ActivityOutcome } from "@/generated/prisma/enums";
import { logServerError } from "@/lib/log";
import { redactJson, redactSecrets } from "@/lib/redact";

// The Activity Ledger: an append-only record of what the app and its agents
// did, shown on the Activity page and counted on Insights. Writers call
// `recordActivity` in the same transaction as the change they describe.

/** The action names written to the ledger. Dotted: what it concerns, then what happened. */
export const ACTIONS = {
  applicationCreated: "application.created",
  applicationStatusChanged: "application.status_changed",
  applicationStatusUndone: "application.status_undone",
  documentVersionSaved: "document.version_saved",
  jobQueued: "job.queued",
  jobFinished: "job.finished",
  mcpToolCalled: "mcp.tool_called",
  agentScanFinished: "agent.scan_finished",
  companyAdded: "company.added",
  companyToggled: "company.toggled",
  companyRemoved: "company.removed",
  boardsScanned: "boards.scanned",
  postingChecked: "posting.checked",
  postingReviewed: "posting.reviewed",
  proposalCreated: "proposal.created",
  proposalConfirmed: "proposal.confirmed",
  proposalDismissed: "proposal.dismissed",
  runStarted: "run.started",
  runStep: "run.step",
  runFinished: "run.finished",
} as const;
export type ActivityAction = (typeof ACTIONS)[keyof typeof ACTIONS];

export type Actor = { kind: ActivityActor; name?: string };

/** Who is acting when nothing says otherwise: the person using the dashboard. */
const DEFAULT_ACTOR: Actor = { kind: ActivityActor.USER };

const actors = new AsyncLocalStorage<Actor>();

/** Runs `run` with `actor` as the one recorded for everything it does, however deep. */
export function runAsActor<T>(actor: Actor, run: () => T): T {
  return actors.run({ kind: actor.kind, name: actor.name?.trim().slice(0, 60) ?? "" }, run);
}

export function currentActor(): Actor {
  return actors.getStore() ?? DEFAULT_ACTOR;
}

export type ActivityInput = {
  action: ActivityAction;
  /** One readable line. Never put secrets or whole documents in it. */
  summary: string;
  targetType?: string;
  targetId?: string | null;
  applicationId?: string | null;
  platform?: string;
  model?: string;
  outcome?: ActivityOutcome;
  /** The AgentRun this event is a step of (see runs.ts). */
  runId?: string | null;
  /** Small structured details (counts, causes, durations). */
  data?: Prisma.InputJsonValue;
  /** Overrides the actor from context, e.g. for work that runs on its own. */
  actor?: Actor;
};

/** Anything with an `activityEvent` delegate: the client or a transaction. */
type Db = Pick<Prisma.TransactionClient, "activityEvent">;

const SUMMARY_MAX = 300;

/** Writes one event. Inside a transaction it commits or rolls back with the change it describes. */
export async function recordActivity(db: Db, input: ActivityInput): Promise<void> {
  const actor = input.actor ?? currentActor();
  await db.activityEvent.create({
    data: {
      actorKind: actor.kind,
      actorName: actor.name ?? "",
      action: input.action,
      summary: redactSecrets(input.summary).slice(0, SUMMARY_MAX),
      targetType: input.targetType ?? "",
      targetId: input.targetId ?? null,
      applicationId: input.applicationId ?? null,
      platform: input.platform ?? "",
      model: input.model ?? "",
      outcome: input.outcome ?? ActivityOutcome.OK,
      runId: input.runId ?? null,
      data: redactJson(input.data),
    },
  });
}

/** For writers outside a transaction: a failure to log is logged, and never fails the work. */
export async function recordActivitySafe(db: Db, input: ActivityInput): Promise<void> {
  try {
    await recordActivity(db, input);
  } catch (error) {
    logServerError(`activity ${input.action}`, error);
  }
}

export type ActivityFilter = {
  actorKind?: ActivityActor;
  /** An action name, or a prefix ending in a dot such as "application.". */
  action?: string;
  applicationId?: string;
  platform?: string;
};

export type ActivityPage = {
  events: Awaited<ReturnType<Db["activityEvent"]["findMany"]>>;
  /** Pass as `before` to get the next, older page; null when there is none. */
  next: string | null;
};

export const ACTIVITY_PAGE_SIZE = 50;

/** Newest first. `before` is the `next` of the previous page. */
export async function listActivity(
  db: Db,
  filter: ActivityFilter = {},
  { before, limit = ACTIVITY_PAGE_SIZE }: { before?: string; limit?: number } = {},
): Promise<ActivityPage> {
  const where: Prisma.ActivityEventWhereInput = {
    ...(filter.actorKind ? { actorKind: filter.actorKind } : {}),
    ...(filter.applicationId ? { applicationId: filter.applicationId } : {}),
    ...(filter.platform ? { platform: filter.platform } : {}),
    ...(filter.action ? (filter.action.endsWith(".") ? { action: { startsWith: filter.action } } : { action: filter.action }) : {}),
  };
  const cursor = before ? { id: before } : undefined;
  const rows = await db.activityEvent.findMany({
    where,
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor, skip: 1 } : {}),
  });
  const events = rows.slice(0, limit);
  return { events, next: rows.length > limit ? events[events.length - 1]!.id : null };
}
