import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiToken } from "@/lib/api-tokens";
import { createTestClient, resetDatabase } from "@/test/db";

import { GET as list } from "./postings/scanned/route";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
const prisma = () => db.client!;

beforeEach(() => resetDatabase(prisma()));
afterAll(() => prisma().$disconnect());

const key = async () => (await createApiToken("claude-code", "READ")).token;
const get = (token: string | null, query = "") => list(new Request(`http://localhost/api/v1/postings/scanned${query}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper reading JSON of several shapes
const json = async (response: Response) => (await response.json()) as { data?: any; error?: { code: string; message: string } };

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  source: "GREENHOUSE" as const,
  externalId: `acme:${id}`,
  companyName: "Acme",
  title: `Role ${id}`,
  url: `https://example.test/${id}`,
  description: "A long description of the role. ".repeat(40),
  canonicalKey: `acme_role-${id}`,
  fingerprint: id,
  firstSeenAt: new Date("2026-11-01T00:00:00Z"),
  lastSeenAt: new Date("2026-11-01T00:00:00Z"),
  ...extra,
});

describe("GET /api/v1/postings/scanned", () => {
  it("lists the kept postings best score first, as snippets with their reasons, never the whole text", async () => {
    await prisma().scannedPosting.createMany({
      data: [
        row("1", { score: 55, scoreBand: "possible", scoreReasons: ["Posted in the last two weeks"] }),
        row("2", { score: 92, scoreBand: "excellent", scoreReasons: ["Mentions 3 of your skills: Figma"], scoreRedFlags: ["Pay up to EUR 50,000 is below your minimum of EUR 60,000"] }),
        row("3", { state: "DISMISSED", score: 99, scoreBand: "excellent" }),
        row("4", { closedAt: new Date(), score: 98, scoreBand: "excellent" }),
        row("5", { guardAlarm: true, score: 40, scoreBand: "poor" }),
      ],
    });
    const answer = await json(await get(await key()));
    expect(answer.data.map((p: { title: string }) => p.title)).toEqual(["Role 2", "Role 1", "Role 5"]);
    expect(answer.data[0]).toMatchObject({ score: 92, band: "excellent", why: ["Mentions 3 of your skills: Figma"], against: [expect.stringMatching(/below your minimum/)] });
    expect(answer.data[0].snippet.length).toBeLessThanOrEqual(280);
    expect(answer.data[0]).not.toHaveProperty("description");
    expect(answer.data[2].warning).toMatch(/instruction-like/);
  });

  it("filters, and says what is wrong with a filter it cannot read", async () => {
    await prisma().scannedPosting.createMany({ data: [row("1", { score: 55 }), row("2", { score: 92 }), row("3", { state: "SAVED", score: 70 })] });
    const token = await key();
    expect((await json(await get(token, "?minScore=60"))).data).toHaveLength(2);
    expect((await json(await get(token, "?state=SAVED"))).data.map((p: { title: string }) => p.title)).toEqual(["Role 3"]);
    expect((await json(await get(token, "?limit=1"))).data).toHaveLength(1);
    for (const bad of ["?state=NOPE", "?minScore=high", "?limit=0", "?minScore=101"]) {
      const response = await get(token, bad);
      expect(response.status, bad).toBe(400);
      expect((await json(response)).error?.code).toBe("bad_request");
    }
  });

  it("needs a token", async () => {
    expect((await get(null)).status).toBe(401);
  });
});
