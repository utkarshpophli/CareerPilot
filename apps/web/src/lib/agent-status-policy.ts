import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { ServiceError } from "@/lib/service-error";
import { statusInfo } from "@/lib/status";

// What an assistant may do to an application's status (audit A-05, A-09).
//
// The status says what happened in the owner's search: that an application
// went out, that an interview was held, that an offer came. An assistant
// reading a posting or an email cannot know that, and a hostile posting could
// talk it into saying so. So assistants (API tokens and the Claude connector)
// may only record the three statuses that retract or close a lead; the rest
// are the owner's to set on the application's page. For those there is the
// proposal queue (lib/proposals.ts): an assistant proposes, the owner confirms
// with one click.

export const AGENT_MAY_SET: readonly ApplicationStatus[] = [ApplicationStatus.DRAFT, ApplicationStatus.REJECTED, ApplicationStatus.DECLINED];

export const mayAgentSet = (status: ApplicationStatus) => AGENT_MAY_SET.includes(status);

/** Throws a ServiceError unless an assistant may move application `id` to `to`. */
export async function assertAgentMayMove(db: Pick<PrismaClient, "application">, id: string, to: ApplicationStatus): Promise<void> {
  if (!mayAgentSet(to)) {
    throw new ServiceError(
      "forbidden",
      `Moving an application to ${statusInfo(to).label} records that something happened (it was sent, an interview was held, an offer came), so only you can do that. Ask the user to move it on the application's page, or propose it: the proposal waits for the user to confirm it with one click (propose_status in MCP, "pilot apps propose <id> ${to}", or POST /api/v1/applications/{id}/proposals).`,
    );
  }
  const application = await db.application.findUnique({ where: { id }, select: { awaitingReview: true, archivedAt: true } });
  if (!application) throw new ServiceError("not_found", "No such application.");
  if (application.awaitingReview) throw new ServiceError("conflict", "That application is a draft waiting for the user's review on the Agent screen; only they can approve it.");
  if (application.archivedAt) throw new ServiceError("conflict", "That application is archived.");
}
