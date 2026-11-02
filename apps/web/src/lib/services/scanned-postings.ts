import "server-only";

import type { PrismaClient, ScannedPosting } from "@/generated/prisma/client";
import type { BoardSource, ScannedState } from "@/generated/prisma/enums";
import { guard, hasAlarm } from "@/lib/guards/posting-guard";
import { ACTIONS, recordActivity } from "@/lib/ledger";
import { ServiceError } from "@/lib/service-error";
import type { BoardPosting } from "@/lib/job-search/boards";
import { MAX_DESCRIPTION } from "@/lib/job-search/boards/html-text";
import { canonicalKey, contentFingerprint, normalizeUrl, relation } from "@/lib/job-identity";
import { scorePosting, type Preferences } from "@/lib/job-scoring";

// Postings found by a scan, kept (M4d). The employer's board is the truth about whether a posting is open: what a
// good scan no longer lists is closed. What a board says is data: it is cleaned by the posting guard before it is
// stored, with a flag where it looked like an instruction, and it is only ever shown or handed on as a quotation.

export type IngestResult = {
  added: number;
  updated: number;
  closed: number;
  /** New postings that are the same opening as one already kept (a repost, or a copy on another board). */
  duplicates: number;
  /** Postings with an address that is not http(s), which are not kept. */
  skipped: number;
  /** Stored postings whose text looked like an instruction to an AI. */
  alarms: number;
  /** The board answered with nothing although it had open postings: treated as a failed read, nothing was closed. */
  suspectEmpty: boolean;
};

const MAX_POSTINGS_PER_BOARD = 5000;

/** One line of plain text. */
const line = (value: string, max: number) => value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);

