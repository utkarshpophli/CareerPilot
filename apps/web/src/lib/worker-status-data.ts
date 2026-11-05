import "server-only";

import { prisma } from "./prisma";
import { workerStatus, type WorkerStatus } from "./worker-status";

/** Whether a worker process is reporting right now. */
export async function loadWorkerStatus(): Promise<WorkerStatus> {
  return workerStatus(await prisma.workerHeartbeat.findMany({ select: { beatAt: true } }).catch(() => []));
}
