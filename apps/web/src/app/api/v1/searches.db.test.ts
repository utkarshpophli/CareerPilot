import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiToken } from "@/lib/api-tokens";
import { createTestClient, resetDatabase } from "@/test/db";

import { POST as scores } from "./postings/scores/route";
import { POST as more } from "./searches/[id]/more/route";
import { GET as read } from "./searches/[id]/route";
import { POST as run } from "./searches/route";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
const searched = vi.hoisted(() => ({ queries: [] as unknown[], outcome: { ok: true } as { ok: boolean; message?: string; problem?: string } }));
const found = {
  source: "JSEARCH",
  externalId: "j1",
  title: "Product Designer",
  company: "Acme",
  place: "Berlin",
  remote: null,
  salary: "",
  postedAt: "2026-10-30T00:00:00.000Z",
  url: "https://example.com/j1",
  via: "LinkedIn",
  description: "Figma and research. ".repeat(40),
  complete: true,
};
vi.mock("@/lib/job-search/find", () => ({
  askSource: async (query: unknown) => {
    searched.queries.push(query);
    return searched.outcome.ok ? { ok: true, source: "JSEARCH", postings: [found], next: null } : searched.outcome;
  },
  fullText: async () => null,
}));
vi.mock("@/lib/profile-data", async () => {
  const { demoProfile } = await import("@/lib/demo-profile");
  return { loadProfile: async () => demoProfile() };
});
const prisma = () => db.client!;

beforeEach(async () => {
  await resetDatabase(prisma());
  searched.queries = [];
  searched.outcome = { ok: true };
});
afterAll(() => prisma().$disconnect());

const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
const token = async (scope: "READ" | "WRITE" = "WRITE") => (await createApiToken("claude-code", scope)).token;
const call = (handler: (request: Request, context: never) => Promise<Response>, key: string | null, body?: unknown, id = "") =>
  handler(
    new Request("http://localhost/api/v1/searches", {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    ctx(id),
  );
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper reading JSON of several shapes
const json = async (response: Response) => (await response.json()) as { data?: any; error?: { code: string; message: string } };

describe("POST /api/v1/searches", () => {
  it("runs a search in the profile's city and country, keeps it, and numbers the postings", async () => {
    const answer = await json(await call(run, await token(), { keywords: "product designer" }));
    expect(answer.data).toMatchObject({ searched: expect.stringContaining("product designer"), found: 1, moreAvailable: false, postings: [{ number: 1, title: "Product Designer", company: "Acme" }] });
    expect(searched.queries[0]).toMatchObject({ keywords: "product designer", radiusKm: 25, remoteOnly: false, postedWithin: "month" });
    expect(await prisma().postingSearch.count()).toBe(1);
    // A list shows a snippet, never the whole posting.
    expect(answer.data.postings[0].snippet.length).toBeLessThanOrEqual(280);
  });

  it("needs a write token, a keyword, and a country it can work out", async () => {
    expect((await call(run, await token("READ"), { keywords: "x" })).status).toBe(403);
    expect((await call(run, null, { keywords: "x" })).status).toBe(401);
    expect((await call(run, await token(), {})).status).toBe(400);
    expect((await call(run, await token(), { keywords: "x", country: "Narnia" })).status).toBe(400);
    expect(searched.queries).toHaveLength(0);
  });

  it("says what went wrong at the source in the envelope", async () => {
    searched.outcome = { ok: false, problem: "quota", message: "Out of searches this month." };
    const response = await call(run, await token(), { keywords: "designer" });
    expect(response.status).toBe(409);
    expect((await json(response)).error).toMatchObject({ code: "conflict", message: "Out of searches this month." });
  });
});

describe("GET /api/v1/searches/{id} and POST /api/v1/searches/{id}/more", () => {
  it("reads a kept search without using a search, and 404s for one that is gone", async () => {
    const key = await token("READ");
    const made = await json(await call(run, await token(), { keywords: "designer" }));
    searched.queries = [];
    const answer = await json(await call(read, key, undefined, made.data.id));
    expect(answer.data).toMatchObject({ id: made.data.id, found: 1, postings: [{ number: 1 }] });
    expect(searched.queries).toHaveLength(0);
    expect((await call(read, key, undefined, "gone")).status).toBe(404);
  });

  it("asks for the next page of a kept search, and 404s for one that is gone", async () => {
    const made = await json(await call(run, await token(), { keywords: "designer" }));
    const answer = await json(await call(more, await token(), {}, made.data.id));
    expect(answer.data).toMatchObject({ id: made.data.id, added: 0, moreAvailable: false });
    expect((await call(more, await token(), {}, "gone")).status).toBe(404);
  });
});

describe("POST /api/v1/postings/scores", () => {
  it("keeps the scores an assistant worked out, clamped and trimmed by code", async () => {
    const made = await json(await call(run, await token(), { keywords: "designer" }));
    const answer = await json(
      await call(scores, await token(), { searchId: made.data.id, scores: [{ number: 1, score: 250, reasons: ["  Figma in the Acme role  "] }, { number: 7, score: 10, reasons: ["?"] }] }),
    );
    expect(answer.data).toMatchObject({ saved: [{ number: 1, score: 100 }], notFound: [7] });
    expect(await prisma().postingScore.findMany()).toMatchObject([{ externalId: "j1", score: 100, reasons: ["Figma in the Acme role"], scoredWith: "api:claude-code" }]);
  });

  it("400 for scores that are not a list of numbers with reasons; 404 for a search that is gone", async () => {
    const key = await token();
    expect((await call(scores, key, { scores: [] })).status).toBe(400);
    expect((await call(scores, key, { scores: [{ number: 1, score: "high", reasons: ["x"] }] })).status).toBe(400);
    expect((await call(scores, key, { scores: [{ number: 1, score: 5, reasons: [] }] })).status).toBe(400);
    expect((await call(scores, key, { searchId: "gone", scores: [{ number: 1, score: 5, reasons: ["x"] }] })).status).toBe(404);
  });
});