const isWebAddress = (address: string) => {
  try {
    const { protocol } = new URL(address);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};

/**
 * Keeps what one good read of a board found. Postings already kept are refreshed (the owner's mark stays; a score is
 * forgotten only when what the posting says changed); new ones are added and linked to an earlier copy of the same
 * opening if there is one; postings of this board that were not listed are closed.
 */
export async function ingestBoardScan(db: PrismaClient, company: { id: string }, postings: BoardPosting[], now: Date): Promise<IngestResult> {
  const result: IngestResult = { added: 0, updated: 0, closed: 0, duplicates: 0, skipped: 0, alarms: 0, suspectEmpty: false };
  let listed = 0;

  for (const posting of postings.slice(0, MAX_POSTINGS_PER_BOARD)) {
    if (!isWebAddress(posting.url)) {
      result.skipped++;
      continue;
    }
    const [text, findings] = guard(posting.description, "auto");
    const alarm = hasAlarm(findings);
    const title = line(posting.title, 300);
    const companyName = line(posting.company, 200);
    const location = line(posting.location, 300);
    const description = text.slice(0, MAX_DESCRIPTION);
    const identified = { company: companyName, title, url: posting.url };
    const fields = {
      companyId: company.id,
      companyName,
      title,
      location,
      remote: posting.remote,
      url: posting.url.slice(0, 2000),
      description,
      postedAt: posting.postedAt ? new Date(posting.postedAt) : null,
      salaryMin: posting.salary ? Math.round(posting.salary.min) : null,
      salaryMax: posting.salary ? Math.round(posting.salary.max) : null,
      salaryCurrency: posting.salary?.currency ?? "",
      urlKey: normalizeUrl(posting.url),
      canonicalKey: canonicalKey(identified),
      fingerprint: contentFingerprint({ company: companyName, title, location, description }),
      guardAlarm: alarm,
      guardNote: alarm ? findings.verdict.slice(0, 300) : "",
      lastSeenAt: now,
      closedAt: null,
    };

    const where = { source_externalId: { source: posting.source, externalId: posting.externalId } };
    const existing = await db.scannedPosting.findUnique({ where });
    if (existing) {
      const changed = existing.fingerprint !== fields.fingerprint;
      await db.scannedPosting.update({
        where,
        data: { ...fields, ...(changed ? { score: null, scoreBand: "", scoreReasons: [], scoreRedFlags: [], scoredWith: "", scoredAt: null } : {}) },
      });
      result.updated++;
    } else {
      const earlier = await db.scannedPosting.findMany({
        where: { OR: [{ canonicalKey: fields.canonicalKey }, ...(fields.urlKey ? [{ urlKey: fields.urlKey }] : [])], duplicateOfId: null },
        orderBy: { firstSeenAt: "asc" },
        take: 20,
      });
      const original = earlier.find((candidate) => relation({ company: candidate.companyName, title: candidate.title, url: candidate.url, location: candidate.location }, { ...identified, location }));
      await db.scannedPosting.create({ data: { source: posting.source, externalId: posting.externalId, ...fields, firstSeenAt: now, duplicateOfId: original?.id ?? null } });
      result.added++;
      if (original) result.duplicates++;
    }
    if (alarm) result.alarms++;
    listed++;
  }

  // A board with open postings that suddenly lists none has more likely failed than emptied: close nothing.
  if (listed === 0 && result.skipped === 0) {
    const open = await db.scannedPosting.count({ where: { companyId: company.id, closedAt: null } });
    if (open > 0) {
      result.suspectEmpty = true;
      return result;
    }
  }
  const closed = await db.scannedPosting.updateMany({ where: { companyId: company.id, closedAt: null, lastSeenAt: { lt: now } }, data: { closedAt: now } });
  result.closed = closed.count;
  return result;
}

/**
 * Scores a board's open postings that have no score yet (a score is forgotten when the posting changes, and the
 * owner's dismissed ones are not worth the work). The number is decided by code from the posting and the preferences
 * (lib/job-scoring.ts); with nothing to compare against, a posting stays unscored.
 */
export async function scoreOpenPostings(db: PrismaClient, companyId: string, preferences: Preferences, now: Date): Promise<number> {
  const rows = await db.scannedPosting.findMany({ where: { companyId, closedAt: null, score: null, state: { not: "DISMISSED" } } });
  let scored = 0;
  for (const row of rows) {
    const result = scorePosting(
      {
        title: row.title,
        companyName: row.companyName,
        location: row.location,
        remote: row.remote,
        description: row.description,
        salary: row.salaryMin !== null && row.salaryMax !== null ? { min: row.salaryMin, max: row.salaryMax, currency: row.salaryCurrency } : null,
        postedAt: row.postedAt,
        guardAlarm: row.guardAlarm,
      },
      preferences,
      now,
    );
    if (!result) continue;
    await db.scannedPosting.update({
      where: { id: row.id },
      data: { score: result.score, scoreBand: result.band, scoreReasons: result.reasons, scoreRedFlags: result.redFlags, scoredWith: result.version, scoredAt: now },
    });
    scored++;
  }
  return scored;
}

/** A stored posting as a list shows it: what the board said (cleaned), and where it stands. */
export type ScanPosting = {
  id: string;
  source: BoardSource;
  externalId: string;
  title: string;
  company: string;
  location: string;
  remote: boolean | null;
  url: string;
  description: string;
  postedAt: Date | null;
  salary: { min: number; max: number; currency: string } | null;
  /** Not yet looked at: first seen in the scan that shows it, or still waiting in the review queue. */
  isNew: boolean;
  score: number | null;
  band: string;
  scoreReasons: string[];
  scoreRedFlags: string[];
  guardAlarm: boolean;
};

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

export function toScanPosting(row: ScannedPosting, isNew: boolean): ScanPosting {
  return {
    id: row.id,
    source: row.source,
    externalId: row.externalId,
    title: row.title,
    company: row.companyName,
    location: row.location,
    remote: row.remote,
    url: row.url,
    description: row.description,
    postedAt: row.postedAt,
    salary: row.salaryMin !== null && row.salaryMax !== null ? { min: row.salaryMin, max: row.salaryMax, currency: row.salaryCurrency } : null,
    isNew,
    score: row.score,
    band: row.scoreBand,
    scoreReasons: strings(row.scoreReasons),
    scoreRedFlags: strings(row.scoreRedFlags),
    guardAlarm: row.guardAlarm,
  };
}

export type ListScannedOptions = {
  state?: ScannedState;
  minScore?: number;
  includeClosed?: boolean;
  includeDuplicates?: boolean;
  limit?: number;
};

const LIST_DEFAULT = 50;
const LIST_MAX = 200;

/**
 * Kept postings, best score first (unscored last, then newest). Without a state: the open ones the owner has not
 * dismissed, leaving out copies of an opening already kept. This is what the Review queue shows.
 */
export async function listScannedPostings(db: PrismaClient, { state, minScore, includeClosed = false, includeDuplicates = false, limit = LIST_DEFAULT }: ListScannedOptions = {}): Promise<ScanPosting[]> {
  const rows = await db.scannedPosting.findMany({
    where: {
      state: state ?? { not: "DISMISSED" },
      ...(includeClosed ? {} : { closedAt: null }),
      ...(includeDuplicates ? {} : { duplicateOfId: null }),
      ...(minScore !== undefined ? { score: { gte: minScore } } : {}),
    },
    orderBy: [{ score: { sort: "desc", nulls: "last" } }, { postedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: Math.min(LIST_MAX, Math.max(1, limit)),
  });
  return rows.map((row) => toScanPosting(row, row.state === "NEW"));
}

const REVIEW_SUMMARY = { SAVED: "Saved", DISMISSED: "Dismissed", NEW: "Moved back to review" } as const;

/**
 * The owner's answer to a posting in the Review queue: keep it, set it aside, or put it back. Only the dashboard
 * calls this (through a session-checked action); there is deliberately no REST or MCP door for it.
 */
export async function setScannedState(db: PrismaClient, id: string, state: ScannedState): Promise<{ changed: boolean; state: ScannedState; title: string }> {
  return db.$transaction(async (tx) => {
    const row = await tx.scannedPosting.findUnique({ where: { id }, select: { title: true, state: true } });
    if (!row) throw new ServiceError("not_found", "That posting is no longer in the list.");
    if (row.state === state) return { changed: false, state, title: row.title };
    await tx.scannedPosting.update({ where: { id }, data: { state } });
    await recordActivity(tx, { action: ACTIONS.postingReviewed, summary: `${REVIEW_SUMMARY[state]}: ${row.title}`, targetType: "scanned_posting", targetId: id, data: { state } });
    return { changed: true, state, title: row.title };
  });
}

/** How many open postings are in each state (copies of an opening already kept are not counted), for the Review queue's tabs. */
export async function countScannedPostings(db: PrismaClient): Promise<Record<ScannedState, number>> {
  const groups = await db.scannedPosting.groupBy({ by: ["state"], where: { closedAt: null, duplicateOfId: null }, _count: { _all: true } });
  const counts: Record<ScannedState, number> = { NEW: 0, SAVED: 0, DISMISSED: 0 };
  for (const group of groups) counts[group.state] = group._count._all;
  return counts;
}
