import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { ApplicationStatus, ProposalState } from "@/generated/prisma/enums";
import { mayAgentSet } from "./agent-status-policy";
import { ACTIONS, currentActor, recordActivity, recordActivitySafe } from "./ledger";
import { redactSecrets } from "./redact";
import { ServiceError } from "./service-error";
import { statusInfo } from "./status";
import { applyStatusChange } from "./status-changes";

// The proposal queue. An assistant may not record that an application was
// sent, answered, interviewed for or offered (agent-status-policy.ts): that is
// the owner's to say, and a hostile posting or email could talk an assistant
// into saying it. It may propose it. A proposal waits, on the dashboard and on
// the application, for one click to confirm it (which goes through the status
// machine, so it can be undone) or dismiss it. A proposal changes nothing by
// itself.

/** How long a proposal can be confirmed for. */
export const PROPOSAL_TTL_MS = 14 * 86_400_000;
/** How many may wait at once, so a runaway or stolen token cannot bury the owner in them. */
export const MAX_PENDING = 50;
/** Finished and expired proposals are kept this long, then pruned. */
const KEEP_MS = 90 * 86_400_000;
const REASON_MAX = 300;

/** The statuses an assistant cannot set itself and so may propose. */
export const PROPOSABLE: readonly ApplicationStatus[] = Object.values(ApplicationStatus).filter((status) => !mayAgentSet(status));

export type ProposalView = {
  id: string;
  applicationId: string;
  status: ApplicationStatus;
  /** The assistant's own words. Show them as what it said, not as a fact. */
  reason: string;
  actorName: string;
  state: ProposalState;
  createdAt: string;
  expiresAt: string;
};

export type PendingProposal = ProposalView & {
  application: { id: string; title: string; company: string; role: string; status: ApplicationStatus };
};

type Row = {
  id: string;
  applicationId: string;
  status: ApplicationStatus;
  reason: string;
  actorName: string;
  state: ProposalState;
  createdAt: Date;
  expiresAt: Date;
};

const view = (row: Row): ProposalView => ({
  id: row.id,
  applicationId: row.applicationId,
  status: row.status,
  reason: row.reason,
  actorName: row.actorName,
  state: row.state,
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
});

/** The assistant's words as one short, printable line with credentials masked. */
export function cleanReason(raw: string): string {
  // Control characters, invisible formatting characters (zero-width, bidi overrides) and line or paragraph separators all become a space.
  return redactSecrets(raw)
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, REASON_MAX);
}

export type ProposeInput = { applicationId: string; status: ApplicationStatus; reason: string };

/** Records a suggestion for the owner to confirm. Changes nothing about the application. */
export async function proposeStatus(db: PrismaClient, input: ProposeInput, now: Date = new Date(), { maxPending = MAX_PENDING }: { maxPending?: number } = {}): Promise<ProposalView> {
  if (!PROPOSABLE.includes(input.status)) {
    throw new ServiceError("bad_request", `You may set that status yourself, so set it directly; proposals are only for ${PROPOSABLE.map((status) => statusInfo(status).label.toLowerCase()).join(", ")}.`);
  }
  const reason = cleanReason(input.reason);
  const actor = currentActor();

  return db.$transaction(async (tx) => {
    // Lock the application, so two proposals for it cannot interleave.
    await tx.$queryRaw`SELECT 1 FROM "Application" WHERE id = ${input.applicationId} FOR UPDATE`;
    const application = await tx.application.findUnique({ where: { id: input.applicationId }, select: { title: true, status: true, awaitingReview: true, archivedAt: true } });
    if (!application) throw new ServiceError("not_found", "No such application.");
    if (application.awaitingReview) throw new ServiceError("conflict", "That application is a draft waiting for the user's review on the Agent screen; nothing can be proposed for it until they approve it.");
    if (application.archivedAt) throw new ServiceError("conflict", "That application is archived.");
    if (application.status === input.status) throw new ServiceError("conflict", `That application is already at ${statusInfo(input.status).label}.`);

    const waiting = await tx.statusProposal.findMany({ where: { applicationId: input.applicationId, state: ProposalState.PENDING, expiresAt: { gt: now } } });
    const same = waiting.find((proposal) => proposal.status === input.status);
    if (same) return view(same);

    const elsewhere = await tx.statusProposal.count({ where: { state: ProposalState.PENDING, expiresAt: { gt: now }, applicationId: { not: input.applicationId } } });
    if (elsewhere >= maxPending) throw new ServiceError("conflict", `${maxPending} proposals are already waiting for the user. Wait until they have looked at them.`);

    // A newer proposal replaces any older one for the same application.
    await tx.statusProposal.updateMany({ where: { applicationId: input.applicationId, state: ProposalState.PENDING }, data: { state: ProposalState.SUPERSEDED, resolvedAt: now } });
    const created = await tx.statusProposal.create({
      data: { applicationId: input.applicationId, status: input.status, reason, actorKind: actor.kind, actorName: actor.name ?? "", createdAt: now, expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS) },
    });
    await recordActivity(tx, {
      action: ACTIONS.proposalCreated,
      summary: `${actor.name || "An assistant"} proposed ${statusInfo(input.status).label} for ${application.title || "an application"}`,
      targetType: "application",
      targetId: input.applicationId,
      applicationId: input.applicationId,
      data: { status: input.status, proposalId: created.id },
    });
    return view(created);
  });
}

