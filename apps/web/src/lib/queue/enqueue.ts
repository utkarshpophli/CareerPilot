import type { PgBoss } from "pg-boss";

import { BOARD_SCAN_OPTIONS, LIVENESS_CHECK_OPTIONS, QUEUES, type BoardScanJob, type LivenessCheckJob } from "./queues";

export type Queued = { queued: number; alreadyWaiting: number };

/** One job per id, each once: an id that already has a job waiting is counted, not queued twice. */
async function enqueueEach<T extends object>(boss: Pick<PgBoss, "send">, queue: string, options: object, ids: string[], jobOf: (id: string) => T): Promise<Queued> {
  let queued = 0;
  let alreadyWaiting = 0;
  for (const id of ids) {
    const sent = await boss.send(queue, jobOf(id), { ...options, singletonKey: id });
    if (sent) queued++;
    else alreadyWaiting++;
  }
  return { queued, alreadyWaiting };
}

/** One board-scan job per company. */
export const enqueueBoardScans = (boss: Pick<PgBoss, "send">, companyIds: string[]): Promise<Queued> =>
  enqueueEach<BoardScanJob>(boss, QUEUES.boardScan, BOARD_SCAN_OPTIONS, companyIds, (companyId) => ({ companyId }));

/** One liveness-check job per application. */
export const enqueueLivenessChecks = (boss: Pick<PgBoss, "send">, applicationIds: string[]): Promise<Queued> =>
  enqueueEach<LivenessCheckJob>(boss, QUEUES.livenessCheck, LIVENESS_CHECK_OPTIONS, applicationIds, (applicationId) => ({ applicationId }));
