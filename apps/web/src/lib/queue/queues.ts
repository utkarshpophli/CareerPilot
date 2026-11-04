// The queues the worker serves (docs/adr/0004). Names and options only, no connection: the web process and the worker both
// import this, and it must not pull a database client in.

export const QUEUES = {
  /** One job per watched board: read it, keep what it lists. */
  boardScan: "board-scan",
  /** A schedule's tick: queues a board-scan job for every enabled board. */
  boardScanAll: "board-scan-all",
} as const;

/** pg-boss keeps its tables in this schema, away from the app's own. */
export const QUEUE_SCHEMA = "queue";

/**
 * `short`: a second job with the same key is refused while one is still waiting, so pressing Scan now twice, or a schedule
 * landing on a manual scan, queues a board once. A job that is already running does not block a new one.
 */
export const BOARD_SCAN_OPTIONS = { policy: "short", retryLimit: 1, retryDelay: 30, expireInSeconds: 600 } as const;
export const BOARD_SCAN_ALL_OPTIONS = { policy: "short", retryLimit: 0, expireInSeconds: 120 } as const;

export type BoardScanJob = { companyId: string };
