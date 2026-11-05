"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { duplicateHow, duplicateState, type Duplicate } from "@/lib/duplicate-guard";

import { findSimilarApplications } from "./actions";
import type { Details } from "./new-application";

/** How long the details stay still before they are compared, so typing does not ask on every key. */
const SETTLE_MS = 500;

/**
 * "You may already have this": the applications that cover the same opening as the details being checked, with a
 * link to each. It only tells; the owner decides whether to carry on (the duplicate guard, M7.8).
 */
export function SimilarApplications({ details, postingUrl }: { details: Details; postingUrl: string }) {
  const [found, setFound] = useState<Duplicate[]>([]);
  const { company, role, location } = details;

  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      const result = await findSimilarApplications({ company, role, location, postingUrl });
      if (current) setFound(result.ok ? result.data : []);
    }, SETTLE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [company, role, location, postingUrl]);

  if (found.length === 0) return null;
  const recent = found.some((entry) => entry.withinCooldown);
  return (
    <div role="note" aria-label="Applications you already have" className="flex flex-col gap-1.5 rounded-card bg-warning-surface px-4 py-3 text-meta text-warning">
      <p className="font-medium">{recent ? "You applied for this lately." : "You may already have this."}</p>
      <ul className="flex flex-col gap-1">
        {found.map((entry) => (
          <li key={entry.id}>
            <Link href={`/applications/${entry.id}`} className="underline underline-offset-2">
              {entry.title}
            </Link>{" "}
            <span>
              ({duplicateHow(entry)}, {duplicateState(entry)})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
