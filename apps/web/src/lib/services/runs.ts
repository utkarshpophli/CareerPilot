import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { ActivityActor, RunStatus } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/action";
import { currentActor } from "@/lib/ledger";
import { logServerError } from "@/lib/log";
import { addRunStep, finishRun, startRun } from "@/lib/runs";
import { ServiceError } from "@/lib/service-error";

// Runs as a service. An assistant's work should be watchable: every operation
// in this folder reports itself as a run (start, one step with what came of
// it, finish) when an assistant does it, whichever door it came through. The
// owner's own clicks and the app's own work are not reported: the Activity
// Ledger already has them, and the Runs page is for what assistants do.

export { addRunStep, finishRun, getRun, listRuns, startRun } from "@/lib/runs";

/** Who counts as an assistant: a token client over REST or the pilot CLI, or a connected MCP client. */
const ASSISTANTS: readonly ActivityActor[] = [ActivityActor.CLI, ActivityActor.MCP];

/** Adds a step to the operation's run; does nothing when nobody is watching (the owner's own click, or reporting failed). */
export type StepReporter = (summary: string, data?: Prisma.InputJsonObject) => Promise<void>;

export type OperationRun = { kind: string; title: string; applicationId?: string | null };
export type OperationResult = { summary: string; data?: Prisma.InputJsonObject };

/** What a failed run may say: only errors written in plain terms for people. Anything else is a bug whose text stays in the server log. */
const reasonFor = (error: unknown) => (error instanceof ServiceError || error instanceof ActionError ? error.message : "It failed unexpectedly; the server log has the details.");

/** Runs `work`; reporting must never be the reason the work fails, so a problem with the run is logged and the work carries on. */
async function quietly<T>(what: string, report: () => Promise<T>): Promise<T | undefined> {
  try {
    return await report();
  } catch (error) {
    logServerError(`run report (${what})`, error);
    return undefined;
  }
}

/**
 * Does `work`, and when an assistant is doing it, reports it as a run: started
 * before, one step with `describe(result)` after, finished OK, or FAILED with
 * the reason (the error still goes to the caller). `describe` returns small
 * counts, never documents.
 */
export async function reportAsRun<T>(db: PrismaClient, operation: OperationRun, work: (run: { step: StepReporter }) => Promise<T>, describe?: (result: T) => OperationResult): Promise<T> {
  if (!ASSISTANTS.includes(currentActor().kind)) return work({ step: async () => {} });
  const run = await quietly("start", () => startRun(db, operation));
  const step: StepReporter = async (summary, data) => {
    if (run) await quietly("step", () => addRunStep(db, run.id, { summary, data }));
  };
  let result: T;
  try {
    result = await work({ step });
  } catch (error) {
    if (run) await quietly("finish", () => finishRun(db, run.id, { status: RunStatus.FAILED, summary: reasonFor(error) }));
    throw error;
  }
  if (run) {
    const outcome = describe?.(result);
    if (outcome) await quietly("step", () => addRunStep(db, run.id, { summary: outcome.summary, data: outcome.data }));
    else await quietly("step", () => addRunStep(db, run.id, { summary: "Done" }));
    await quietly("finish", () => finishRun(db, run.id, { status: RunStatus.OK, summary: outcome?.summary }));
  }
  return result;
}
