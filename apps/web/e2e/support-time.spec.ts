import { expect, test } from "@playwright/test";

import { sql } from "./support";

// The app stores times as UTC in `timestamp` columns. The helper that reads them for the specs must read
// them as UTC too, whatever zone the machine is in, or a spec comparing a database time with a time from
// the app is off by the machine's offset (found on a UTC+5:30 machine: exactly 19,800,000 ms).
test("the sql helper reads timestamps as UTC on any machine", async () => {
  const [row] = await sql<{ at: Date }>(`SELECT '2026-11-02 03:00:00'::timestamp AS at`);
  expect(row!.at.toISOString()).toBe("2026-11-02T03:00:00.000Z");
});
