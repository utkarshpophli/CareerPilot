import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

import { findDuplicates, type Candidate, type Duplicate } from "./duplicate-guard";

/** Applications looked at when comparing; far more than one person has, and the newest are the ones that matter. */
const SCAN_LIMIT = 5000;

/** The applications already made for the same opening as `candidate` (see duplicate-guard.ts), archived ones left out. */
export async function loadDuplicates(db: Pick<PrismaClient, "application">, candidate: Candidate, now: Date = new Date()): Promise<Duplicate[]> {
  if (!candidate.postingUrl.trim() && !candidate.company.trim()) return [];
  const rows = await db.application.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    take: SCAN_LIMIT,
    select: { id: true, title: true, company: true, role: true, location: true, postingUrl: true, status: true, createdAt: true, sentAt: true },
  });
  return findDuplicates(candidate, rows.map((row) => ({ ...row, archived: false })), now);
}
