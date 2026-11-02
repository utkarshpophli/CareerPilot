import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionError } from "@/lib/action";
import { createTestClient, resetDatabase } from "@/test/db";

import { checkApplicationPosting } from "./liveness";

const db = createTestClient();
beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

const recording = (name: string) => readFileSync(path.join(__dirname, "../job-search/boards/fixtures/real", name), "utf8");
const board = (body: string, status = 200) => vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
const application = (postingUrl: string, id = "a1") => db.application.create({ data: { id, title: "Designer", company: "Stripe", postingUrl } });

describe("checkApplicationPosting", () => {
  it("asks the employer's board and keeps the answer on the application", async () => {
    await application("https://job-boards.greenhouse.io/stripe/jobs/8172487");
    const result = await checkApplicationPosting(db, "a1", { fetchImpl: board(recording("greenhouse-jobs.json")) });
    expect(result).toMatchObject({ state: "open" });
    expect(await db.application.findUniqueOrThrow({ where: { id: "a1" } })).toMatchObject({ postingOpen: true, postingCheckNote: "Greenhouse still lists it." });
    expect((await db.application.findUniqueOrThrow({ where: { id: "a1" } })).postingCheckedAt).toBeInstanceOf(Date);
  });

  it("keeps closed as false, and a doubtful answer as unknown (null), never as closed", async () => {
    await application("https://job-boards.greenhouse.io/stripe/jobs/1");
    expect(await checkApplicationPosting(db, "a1", { fetchImpl: board(recording("greenhouse-jobs.json")) })).toMatchObject({ state: "closed" });
    expect((await db.application.findUniqueOrThrow({ where: { id: "a1" } })).postingOpen).toBe(false);

    const down = await checkApplicationPosting(db, "a1", { fetchImpl: board("busy", 500), sleep: async () => {} });
    expect(down.state).toBe("unknown");
    expect((await db.application.findUniqueOrThrow({ where: { id: "a1" } })).postingOpen).toBeNull();
  });

  it("uses what a scan of a watched board saw for a company's own link, without asking the network", async () => {
    await application("https://stripe.com/jobs/search?gh_jid=8172487");
    await db.scannedPosting.create({
      data: {
        source: "GREENHOUSE",
        externalId: "stripe:8172487",
        companyName: "Stripe",
        title: "Designer",
        url: "https://stripe.com/jobs/search?gh_jid=8172487&utm_source=x",
        urlKey: (await import("@/lib/job-identity")).normalizeUrl("https://stripe.com/jobs/search?gh_jid=8172487"),
        canonicalKey: "stripe_designer",
        fingerprint: "f",
        firstSeenAt: new Date("2026-10-01"),
        lastSeenAt: new Date("2026-11-01"),
        closedAt: new Date("2026-11-01"),
      },
    });
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    expect(await checkApplicationPosting(db, "a1", { fetchImpl })).toMatchObject({ state: "closed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("is not an edit: the application's updated time stays", async () => {
    const before = await application("https://job-boards.greenhouse.io/stripe/jobs/8172487");
    await checkApplicationPosting(db, "a1", { fetchImpl: board(recording("greenhouse-jobs.json")) });
    expect((await db.application.findUniqueOrThrow({ where: { id: "a1" } })).updatedAt).toEqual(before.updatedAt);
  });

  it("says so when no link was saved, and refuses an application that is gone", async () => {
    await application("");
    expect(await checkApplicationPosting(db, "a1")).toMatchObject({ state: "unknown", note: expect.stringMatching(/No link/) });
    await expect(checkApplicationPosting(db, "missing")).rejects.toBeInstanceOf(ActionError);
  });
});
