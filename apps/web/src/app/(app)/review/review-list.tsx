"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ScoreBadge } from "@/components/score-badge";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import type { ScanPosting } from "@/lib/services/scanned-postings";

import { setPostingStateAction } from "./actions";

// The Review queue (M4d.5). Everything a board published (title, company, place, text) is shown as plain text and
// never as markup; the link is the posting's own address, only when it is http(s). The score and its reasons are
// worked out by CareerPilot's own code from the profile.

export type ReviewView = "new" | "saved" | "dismissed";
type State = "NEW" | "SAVED" | "DISMISSED";

const EMPTY: Record<ReviewView, string> = {
  new: "Nothing to review. Postings from the companies you watch land here after a scan.",
  saved: "Nothing saved yet. Save a posting you want to come back to.",
  dismissed: "Nothing dismissed. Postings you set aside are listed here, and stay out of new scans.",
};

const isWebAddress = (address: string) => /^https?:\/\//i.test(address);

function Actions({ posting, view, onDone }: { posting: ScanPosting; view: ReviewView; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const choose = async (state: State) => {
    setBusy(true);
    const result = await setPostingStateAction({ id: posting.id, state });
    setBusy(false);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    if (result.toast) toast(result.toast);
    onDone();
    router.refresh();
  };
  // The visible words are part of each button's name (WCAG label in name); the screen-reader-only rest says which posting.
  const button = (label: string, state: State, variant: "primary" | "secondary") => (
    <Button size="sm" variant={variant === "primary" ? undefined : "secondary"} disabled={busy} onClick={() => void choose(state)}>
      <span>
        {label} <span className="sr-only">{posting.title}</span>
      </span>
    </Button>
  );
  return (
    <span className="flex flex-wrap items-center gap-2">
      {view === "new" && button("Save", "SAVED", "primary")}
      {view !== "new" && button("Move back to review", "NEW", "primary")}
      {view !== "dismissed" && button("Dismiss", "DISMISSED", "secondary")}
    </span>
  );
}

export function ReviewList({ postings: initial, view }: { postings: ScanPosting[]; view: ReviewView }) {
  const [postings, setPostings] = useState(initial);
  if (postings.length === 0) return <p className="max-w-[560px] text-lead text-pretty text-muted">{EMPTY[view]}</p>;
  return (
    <ul aria-label="Postings" className="flex flex-col gap-3">
      {postings.map((posting) => (
        <li key={posting.id} className="flex gap-4 rounded-card border border-line-card p-4">
          {posting.score !== null ? <ScoreBadge score={posting.score} /> : <span className="grid size-11 flex-none place-items-center rounded-full border border-line-field text-meta text-muted">–</span>}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2">
              {isWebAddress(posting.url) ? (
                <a href={posting.url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                  {posting.title}
                </a>
              ) : (
                <span className="font-medium">{posting.title}</span>
              )}
              {posting.isNew && view === "new" && <span className="rounded-full bg-selected px-2 py-0.5 text-meta text-primary-text">New</span>}
              <span className="text-meta text-muted">{posting.score !== null ? posting.band : "Not scored"}</span>
            </div>
            <p className="text-meta text-muted">
              {[posting.company, posting.location || (posting.remote ? "Remote" : ""), posting.postedAt?.toISOString().slice(0, 10)].filter(Boolean).join(" · ")}
            </p>
            {posting.guardAlarm && (
              <p role="alert" className="rounded-control bg-warning-surface px-3 py-2 text-meta text-warning">
                This posting&apos;s text contains instruction-like lines aimed at an AI. Read it yourself; CareerPilot will not follow it and never ranks it as a good match.
              </p>
            )}
            {posting.scoreReasons.length > 0 && (
              <ul aria-label="Why this score" className="list-disc pl-5 text-meta">
                {posting.scoreReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
            {posting.scoreRedFlags.length > 0 && (
              <ul aria-label="What counts against it" className="list-disc pl-5 text-meta text-warning">
                {posting.scoreRedFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            )}
            {posting.description && <p className="text-meta text-pretty text-muted">{posting.description.replace(/\s+/g, " ").slice(0, 280)}</p>}
            <Actions posting={posting} view={view} onDone={() => setPostings((current) => current.filter((entry) => entry.id !== posting.id))} />
          </div>
        </li>
      ))}
    </ul>
  );
}
