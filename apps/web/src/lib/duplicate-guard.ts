import type { ApplicationStatus } from "@/generated/prisma/enums";

import { relation, type Relation } from "./job-identity";

// The duplicate-application guard (M7.8): before an application is made, say which ones already cover the same
// opening, so the same job is not applied for twice, from another board or by another assistant. Pure: it
// compares what it is given, through job-identity's rules (same address, or same company, role and place).

/** An application sent this recently for the same opening counts as "applied lately". */
export const COOLDOWN_DAYS = 90;

export type Candidate = { company: string; role: string; location: string; postingUrl: string };

export type KnownApplication = Candidate & {
  id: string;
  title: string;
  status: ApplicationStatus;
  createdAt: Date;
  sentAt: Date | null;
  archived: boolean;
};

export type Duplicate = {
  id: string;
  title: string;
  status: ApplicationStatus;
  relation: Relation;
  /** Whole days since it was sent; null while it was not. */
  sentDaysAgo: number | null;
  /** Sent less than COOLDOWN_DAYS ago. */
  withinCooldown: boolean;
};

const DAY = 86_400_000;

/**
 * The applications that are the same opening as `candidate`, the strongest first: the same address before the
 * same company, role and place; within that, ones already sent first, then the newest. Archived ones are left out.
 */
export function findDuplicates(candidate: Candidate, existing: KnownApplication[], now: Date): Duplicate[] {
  const identity = (entry: Candidate) => ({ company: entry.company, title: entry.role, url: entry.postingUrl, location: entry.location });
  const found: (Duplicate & { created: number })[] = [];
  for (const entry of existing) {
    if (entry.archived) continue;
    const how = relation(identity(candidate), identity(entry));
    if (!how) continue;
    const sentDaysAgo = entry.sentAt ? Math.max(0, Math.floor((now.getTime() - entry.sentAt.getTime()) / DAY)) : null;
    found.push({
      id: entry.id,
      title: entry.title,
      status: entry.status,
      relation: how,
      sentDaysAgo,
      withinCooldown: sentDaysAgo !== null && sentDaysAgo < COOLDOWN_DAYS,
      created: entry.createdAt.getTime(),
    });
  }
  const strength = (entry: Duplicate) => (entry.relation === "same-url" ? 0 : 1);
  found.sort((a, b) => strength(a) - strength(b) || Number(b.sentDaysAgo !== null) - Number(a.sentDaysAgo !== null) || b.created - a.created);
  return found.map((entry) => ({ id: entry.id, title: entry.title, status: entry.status, relation: entry.relation, sentDaysAgo: entry.sentDaysAgo, withinCooldown: entry.withinCooldown }));
}

/** How a duplicate repeats the opening, in words. */
export const duplicateHow = (entry: Duplicate): string => (entry.relation === "same-url" ? "the same posting address" : "the same company, role and place");

/** Where a duplicate stands, in words: still a draft, or sent so many days ago. */
export function duplicateState(entry: Duplicate): string {
  if (entry.sentDaysAgo === null) return `still ${entry.status.toLowerCase()}`;
  const when = entry.sentDaysAgo === 0 ? "today" : `${entry.sentDaysAgo} day${entry.sentDaysAgo === 1 ? "" : "s"} ago`;
  return `sent ${when}${entry.withinCooldown ? ` (inside the ${COOLDOWN_DAYS}-day wait)` : ""}`;
}

/** One plain line per duplicate, for an assistant or the command line to tell the owner. */
export function describeDuplicates(duplicates: Duplicate[]): string[] {
  return duplicates.map((entry) => `${entry.title}: ${duplicateHow(entry)}, ${duplicateState(entry)} [${entry.id}]`);
}
