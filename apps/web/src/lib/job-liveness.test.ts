import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { boardPostingOf, checkLiveness, livenessFromScan } from "./job-liveness";

const real = (name: string): unknown => JSON.parse(readFileSync(path.join(__dirname, "job-search/boards/fixtures/real", name), "utf8"));
const answer = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

/** A fetch that answers each board host from a recording, and counts what it was asked. */
function boards(answers: Record<string, unknown>) {
  const asked: string[] = [];
  const fetchImpl = vi.fn(async (input: URL | string) => {
    const url = new URL(String(input));
    asked.push(url.href);
    const key = Object.keys(answers).find((prefix) => url.href.startsWith(prefix));
    if (!key) return new Response("{}", { status: 404 });
    const body = answers[key];
    return body instanceof Response ? body : answer(body);
  }) as unknown as typeof fetch;
  return { fetchImpl, asked };
}

describe("boardPostingOf", () => {
  it("reads the board and the posting from a posting's own address on a board host", () => {
    expect(boardPostingOf("https://boards.greenhouse.io/stripe/jobs/8172487")).toEqual({ source: "GREENHOUSE", ref: { slug: "stripe" }, externalId: "stripe:8172487" });
    expect(boardPostingOf("https://job-boards.greenhouse.io/stripe/jobs/8172487?gh_src=x")).toMatchObject({ externalId: "stripe:8172487" });
    expect(boardPostingOf("https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd")).toEqual({
      source: "LEVER",
      ref: { slug: "palantir", region: undefined },
      externalId: "palantir:6ed76ce8-4156-4b60-b120-403538bd66cd",
    });
    expect(boardPostingOf("https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd/apply")).toMatchObject({ externalId: "palantir:6ed76ce8-4156-4b60-b120-403538bd66cd" });
    expect(boardPostingOf("https://jobs.ashbyhq.com/openai/240d459b-696d-43eb-8497-fab3e56ecd9b")).toMatchObject({ source: "ASHBY", externalId: "openai:240d459b-696d-43eb-8497-fab3e56ecd9b" });
  });

  it("knows nothing of a company's own page, a board page without a posting, or another site", () => {
    expect(boardPostingOf("https://stripe.com/jobs/search?gh_jid=8172487")).toBeNull();
    expect(boardPostingOf("https://boards.greenhouse.io/stripe")).toBeNull();
    expect(boardPostingOf("https://boards.greenhouse.io/stripe/jobs/not-a-number")).toBeNull();
    expect(boardPostingOf("https://example.com/boards.greenhouse.io/stripe/jobs/1")).toBeNull();
    expect(boardPostingOf("https://example.com/?next=https://jobs.lever.co/a/b")).toBeNull();
    expect(boardPostingOf("javascript:alert(1)")).toBeNull();
    expect(boardPostingOf("")).toBeNull();
  });
});

describe("livenessFromScan", () => {
  it("takes what the last scan of the board said", () => {
    const seen = new Date("2026-10-30T10:00:00Z");
    expect(livenessFromScan({ closedAt: null, lastSeenAt: seen })).toMatchObject({ state: "open" });
    expect(livenessFromScan({ closedAt: new Date("2026-11-01T10:00:00Z"), lastSeenAt: seen })).toMatchObject({ state: "closed" });
    expect(livenessFromScan(null)).toBeNull();
  });
});

describe("checkLiveness", () => {
  const stripeOpen = "https://job-boards.greenhouse.io/stripe/jobs/8172487";

  it("says open when the employer's board still lists it, asking only that board's host", async () => {
    const { fetchImpl, asked } = boards({ "https://boards-api.greenhouse.io/v1/boards/stripe/jobs": real("greenhouse-jobs.json") });
    const result = await checkLiveness(stripeOpen, { fetchImpl, sleep: async () => {} });
    expect(result.state).toBe("open");
    expect(asked.every((href) => new URL(href).hostname === "boards-api.greenhouse.io")).toBe(true);
  });

  it("says closed when a Greenhouse or Ashby board lists others but no longer this", async () => {
    const gh = boards({ "https://boards-api.greenhouse.io/v1/boards/stripe/jobs": real("greenhouse-jobs.json") });
    expect((await checkLiveness("https://boards.greenhouse.io/stripe/jobs/1", { fetchImpl: gh.fetchImpl, sleep: async () => {} })).state).toBe("closed");
    const ashby = boards({ "https://api.ashbyhq.com/posting-api/job-board/openai": real("ashby-board.json") });
    expect((await checkLiveness("https://jobs.ashbyhq.com/openai/00000000-0000-0000-0000-000000000000", { fetchImpl: ashby.fetchImpl, sleep: async () => {} })).state).toBe("closed");
  });

  it("does not call a Lever posting closed for missing from its list: Lever's public list leaves some open ones out", async () => {
    const { fetchImpl } = boards({ "https://api.lever.co/v0/postings/palantir": real("lever-postings.json") });
    const open = await checkLiveness("https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd", { fetchImpl, sleep: async () => {} });
    expect(open.state).toBe("open");
    const missing = await checkLiveness("https://jobs.lever.co/palantir/00000000-0000-0000-0000-000000000000", { fetchImpl, sleep: async () => {} });
    expect(missing.state).toBe("unknown");
    expect(missing.note).toMatch(/Lever/);
  });

  it("says unknown, never closed, when the board is empty, missing, down or answers in a new shape", async () => {
    const options = { sleep: async () => {} };
    for (const body of [{ jobs: [] }, new Response("nope", { status: 500 }), new Response("{}", { status: 404 }), { surprise: true }]) {
      const { fetchImpl } = boards({ "https://boards-api.greenhouse.io/v1/boards/stripe/jobs": body });
      expect((await checkLiveness(stripeOpen, { fetchImpl, ...options })).state).toBe("unknown");
    }
  });

  it("uses the last scan for a link that is not on a board host, and says it can't tell where there is none", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const link = "https://stripe.com/jobs/search?gh_jid=8172487";
    const scan = { closedAt: new Date("2026-11-01T00:00:00Z"), lastSeenAt: new Date("2026-10-30T00:00:00Z") };
    expect((await checkLiveness(link, { scan, fetchImpl })).state).toBe("closed");
    const none = await checkLiveness(link, { scan: null, fetchImpl });
    expect(none.state).toBe("unknown");
    expect(none.note).toMatch(/Watched companies/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never fetches for an address it can't read", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    expect((await checkLiveness("", { fetchImpl })).state).toBe("unknown");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
