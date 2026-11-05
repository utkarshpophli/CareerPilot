import { describe, expect, it } from "vitest";

import { workerStatus } from "./worker-status";

const now = new Date("2026-11-04T12:00:00Z");
const beat = (secondsAgo: number) => ({ beatAt: new Date(now.getTime() - secondsAgo * 1000) });

describe("workerStatus", () => {
  it("is none when no worker has ever reported", () => {
    expect(workerStatus([], now)).toBe("none");
  });

  it("is ok while the newest heartbeat is recent, even if another worker's is old", () => {
    expect(workerStatus([beat(10)], now)).toBe("ok");
    expect(workerStatus([beat(3000), beat(45)], now)).toBe("ok");
  });

  it("is stale when every heartbeat is older than three missed beats", () => {
    expect(workerStatus([beat(100)], now)).toBe("stale");
    expect(workerStatus([beat(100), beat(4000)], now)).toBe("stale");
  });
});
