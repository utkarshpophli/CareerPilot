import { describe, expect, it } from "vitest";

import type { AgentRun } from "@/generated/prisma/client";

import { isStale, runsSignature, STALE_AFTER_MS, toRunView } from "./runs-view";

const run = (overrides: Partial<AgentRun> = {}): AgentRun => ({
  id: "r1",
  kind: "scan",
  title: "Daily scan",
  actorKind: "CLI",
  actorName: "claude-code",
  status: "RUNNING",
  startedAt: new Date("2026-11-01T12:00:00Z"),
  lastActivityAt: new Date("2026-11-01T12:05:00Z"),
  finishedAt: null,
  stepCount: 2,
  lastStep: "Scored 12 postings",
  summary: "",
  applicationId: null,
  idempotencyKey: "secret-key",
  ...overrides,
});

describe("toRunView", () => {
  it("turns dates into strings and leaves the idempotency key out", () => {
    const view = toRunView(run({ finishedAt: new Date("2026-11-01T12:10:00Z"), status: "OK" }));
    expect(view).toMatchObject({ startedAt: "2026-11-01T12:00:00.000Z", finishedAt: "2026-11-01T12:10:00.000Z", status: "OK", stalled: false });
    expect(JSON.stringify(view)).not.toContain("secret-key");
  });

  it("marks a run stalled once it has been quiet too long", () => {
    const quiet = new Date(run().lastActivityAt.getTime() + STALE_AFTER_MS + 1);
    expect(toRunView(run(), quiet).stalled).toBe(true);
    expect(toRunView(run({ status: "FAILED" }), quiet).stalled).toBe(false);
    expect(isStale(run(), new Date(run().lastActivityAt.getTime() + 1000))).toBe(false);
  });
});

describe("runsSignature", () => {
  // A fixed clock, shortly after the run's last step. With the real clock the run counted as stalled
  // whenever the test ran long after its fixture date, and the comparison below could never differ.
  const justAfter = new Date(run().lastActivityAt.getTime() + 1000);
  const view = (overrides: Partial<AgentRun> = {}, now = justAfter) => toRunView(run(overrides), now);

  it("changes with a step, a finish, or going stalled, and not otherwise", () => {
    const base = [view()];
    const same = [view()];
    expect(runsSignature(same)).toBe(runsSignature(base));
    expect(runsSignature([view({ stepCount: 3 })])).not.toBe(runsSignature(base));
    expect(runsSignature([view({ status: "OK" })])).not.toBe(runsSignature(base));
    expect(runsSignature([view({}, new Date(run().lastActivityAt.getTime() + STALE_AFTER_MS + 1))])).not.toBe(runsSignature(base));
  });
});
