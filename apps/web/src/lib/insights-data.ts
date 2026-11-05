import "server-only";

import { computeInsights, type InsightApplication, type Insights } from "./insights";
import { prisma } from "./prisma";

/** Reads the applications once and counts them. Agent drafts nobody has approved yet are left out. */
export async function loadInsights(now = new Date()): Promise<Insights> {
  const rows = await prisma.application.findMany({
    where: { awaitingReview: false },
    select: {
      id: true,
      title: true,
      createdAt: true,
      sentAt: true,
      status: true,
      furthestStage: true,
      origin: true,
      postingUrl: true,
      posting: { select: { source: true } },
      documents: { select: { kind: true, theme: { select: { name: true } }, versions: { select: { cause: true } } } },
      // The first time it moved on from sent: a reply of some kind (screening, interview or offer).
      events: { where: { to: { in: ["SCREENING", "INTERVIEW", "OFFER", "ACCEPTED"] } }, orderBy: { at: "asc" }, take: 1, select: { at: true } },
    },
  });
  const applications: InsightApplication[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
    status: row.status,
    furthestStage: row.furthestStage,
    origin: row.origin,
    postingUrl: row.postingUrl,
    postingSource: row.posting?.source ?? null,
    firstReplyAt: row.events[0]?.at ?? null,
    documents: row.documents.map((document) => ({
      kind: document.kind,
      themeName: document.theme?.name ?? null,
      versionCauses: document.versions.map((version) => version.cause),
    })),
  }));
  return computeInsights(applications, now);
}
