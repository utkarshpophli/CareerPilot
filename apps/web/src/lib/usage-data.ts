import "server-only";

import { prisma } from "./prisma";
import type { UsageRow } from "./usage-summary";

/** More than this in the window is cut off at the newest; a personal install makes a few hundred calls. */
const MAX_ROWS = 20_000;

/** The AI calls of the last `days` days, newest first. */
export function loadUsageRows(days: number, now: Date = new Date()): Promise<UsageRow[]> {
  return prisma.aiCall.findMany({ where: { at: { gte: new Date(now.getTime() - days * 86_400_000) } }, orderBy: { at: "desc" }, take: MAX_ROWS });
}
