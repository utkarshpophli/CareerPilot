import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { fitBand } from "@/lib/fit";
import { hasAlarm, type GuardFindings } from "@/lib/guards/posting-guard";
import { foundPostingSchema } from "@/lib/job-search/search";
import { inspectPosting, type PostingEntry } from "@/lib/posting-check";
import { foundFromPosting } from "@/lib/postings";
import { scoreFrom } from "@/lib/ai/tasks/score-posting";
import { ServiceError } from "@/lib/service-error";

import { reportAsRun } from "./runs";

// Postings as a service: checking a posting's text, and keeping the fit
// scores an assistant (or the owner's own model) worked out. The doors (REST,
// CLI, MCP) call these; none of them decides a score: code only stores what it
// is given, clamped to 0..100 with trimmed reasons.

export type PostingCheck = { text: string; alarm: boolean; verdict: string; findings: GuardFindings };

/**
 * Cleans a posting of hidden content and says whether anything in it looks like
 * an instruction aimed at an AI. What it finds is noted in the Activity Ledger
 * as counts. Throws an ActionError when nothing readable is left.
 */
export const checkPostingText = (db: PrismaClient, raw: string, entry: PostingEntry): Promise<PostingCheck> =>
  reportAsRun(
    db,
    { kind: "postings.check", title: "Check a posting" },
    async () => {
      const { text, findings } = await inspectPosting(raw, entry, db);
      return { text, alarm: hasAlarm(findings), verdict: findings.verdict, findings };
    },
    (check) => ({ summary: check.alarm ? "Found text that looks like instructions to an AI" : "Clean", data: { alarm: check.alarm } }),
  );

export type ScoreInput = {
  /** The posting's number in the search, counting from 1. */
  number?: number;
  /** Or a posting CareerPilot handed over. */
  postingId?: string;
  score: number;
  reasons: string[];
  redFlags: string[];
};

export type SavedScore = { number?: number; postingId?: string; title: string; score: number; band: string };

/** Keeps fit scores for postings of a kept search (by number) or stored postings (by id), replacing older ones. */
export const saveFitScores = (db: PrismaClient, input: { searchId?: string; scores: ScoreInput[]; scoredWith: string }): Promise<{ saved: SavedScore[]; notFound: (number | string)[] }> =>
  reportAsRun(
    db,
    { kind: "postings.score", title: `Score ${input.scores.length} posting${input.scores.length === 1 ? "" : "s"}` },
    () => keepScores(db, input),
    (result) => ({ summary: `Saved ${result.saved.length} score${result.saved.length === 1 ? "" : "s"}`, data: { saved: result.saved.length, notFound: result.notFound.length } }),
  );

async function keepScores(
  db: PrismaClient,
  { searchId, scores, scoredWith }: { searchId?: string; scores: ScoreInput[]; scoredWith: string },
): Promise<{ saved: SavedScore[]; notFound: (number | string)[] }> {
  const search = searchId ? await db.postingSearch.findUnique({ where: { id: searchId }, select: { postings: true } }) : null;
  if (searchId && !search) throw new ServiceError("not_found", "That search is no longer kept. Search again.");
  const kept = foundPostingSchema.array().catch([]).parse(search?.postings ?? []);
  const saved: SavedScore[] = [];
  const notFound: (number | string)[] = [];
  for (const entry of scores) {
    const row = entry.postingId ? await db.posting.findUnique({ where: { id: entry.postingId } }) : null;
    const posting = row ? foundFromPosting(row) : entry.number ? kept[entry.number - 1] : undefined;
    if (!posting) {
      notFound.push(entry.postingId ?? entry.number ?? "?");
      continue;
    }
    const fit = scoreFrom({ score: entry.score, reasons: entry.reasons, redFlags: entry.redFlags });
    const where = { source_externalId: { source: posting.source, externalId: posting.externalId } };
    const data = { score: fit.score, reasons: fit.reasons, redFlags: fit.redFlags, scoredWith };
    await db.postingScore.upsert({ where, create: { source: posting.source, externalId: posting.externalId, ...data }, update: data });
    saved.push({ number: entry.number, postingId: entry.postingId, title: posting.title, score: fit.score, band: fitBand(fit.score) });
  }
  return { saved, notFound };
}

