import type { PgBoss } from "pg-boss";

import { BOARD_SCAN_OPTIONS, QUEUES, type BoardScanJob } from "./queues";

export type Queued = { queued: number; alreadyWaiting: number };

/** One board-scan job per company. A board that already has one waiting is counted, not queued twice. */
export async function enqueueBoardScans(boss: Pick<PgBoss, "send">, companyIds: string[]): Promise<Queued> {
  let queued = 0;
  let alreadyWaiting = 0;
  for (const companyId of companyIds) {
    const job: BoardScanJob = { companyId };
    const id = await boss.send(QUEUES.boardScan, job, { ...BOARD_SCAN_OPTIONS, singletonKey: companyId });
    if (id) queued++;
    else alreadyWaiting++;
  }
  return { queued, alreadyWaiting };
}
