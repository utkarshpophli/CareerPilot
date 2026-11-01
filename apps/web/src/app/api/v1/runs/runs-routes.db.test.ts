import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiToken } from "@/lib/api-tokens";
import { createTestClient, resetDatabase } from "@/test/db";

import { GET as getRun } from "./[id]/route";
import { POST as postStep } from "./[id]/events/route";
import { POST as postFinish } from "./[id]/finish/route";
import { GET as listRuns, POST as startRun } from "./route";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
const prisma = () => db.client!;

beforeEach(() => resetDatabase(prisma()));
afterAll(() => prisma().$disconnect());

const BASE = "http://localhost/api/v1/runs";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

async function writeToken(name = "claude-code") {
  return (await createApiToken(name, "WRITE")).token;
}
function call(handler: (request: Request, context: never) => Promise<Response>, token: string | null, init: { method?: string; path?: string; body?: unknown; headers?: Record<string, string>; id?: string } = {}) {
  const request = new Request(init.path ?? BASE, {
    method: init.method ?? "POST",
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return handler(request, ctx(init.id ?? ""));
}
type RunBody = {
  id: string;
  status: string;
  events: { action: string; actorName: string; data: unknown }[];
  runs: { id: string }[];
};
const json = async (response: Response) => (await response.json()) as { data: RunBody; error?: { code: string; message: string } };

describe("auth", () => {
  it("refuses a request without a token", async () => {
    expect((await call(startRun, null, { body: { kind: "scan", title: "t" } })).status).toBe(401);
    expect((await call(listRuns, null, { method: "GET" })).status).toBe(401);
  });

  it("lets a read-only token read but not write", async () => {
    const { token } = await createApiToken("viewer", "READ");
    expect((await call(startRun, token, { body: { kind: "scan", title: "t" } })).status).toBe(403);
    expect((await call(listRuns, token, { method: "GET" })).status).toBe(200);
  });
});

describe("a run's life over the API", () => {
  it("opens, steps, reads and finishes a run, naming the token in the ledger", async () => {
    const token = await writeToken("codex @ laptop");
    const started = await json(await call(startRun, token, { body: { kind: "Scan", title: "Daily scan" } }));
    expect(started.data).toMatchObject({ kind: "scan", title: "Daily scan", status: "RUNNING", actorKind: "CLI", actorName: "codex @ laptop", stepCount: 0, stalled: false });
    const id = started.data.id as string;

    const step = await json(await call(postStep, token, { id, body: { summary: "Fetched Greenhouse", data: { found: 12 } } }));
    expect(step.data).toMatchObject({ stepCount: 1, lastStep: "Fetched Greenhouse" });

    const detail = await json(await call(getRun, token, { method: "GET", id }));
    expect(detail.data.events.map((event: { action: string }) => event.action)).toEqual(["run.started", "run.step"]);
    expect(detail.data.events[1]).toMatchObject({ actorName: "codex @ laptop", data: { found: 12 } });

    const done = await json(await call(postFinish, token, { id, body: { status: "OK", summary: "12 new postings" } }));
    expect(done.data).toMatchObject({ status: "OK", summary: "12 new postings" });

    const list = await json(await call(listRuns, token, { method: "GET", path: `${BASE}?status=OK` }));
    expect(list.data.runs.map((run: { id: string }) => run.id)).toEqual([id]);
  });

  it("gives the same run back for the same Idempotency-Key", async () => {
    const token = await writeToken();
    const headers = { "idempotency-key": "abc-123" };
    const a = await json(await call(startRun, token, { body: { kind: "scan", title: "t" }, headers }));
    const b = await json(await call(startRun, token, { body: { kind: "scan", title: "t" }, headers }));
    expect(b.data.id).toBe(a.data.id);
    expect(await prisma().agentRun.count()).toBe(1);
  });
});

describe("mistakes get plain answers", () => {
  it("400 for a missing kind or title, or a bad body", async () => {
    const token = await writeToken();
    expect((await call(startRun, token, { body: { title: "t" } })).status).toBe(400);
    expect((await call(startRun, token, { body: { kind: "scan" } })).status).toBe(400);
    expect((await call(startRun, token, { body: { kind: 5, title: "t" } })).status).toBe(400);
  });

  it("404 for an unknown run, 409 for a step after it ended", async () => {
    const token = await writeToken();
    expect((await call(postStep, token, { id: "missing", body: { summary: "x" } })).status).toBe(404);
    expect((await call(getRun, token, { method: "GET", id: "missing" })).status).toBe(404);
    const { data } = await json(await call(startRun, token, { body: { kind: "scan", title: "t" } }));
    await call(postFinish, token, { id: data.id, body: { status: "FAILED" } });
    const late = await call(postStep, token, { id: data.id, body: { summary: "late" } });
    expect(late.status).toBe(409);
    expect((await json(late)).error?.code).toBe("conflict");
  });

  it("400 for a step without a summary, data that is not an object, or a bad finish status", async () => {
    const token = await writeToken();
    const { data } = await json(await call(startRun, token, { body: { kind: "scan", title: "t" } }));
    expect((await call(postStep, token, { id: data.id, body: {} })).status).toBe(400);
    expect((await call(postStep, token, { id: data.id, body: { summary: "x", data: [1, 2] } })).status).toBe(400);
    expect((await call(postFinish, token, { id: data.id, body: { status: "RUNNING" } })).status).toBe(400);
    expect((await call(postFinish, token, { id: data.id, body: { status: "nope" } })).status).toBe(400);
  });

  it("400 for a bad status filter", async () => {
    const token = await writeToken();
    expect((await call(listRuns, token, { method: "GET", path: `${BASE}?status=whatever` })).status).toBe(400);
  });
});
