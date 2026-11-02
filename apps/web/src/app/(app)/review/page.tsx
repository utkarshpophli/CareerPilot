import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/cn";
import { prisma } from "@/lib/prisma";
import { countScannedPostings, listScannedPostings } from "@/lib/services/scanned-postings";

import { ReviewList, type ReviewView } from "./review-list";

export const metadata: Metadata = { title: "Review" };

const VIEWS: { view: ReviewView; label: string; state: "NEW" | "SAVED" | "DISMISSED" }[] = [
  { view: "new", label: "To review", state: "NEW" },
  { view: "saved", label: "Saved", state: "SAVED" },
  { view: "dismissed", label: "Dismissed", state: "DISMISSED" },
];

/** Postings that scans of the companies you watch found, best fit first, with the reasons. You decide what to keep. */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const chosen = (await searchParams).view;
  const current = VIEWS.find((entry) => entry.view === chosen) ?? VIEWS[0]!;
  const [postings, counts] = await Promise.all([listScannedPostings(prisma, { state: current.state, limit: 100 }), countScannedPostings(prisma)]);
  return (
    <>
      <PageHeader
        title="Review"
        description="Postings found on the job boards of the companies you watch, best fit first. The fit is worked out by CareerPilot from your profile, with the reasons shown. Save what you want to come back to; dismiss what you don't, and it stays out of later scans."
      />
      <div className="flex flex-col gap-5 px-10 pb-10">
        <nav aria-label="Review views" className="flex flex-wrap gap-x-7 border-b border-line">
          {VIEWS.map((entry) => {
            const active = entry.view === current.view;
            return (
              <Link
                key={entry.view}
                href={entry.view === "new" ? "/review" : `/review?view=${entry.view}`}
                aria-current={active ? "page" : undefined}
                className={cn("-mb-px border-b-2 pt-2.5 pb-[13px] text-sm", active ? "border-primary font-medium text-ink" : "border-transparent text-muted hover:text-ink")}
              >
                {entry.label} <span className="text-meta">({counts[entry.state]})</span>
              </Link>
            );
          })}
        </nav>
        {/* Keyed by the view, so switching tabs starts a fresh list. */}
        <ReviewList key={current.view} postings={postings} view={current.view} />
      </div>
    </>
  );
}
