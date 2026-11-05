// Whether a worker process is there (docs/adr/0004): each one rewrites its WorkerHeartbeat row every 30 seconds.

/** Three missed beats. */
export const STALE_AFTER_MS = 90_000;

export type WorkerStatus = "ok" | "stale" | "none";

export function workerStatus(heartbeats: { beatAt: Date }[], now: Date = new Date()): WorkerStatus {
  if (heartbeats.length === 0) return "none";
  const newest = Math.max(...heartbeats.map((beat) => beat.beatAt.getTime()));
  return now.getTime() - newest <= STALE_AFTER_MS ? "ok" : "stale";
}
