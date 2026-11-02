import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { ActionError } from "@/lib/action";
import { normalizeUrl } from "@/lib/job-identity";
import { checkLiveness, type Liveness } from "@/lib/job-liveness";
import type { BoardContext } from "@/lib/job-search/boards/types";

// Is the job an application is for still open? Asks the employer's own board
// (or remembers what a scan of it saw) and keeps the answer on the
// application. An owner's click only; it changes nothing but these three
// fields, and "unknown" is kept as unknown.

export type ApplicationLiveness = Liveness & { checkedAt: Date };

export async function checkApplicationPosting(db: PrismaClient, id: string, context: BoardContext = {}): Promise<ApplicationLiveness> {
  const application = await db.application.findUnique({ where: { id }, select: { postingUrl: true, updatedAt: true } });
  if (!application) throw new ActionError("That application no longer exists.");

  const url = application.postingUrl.trim();
  let result: Liveness;
  if (!/^https?:\/\//i.test(url)) {
    result = { state: "unknown", note: "No link was saved with this application, so there is nothing to check." };
  } else {
    const urlKey = normalizeUrl(url);
    const scan = urlKey ? await db.scannedPosting.findFirst({ where: { urlKey }, orderBy: { lastSeenAt: "desc" }, select: { closedAt: true, lastSeenAt: true } }) : null;
    result = await checkLiveness(url, { ...context, scan });
  }

  const checkedAt = new Date();
  await db.application.update({
    where: { id },
    // A check is not an edit: updatedAt stays as it was, so lists ordered by it don't move.
    data: { updatedAt: application.updatedAt, postingOpen: result.state === "unknown" ? null : result.state === "open", postingCheckedAt: checkedAt, postingCheckNote: result.note.slice(0, 500) },
  });
  return { ...result, checkedAt };
}
