// The queues the worker serves (docs/adr/0004). Names and options only, no connection: the web process and the worker both
// import this, and it must not pull a database client in.

export const QUEUES = {
  /** One job per watched board: read it, keep what it lists. */
  boardScan: "board-scan",
  /** A schedule's tick: queues a board-scan job for every enabled board. */
  boardScanAll: "board-scan-all",
  /** One job per application: is the job it is for still open? */
  livenessCheck: "liveness-check",
  /** A schedule's tick: queues a liveness-check job for every draft whose check is missing or a day old. */
  livenessSweep: "liveness-sweep",
  /** A schedule's tick: deletes proposals that finished or expired long ago. */
  proposalPrune: "proposal-prune",
} as const;

/** pg-boss keeps its tables in this schema, away from the app's own. */
export const QUEUE_SCHEMA = "queue";

/**
 * `short`: a second job with the same key is refused while one is still waiting, so pressing Scan now twice, or a schedule
 * landing on a manual scan, queues a board once. A job that is already running does not block a new one.
 */
export const BOARD_SCAN_OPTIONS = { policy: "short", retryLimit: 1, retryDelay: 30, expireInSeconds: 600 } as const;
export const BOARD_SCAN_ALL_OPTIONS = { policy: "short", retryLimit: 0, expireInSeconds: 120 } as const;

export const LIVENESS_CHECK_OPTIONS = { policy: "short", retryLimit: 1, retryDelay: 30, expireInSeconds: 300 } as const;
export const LIVENESS_SWEEP_OPTIONS = { policy: "short", retryLimit: 0, expireInSeconds: 120 } as const;
export const PROPOSAL_PRUNE_OPTIONS = { policy: "short", retryLimit: 1, retryDelay: 60, expireInSeconds: 120 } as const;

/** When the worker prunes old proposals (always; it only deletes what is long finished). Server time zone is UTC unless TZ says otherwise. */
export const PROPOSAL_PRUNE_CRON = "17 3 * * *";
/** A check is repeated by the sweep only when the last one is older than this. */
export const LIVENESS_MAX_AGE_MS = 24 * 3_600_000;

export type BoardScanJob = { companyId: string };
export type LivenessCheckJob = { applicationId: string };
