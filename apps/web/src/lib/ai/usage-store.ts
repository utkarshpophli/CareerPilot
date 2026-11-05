import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { currentActor } from "@/lib/ledger";
import { logServerWarning } from "@/lib/log";
import { prisma } from "@/lib/prisma";

import { onAiCall } from "./usage";

// Keeps a row for each AI call (M5.4) so the Usage page can total them. Numbers and names only: no prompt, no answer.

/** Starts keeping calls in `db`; returns the way to stop. */
export function keepAiCalls(db: Pick<PrismaClient, "aiCall">): () => void {
  return onAiCall((call) => {
    // The listener runs in the caller's context, so the actor is whoever asked for the call.
    const actor = currentActor();
    void db.aiCall
      .create({
        data: {
          at: call.at,
          provider: call.provider.slice(0, 40),
          model: call.model.slice(0, 200),
          task: call.task.slice(0, 100),
          inputTokens: call.usage?.inputTokens ?? null,
          outputTokens: call.usage?.outputTokens ?? null,
          actorKind: actor.kind,
          actorName: actor.name ?? "",
        },
      })
      .catch((error: unknown) => logServerWarning("AI usage", `could not keep a call: ${(error as Error).message}`));
  });
}

const holder = globalThis as unknown as { __careerpilotAiCalls?: () => void };

/** Starts keeping calls in the app's own database, once per process. */
export function ensureAiCallsKept(): void {
  holder.__careerpilotAiCalls ??= keepAiCalls(prisma);
}
