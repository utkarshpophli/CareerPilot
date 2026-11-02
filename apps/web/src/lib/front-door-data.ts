import "server-only";

import { listConnectedAssistants } from "./connect/assistants";
import { startOfDay } from "./connect/day";
import { computeFrontDoor, type FrontDoor } from "./front-door";
import { loadInsights } from "./insights-data";
import { prisma } from "./prisma";
import { listPendingProposals } from "./proposals";
import type { RunView } from "./runs-view";
import { countScannedPostings } from "./services/scanned-postings";

/**
 * The figures behind the dashboard's front-door cards. `runs` is the
 * snapshot the page already has (only the ones going now are shown) and
 * `attention` is how many things "Worth a look" lists.
 */
export async function loadFrontDoor({ runs, attention, timeZone, now = new Date() }: { runs: RunView[]; attention: number; timeZone: string; now?: Date }): Promise<FrontDoor> {
  const [insights, assistants, agentDrafts, proposals, scanned] = await Promise.all([
    loadInsights(now),
    listConnectedAssistants(prisma, startOfDay(now, timeZone)),
    prisma.application.count({ where: { awaitingReview: true } }),
    listPendingProposals(prisma, now),
    countScannedPostings(prisma),
  ]);
  return computeFrontDoor({ insights, assistants, running: runs.filter((run) => run.status === "RUNNING"), agentDrafts, attention, proposals, newPostings: scanned.NEW });
}
