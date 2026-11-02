import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiToken } from "@/lib/api-tokens";
import { createTestClient, resetDatabase } from "@/test/db";

import { GET as list, POST as add } from "./companies/route";
import { POST as scan } from "./companies/scan/route";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
const board = vi.hoisted(() => ({ seen: [] as string[] }));
vi.mock("@/lib/job-search/boards/request", async (original) => {
  const real = await original<typeof import("@/lib/job-search/boards/request")>();
  return {
    ...real,
    requestBoardJson: async (address: string) => {
      board.seen.push(address);
      if (address.includes("/gone/")) throw new (await import("@/lib/job-search/boards/types")).BoardError("not-found", "The source has no such board. Check the name.");
      return {
        jobs: [
          { id: 1, title: "Product Designer", absolute_url: "https://job-boards.greenhouse.io/acme/jobs/1", location: { name: "Berlin" }, content: "Figma. ".repeat(100) },
          { id: 2, title: "Accountant", absolute_url: "https://job-boards.greenhouse.io/acme/jobs/2", location: { name: "Paris" }, content: "Books" },
        ],
      };
    },
  };
});
const prisma = () => db.client!;

beforeEach(async () => {
  await resetDatabase(prisma());
  board.seen = [];
});
afterAll(() => prisma().$disconnect());

const token = async (scope: "READ" | "WRITE" = "WRITE") => (await createApiToken("claude-code", scope)).token;
const call = (handler: (request: Request) => Promise<Response>, key: string | null, body?: unknown) =>
  handler(
    new Request("http://localhost/api/v1/companies", {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper reading JSON of several shapes
const json = async (response: Response) => (await response.json()) as { data?: any; error?: { code: string; message: string } };

describe("/api/v1/companies", () => {
  it("watches a board and lists it; a read token can list but not add", async () => {
    const added = await json(await call(add, await token(), { source: "GREENHOUSE", board: "acme", name: "Acme" }));
    expect(added.data).toMatchObject({ source: "GREENHOUSE", slug: "acme", name: "Acme", created: true });
    expect((await json(await call(list, await token("READ")))).data).toMatchObject([{ name: "Acme", enabled: true, lastError: "" }]);
    expect((await call(add, await token("READ"), { board: "x" })).status).toBe(403);
    expect((await call(list, null)).status).toBe(401);
  });

  it("400 for a board it cannot place, with words that say what to send", async () => {
    const response = await call(add, await token(), { board: "acme" });
    expect(response.status).toBe(400);
    expect((await json(response)).error?.message).toMatch(/which source/i);
    expect((await call(add, await token(), { source: "GREENHOUSE", board: "a/b" })).status).toBe(400);
    expect((await call(add, await token(), { source: "NOPE", board: "acme" })).status).toBe(400);
    expect((await call(add, await token(), { source: "GREENHOUSE", board: 5 })).status).toBe(400);
    expect(await prisma().trackedCompany.count()).toBe(0);
  });
});

describe("POST /api/v1/companies/scan", () => {
  it("scans the watched boards and gives postings with a snippet and a link, never the whole text", async () => {
    await call(add, await token(), { source: "GREENHOUSE", board: "acme", name: "Acme" });
    const answer = await json(await call(scan, await token(), { keywords: "designer", place: "berlin" }));
    expect(answer.data).toMatchObject({ scanned: 1, skipped: 0, matched: 1, companies: [{ name: "Acme", found: 2 }] });
    expect(answer.data.postings).toHaveLength(1);
    const [posting] = answer.data.postings;
    expect(posting).toMatchObject({ title: "Product Designer", company: "Acme", location: "Berlin", url: "https://job-boards.greenhouse.io/acme/jobs/1" });
    expect(posting.snippet.length).toBeLessThanOrEqual(280);
    expect(posting).not.toHaveProperty("description");
    // Reported like any assistant's work.
    expect(await prisma().agentRun.findMany({ where: { kind: "companies.scan" } })).toMatchObject([{ status: "OK", actorName: "claude-code" }]);
  });

  it("shows a board that failed, in words safe to show, without failing the scan", async () => {
    await call(add, await token(), { source: "GREENHOUSE", board: "gone", name: "Gone" });
    const answer = await json(await call(scan, await token(), {}));
    expect(answer.data.companies).toMatchObject([{ name: "Gone", found: 0, error: "The source has no such board. Check the name." }]);
  });

  it("needs a write token and refuses odd options", async () => {
    expect((await call(scan, await token("READ"), {})).status).toBe(403);
    expect((await call(scan, await token(), { limit: "many" })).status).toBe(400);
    expect((await call(scan, await token(), { ids: "all" })).status).toBe(400);
  });
});
