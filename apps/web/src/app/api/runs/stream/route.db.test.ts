import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "@/lib/auth/session";
import { addRunStep, startRun } from "@/lib/runs";
import type { RunView } from "@/lib/runs-view";
import { createTestClient, resetDatabase } from "@/test/db";

import { GET } from "./route";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

beforeEach(async () => {
  await resetDatabase(db.client!);
  vi.mocked(getSession).mockResolvedValue({ persistent: false, issuedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) });
});
afterAll(() => db.client!.$disconnect());

/** Reads `data:` events one at a time from a stream. */
function reader(response: Response) {
  const source = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  return async (): Promise<{ runs: RunView[] }> => {
    for (;;) {
      const end = buffer.indexOf("\n\n");
      if (end >= 0) {
        const chunk = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (chunk.startsWith("data: ")) return JSON.parse(chunk.slice(6));
        continue;
      }
      const { value, done } = await source.read();
      if (done) throw new Error("The stream ended");
      buffer += decoder.decode(value, { stream: true });
    }
  };
}

describe("GET /api/runs/stream", () => {
  it("sends the runs now, then again when one changes, and only then", async () => {
    const abort = new AbortController();
    const response = await GET(new NextRequest("http://localhost:3000/api/runs/stream", { signal: abort.signal }), undefined);
    expect(response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    const next = reader(response);

    expect((await next()).runs).toEqual([]);
    const run = await startRun(db.client!, { kind: "scan", title: "Daily scan" });
    expect((await next()).runs.map((view) => [view.title, view.status, view.stepCount])).toEqual([["Daily scan", "RUNNING", 0]]);
    await addRunStep(db.client!, run.id, { summary: "Fetched Greenhouse" });
    expect((await next()).runs[0]).toMatchObject({ stepCount: 1, lastStep: "Fetched Greenhouse" });
    abort.abort();
  }, 15_000);

  it("answers 401 when signed out", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost:3000/api/runs/stream"), undefined)).status).toBe(401);
  });
});
