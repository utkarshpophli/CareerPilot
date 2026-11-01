import { describe, expect, it } from "vitest";

import { createLimiter } from "./rate-limit";

describe("createLimiter", () => {
  it("lets a burst through up to its capacity, then says how long to wait", () => {
    const limiter = createLimiter({ capacity: 3, refillPerSecond: 1, now: () => 0 });
    expect([limiter.take("a"), limiter.take("a"), limiter.take("a")].map((verdict) => verdict.ok)).toEqual([true, true, true]);
    const refused = limiter.take("a");
    expect(refused).toEqual({ ok: false, retryAfterSeconds: 1 });
  });

  it("refills over time, up to the capacity and no further", () => {
    let now = 0;
    const limiter = createLimiter({ capacity: 2, refillPerSecond: 1, now: () => now });
    limiter.take("a");
    limiter.take("a");
    expect(limiter.take("a").ok).toBe(false);
    now += 1000;
    expect(limiter.take("a").ok).toBe(true);
    expect(limiter.take("a").ok).toBe(false);
    now += 60_000; // a long quiet spell does not store more than the capacity
    expect([limiter.take("a").ok, limiter.take("a").ok, limiter.take("a").ok]).toEqual([true, true, false]);
  });

  it("counts each key on its own", () => {
    const limiter = createLimiter({ capacity: 1, refillPerSecond: 0.1, now: () => 0 });
    expect(limiter.take("a").ok).toBe(true);
    expect(limiter.take("a").ok).toBe(false);
    expect(limiter.take("b").ok).toBe(true);
  });

  it("forgets keys that have been quiet long enough to be full again", () => {
    let now = 0;
    const limiter = createLimiter({ capacity: 2, refillPerSecond: 1, now: () => now });
    for (let key = 0; key < 50; key++) limiter.take(`k${key}`);
    expect(limiter.size()).toBe(50);
    now += 10_000;
    limiter.take("fresh"); // pruning happens as it is used
    expect(limiter.size()).toBe(1);
  });
});
