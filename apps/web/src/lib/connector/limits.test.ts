import { describe, expect, it } from "vitest";

import { COSTLY_TOOLS, createConnectorLimits } from "./limits";

// Audit A-06: the connector had no limits at all. Claude in a chat makes a handful of calls a
// minute; a loop, or a stolen access token, makes thousands and spends job-source quota and AI money.

describe("createConnectorLimits", () => {
  it("lets ordinary use through, then refuses a flood with a wait time", () => {
    const limits = createConnectorLimits({ now: () => 0 });
    let allowed = 0;
    for (let call = 0; call < 500; call++) if (limits.check("client-1", ["get_profile"]).ok) allowed++;
    expect(allowed).toBeGreaterThanOrEqual(30);
    expect(allowed).toBeLessThan(200);
    const refused = limits.check("client-1", ["get_profile"]);
    expect(refused.ok).toBe(false);
    expect(refused.ok === false && refused.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("is stricter for tools that spend job-source quota or AI money", () => {
    const limits = createConnectorLimits({ now: () => 0 });
    expect(COSTLY_TOOLS.has("search_jobs")).toBe(true);
    expect(COSTLY_TOOLS.has("draft_application")).toBe(true);
    expect(COSTLY_TOOLS.has("get_profile")).toBe(false);
    let costly = 0;
    for (let call = 0; call < 20; call++) if (limits.check("client-1", ["search_jobs"]).ok) costly++;
    expect(costly).toBeLessThanOrEqual(11); // a burst of 10, plus at most one refilled
    expect(limits.check("client-1", ["get_profile"]).ok).toBe(true); // cheap calls are not blocked by it
  });

  it("counts every costly tool in a batch, so one request cannot hide a flood", () => {
    const limits = createConnectorLimits({ now: () => 0 });
    const batch = Array.from({ length: 50 }, () => "search_jobs");
    expect(limits.check("client-1", batch).ok).toBe(false);
  });

  it("keeps clients apart, and lets one recover after waiting", () => {
    let now = 0;
    const limits = createConnectorLimits({ now: () => now });
    while (limits.check("a", ["search_jobs"]).ok);
    expect(limits.check("b", ["search_jobs"]).ok).toBe(true);
    expect(limits.check("a", ["search_jobs"]).ok).toBe(false);
    now += 60_000;
    expect(limits.check("a", ["search_jobs"]).ok).toBe(true);
  });
});
