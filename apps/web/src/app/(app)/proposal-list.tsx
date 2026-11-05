"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { toastWithUndo } from "@/components/change-status";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import type { PendingProposal, ProposalView } from "@/lib/proposals";
import { statusInfo } from "@/lib/status";

import { confirmProposalAction, dismissProposalAction } from "./proposals/actions";

// What an assistant proposed, with the owner's one-click answer. The
// assistant's words are shown as text, in quotes, as what it said and not as a
// fact; nothing changes until "Mark as" is pressed.

type Proposal = Pick<ProposalView, "id" | "status" | "reason" | "actorName">;

/** Confirm and Dismiss for one proposal. Calls `onResolved` once the server has taken the answer. */
function Choices({ proposal, applicationTitle, onResolved }: { proposal: Proposal; applicationTitle: string; onResolved: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const label = statusInfo(proposal.status as ApplicationStatus).label;

  const answer = async (confirm: boolean) => {
    setBusy(true);
    const result = confirm ? await confirmProposalAction({ id: proposal.id }) : await dismissProposalAction({ id: proposal.id });
    setBusy(false);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    if (confirm && "eventId" in (result.data ?? {})) toastWithUndo(result.toast, (result.data as { eventId: string | null }).eventId);
    onResolved();
    router.refresh();
  };

  return (
    <span className="flex flex-wrap items-center gap-2">
      {/* The visible words are part of the accessible name (WCAG label in name); the screen-reader-only rest says which application. */}
      <Button size="sm" disabled={busy} onClick={() => void answer(true)}>
        <span>
          Mark as {label}{" "}
          <span className="sr-only">for {applicationTitle}</span>
        </span>
      </Button>
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => void answer(false)}>
        <span>
          Dismiss{" "}
          <span className="sr-only">the proposal for {applicationTitle}</span>
        </span>
      </Button>
    </span>
  );
}

const who = (proposal: Proposal) => proposal.actorName || "An assistant";

/** The proposals waiting for the owner, for the dashboard. */
export function ProposalList({ proposals: initial }: { proposals: PendingProposal[] }) {
  const [proposals, setProposals] = useState(initial);
  if (proposals.length === 0) return null;
  return (
    <ul aria-label="Proposals from your assistants" className="flex flex-col gap-3">
      {proposals.map((proposal) => {
        const title = proposal.application.title || "Untitled application";
        return (
          <li key={proposal.id} className="flex flex-col gap-1.5 rounded-card border border-line-card px-3 py-2.5 text-sm">
            <span>
              <Link href={`/applications/${proposal.applicationId}`} className="font-medium underline underline-offset-2">
                {title}
              </Link>{" "}
              <span className="text-muted">
                {who(proposal)} proposes {statusInfo(proposal.status).label}
              </span>
            </span>
            {proposal.reason && <q className="text-meta text-muted">{proposal.reason}</q>}
            <span className="text-meta text-muted">Nothing changes until you confirm.</span>
            <Choices proposal={proposal} applicationTitle={title} onResolved={() => setProposals((current) => current.filter((entry) => entry.id !== proposal.id))} />
          </li>
        );
      })}
    </ul>
  );
}

/** The proposal for one application, in its header. */
export function ProposalPill({ applicationId, applicationTitle, proposal }: { applicationId: string; applicationTitle: string; proposal: Proposal | null }) {
  const [open, setOpen] = useState(proposal !== null);
  if (!proposal || !open) return null;
  return (
    <span role="group" aria-label={`Proposal from ${who(proposal)}`} data-application={applicationId} className="flex flex-wrap items-center gap-2 rounded-full bg-warning-surface px-3 py-1.5 text-meta text-warning" title={proposal.reason || undefined}>
      <span>
        {who(proposal)} proposes {statusInfo(proposal.status).label}
      </span>
      <Choices proposal={proposal} applicationTitle={applicationTitle} onResolved={() => setOpen(false)} />
    </span>
  );
}
