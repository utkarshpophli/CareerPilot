import { describe, expect, it } from "vitest";

import { startOfDay } from "./day";

describe("startOfDay", () => {
  it("is UTC midnight in UTC", () => {
    expect(startOfDay(new Date("2026-11-02T15:30:00Z"), "UTC").toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("is the previous UTC evening for a zone ahead of UTC, and goes by the zone's date", () => {
    // 02:00 on 3 Nov in India (UTC+5:30) is still 2 Nov in UTC.
    expect(startOfDay(new Date("2026-11-02T20:30:00Z"), "Asia/Kolkata").toISOString()).toBe("2026-11-02T18:30:00.000Z");
    expect(startOfDay(new Date("2026-11-02T10:00:00Z"), "Asia/Kolkata").toISOString()).toBe("2026-11-01T18:30:00.000Z");
  });

  it("works behind UTC", () => {
    expect(startOfDay(new Date("2026-11-02T03:00:00Z"), "America/Los_Angeles").toISOString()).toBe("2026-11-01T07:00:00.000Z"); // PDT, UTC-7 until 1 Nov
    expect(startOfDay(new Date("2026-11-02T20:00:00Z"), "America/Los_Angeles").toISOString()).toBe("2026-11-02T08:00:00.000Z"); // PST, UTC-8 after the change
  });

  it("is right on the day the clocks change", () => {
    // 8 March 2026: Los Angeles starts the day on PST (UTC-8) and ends it on PDT (UTC-7).
    expect(startOfDay(new Date("2026-03-08T20:00:00Z"), "America/Los_Angeles").toISOString()).toBe("2026-03-08T08:00:00.000Z");
  });

  it("is never later than now and less than a day and an hour before it", () => {
    for (const zone of ["UTC", "Asia/Kolkata", "Pacific/Auckland", "America/Sao_Paulo", "Europe/Berlin"]) {
      const now = new Date("2026-11-02T12:34:56Z");
      const start = startOfDay(now, zone);
      expect(start.getTime(), zone).toBeLessThanOrEqual(now.getTime());
      expect(now.getTime() - start.getTime(), zone).toBeLessThan(25 * 3_600_000);
    }
  });
});