/** What is waiting for the owner, newest first, leaving out what is resolved or has expired. */
export async function listPendingProposals(db: Pick<PrismaClient, "statusProposal">, now: Date = new Date(), limit = MAX_PENDING): Promise<PendingProposal[]> {
  const rows = await db.statusProposal.findMany({
    where: { state: ProposalState.PENDING, expiresAt: { gt: now } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    include: { application: { select: { id: true, title: true, company: true, role: true, status: true } } },
  });
  return rows.map((row) => ({ ...view(row), application: row.application }));
}

/** The proposal waiting for one application, if any: what its page shows. */
export async function pendingProposalFor(db: Pick<PrismaClient, "statusProposal">, applicationId: string, now: Date = new Date()): Promise<ProposalView | null> {
  const row = await db.statusProposal.findFirst({ where: { applicationId, state: ProposalState.PENDING, expiresAt: { gt: now } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return row ? view(row) : null;
}

export type Confirmation = { proposalId: string; applicationId: string; status: ApplicationStatus; changed: boolean; eventId: string | null };

/** Why a proposal cannot be acted on, as a service error. */
async function notWaiting(db: Pick<PrismaClient, "statusProposal">, id: string): Promise<ServiceError> {
  const row = await db.statusProposal.findUnique({ where: { id }, select: { state: true } });
  if (!row) return new ServiceError("not_found", "No such proposal.");
  if (row.state === ProposalState.PENDING) return new ServiceError("conflict", "That proposal has expired.");
  return new ServiceError("conflict", "That proposal is no longer waiting: it was already confirmed, dismissed or replaced.");
}

/**
 * The owner says yes: the application moves through the status machine and the
 * answer's `eventId` undoes it. Of two simultaneous confirmations exactly one wins.
 */
export async function confirmProposal(db: PrismaClient, id: string, now: Date = new Date()): Promise<Confirmation> {
  const claimed = await db.statusProposal.updateMany({ where: { id, state: ProposalState.PENDING, expiresAt: { gt: now } }, data: { state: ProposalState.CONFIRMED, resolvedAt: now } });
  if (claimed.count === 0) throw await notWaiting(db, id);

  const proposal = await db.statusProposal.findUniqueOrThrow({ where: { id }, include: { application: { select: { title: true } } } });
  let moved;
  try {
    moved = await applyStatusChange(db, proposal.applicationId, proposal.status, now);
  } catch (error) {
    // The move did not happen, so the proposal waits again.
    await db.statusProposal.updateMany({ where: { id }, data: { state: ProposalState.PENDING, resolvedAt: null } });
    throw error;
  }
  if (moved.outcome === "not-found") throw new ServiceError("not_found", "That application no longer exists.");
  const eventId = moved.outcome === "changed" ? moved.event.id : null;
  if (eventId) await db.statusProposal.update({ where: { id }, data: { statusEventId: eventId } });

  await recordActivitySafe(db, {
    action: ACTIONS.proposalConfirmed,
    summary: `Confirmed ${proposal.actorName || "an assistant"}'s proposal: ${proposal.application.title || "application"} is now ${statusInfo(proposal.status).label}`,
    targetType: "application",
    targetId: proposal.applicationId,
    applicationId: proposal.applicationId,
    data: { status: proposal.status, proposedBy: proposal.actorName, proposalId: id },
  });
  return { proposalId: id, applicationId: proposal.applicationId, status: proposal.status, changed: moved.outcome === "changed", eventId };
}

/** The owner says no. The application stays as it is. */
export async function dismissProposal(db: PrismaClient, id: string, now: Date = new Date()): Promise<void> {
  const claimed = await db.statusProposal.updateMany({ where: { id, state: ProposalState.PENDING }, data: { state: ProposalState.DISMISSED, resolvedAt: now } });
  if (claimed.count === 0) throw await notWaiting(db, id);
  const proposal = await db.statusProposal.findUniqueOrThrow({ where: { id }, include: { application: { select: { title: true } } } });
  await recordActivitySafe(db, {
    action: ACTIONS.proposalDismissed,
    summary: `Dismissed ${proposal.actorName || "an assistant"}'s proposal for ${proposal.application.title || "an application"}`,
    targetType: "application",
    targetId: proposal.applicationId,
    applicationId: proposal.applicationId,
    data: { status: proposal.status, proposedBy: proposal.actorName, proposalId: id },
  });
}

/** Deletes proposals that finished or expired long ago. Returns how many. */
export async function pruneProposals(db: Pick<PrismaClient, "statusProposal">, now: Date = new Date()): Promise<number> {
  const before = new Date(now.getTime() - KEEP_MS);
  const { count } = await db.statusProposal.deleteMany({ where: { OR: [{ expiresAt: { lt: before } }, { resolvedAt: { lt: before } }] } });
  return count;
}
