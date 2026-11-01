import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { AGENT_MAY_SET, assertAgentMayMove, mayAgentSet } from "./agent-status-policy";
import { ServiceError } from "./service-error";

// Audit A-05, A-09: an assistant (a token, the Claude connector) may record that
// an application was rejected or declined, or put it back to draft. It may not
// claim progress that only the owner knows (sent, interview, offer, accepted),
// and it may not touch applications waiting for review or archived.

const db = createTestClient();
beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

const rejects = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ServiceError);
    return (error as ServiceError).code;
  }
  throw new Error("expected a refusal");
};

describe("mayAgentSet", () => {
  it("allows only draft, rejected and declined", () => {
    expect([...AGENT_MAY_SET].sort()).toEqual(["DECLINED", "DRAFT", "REJECTED"]);
    for (const status of ["SENT", "SCREENING", "INTERVIEW", "OFFER", "ACCEPTED"] as const) expect(mayAgentSet(status), status).toBe(false);
  });
});

describe("assertAgentMayMove", () => {
  it("lets an assistant mark an ordinary application rejected", async () => {
    const app = await db.application.create({ data: { title: "Engineer" } });
    await expect(assertAgentMayMove(db, app.id, "REJECTED")).resolves.toBeUndefined();
  });

  it("refuses statuses that claim progress, saying the owner makes those moves", async () => {
    const app = await db.application.create({ data: { title: "Engineer" } });
    for (const status of ["SENT", "SCREENING", "INTERVIEW", "OFFER", "ACCEPTED"] as const) {
      expect(await rejects(assertAgentMayMove(db, app.id, status)), status).toBe("forbidden");
    }
    await expect(assertAgentMayMove(db, app.id, "OFFER")).rejects.toThrow(/only you can do that/);
  });

  it("refuses an application waiting for the owner's review, an archived one, and an unknown one", async () => {
    const waiting = await db.application.create({ data: { title: "Draft by agent", awaitingReview: true } });
    const archived = await db.application.create({ data: { title: "Old", archivedAt: new Date() } });
    expect(await rejects(assertAgentMayMove(db, waiting.id, "REJECTED"))).toBe("conflict");
    expect(await rejects(assertAgentMayMove(db, archived.id, "REJECTED"))).toBe("conflict");
    expect(await rejects(assertAgentMayMove(db, "missing", "REJECTED"))).toBe("not_found");
  });
});
