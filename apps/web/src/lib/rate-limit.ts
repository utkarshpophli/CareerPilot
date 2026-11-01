// A token-bucket rate limiter kept in memory. CareerPilot runs as one process
// for one person, so memory is enough; if the app ever runs as several
// processes, each has its own bucket and the limit is per process.

export type Verdict = { ok: true } | { ok: false; retryAfterSeconds: number };

export type Limiter = {
  /** Spends one token for `key`, or says how many whole seconds until one is available. */
  take(key: string): Verdict;
  /** How many keys are being tracked (for tests and monitoring). */
  size(): number;
};

type Bucket = { tokens: number; updated: number };

export function createLimiter({ capacity, refillPerSecond, now = Date.now }: { capacity: number; refillPerSecond: number; now?: () => number }): Limiter {
  const buckets = new Map<string, Bucket>();
  const fullAfterMs = (capacity / refillPerSecond) * 1000;
  let lastPrune = now();

  /** Drops buckets that have been idle long enough to be full again: the same as not having one. */
  function prune(at: number) {
    if (at - lastPrune < fullAfterMs) return;
    lastPrune = at;
    for (const [key, bucket] of buckets) if (at - bucket.updated >= fullAfterMs) buckets.delete(key);
  }

  return {
    take(key) {
      const at = now();
      prune(at);
      const bucket = buckets.get(key) ?? { tokens: capacity, updated: at };
      bucket.tokens = Math.min(capacity, bucket.tokens + ((at - bucket.updated) / 1000) * refillPerSecond);
      bucket.updated = at;
      buckets.set(key, bucket);
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { ok: true };
      }
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerSecond)) };
    },
    size: () => buckets.size,
  };
}
