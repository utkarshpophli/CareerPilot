import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiToken } from "@/lib/api-tokens";
import { createTestClient, resetDatabase } from "@/test/db";

import { POST as propose } from "./applications/[id]/proposals/route";
import { GET as listProposals } from "./proposals/route";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
const prisma = () => db.client!;

beforeEach(() => resetDatabase(prisma()));
afterAll(() => prisma().$disconnect());

const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
const write = async (name = "claude-code") => (await createApiToken(name, "WRITE")).token;
type Answer = { data?: any; error?: { code: string; message: string } }; // eslint-disable-line @typescript-eslint/no-explicit-any -- test helper
const json = async (response: Response) => (await response.json()) as Answer;

const post = (token: string | null, id: string, body: unknown) =>
  propose(new Request(`http://localhost/api/v1/applications/${id}/proposals`, { method: "POST", headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" }, body: JSON.stringify(body) }), ctx(id));
const list = (token: string | null) => listProposals(new Request("http://localhost/api/v1/proposals", { headers: token ? { authorization: `Bearer ${token}` } : {} }));

describe("POST /api/v1/applications/{id}/proposals", () => {
  it("needs a write token", async () => {
    const app = await prisma().application.create({ data: { title: "A" } });
    expect((await post(null, app.id, { status: "SENT" })).status).toBe(401);
    const { token } = await createApiToken("viewer", "READ");
    expect((await post(token, app.id, { status: "SENT" })).status).toBe(403);
    expect(await prisma().statusProposal.count()).toBe(0);
  });

  it("records a proposal under the token's name and leaves the application alone", async () => {
    const app = await prisma().application.create({ data: { title: "Engineer at Acme" } });
    const answer = await json(await post(await write("codex @ laptop"), app.id, { status: "SENT", reason: "The user said it went out" }));
    expect(answer.data).toMatchObject({ applicationId: app.id, status: "SENT", state: "PENDING", reason: "The user said it went out", actorName: "codex @ laptop" });
    expect(await prisma().application.findUniqueOrThrow({ where: { id: app.id } })).toMatchObject({ status: "DRAFT", sentAt: null });
    expect(await prisma().activityEvent.findFirstOrThrow({ where: { action: "proposal.created" } })).toMatchObject({ actorKind: "CLI", actorName: "codex @ laptop" });
  });

  it("answers the way the other write routes do for bad input", async () => {
    const token = await write();
    const app = await prisma().application.create({ data: { title: "A" } });
    expect((await post(token, app.id, {})).status).toBe(400);
    expect((await post(token, app.id, { status: "FLYING" })).status).toBe(400);
    expect((await post(token, app.id, { status: "SENT", reason: 5 })).status).toBe(400);
    const direct = await post(token, app.id, { status: "REJECTED" });
    expect(direct.status).toBe(400);
    expect((await json(direct)).error?.message).toMatch(/set it directly/);
    expect((await post(token, "missing", { status: "SENT" })).status).toBe(404);
    const waiting = await prisma().application.create({ data: { title: "Waiting", awaitingReview: true } });
    expect((await post(token, waiting.id, { status: "SENT" })).status).toBe(409);
  });

  it("cannot be used to move an application: the status route still refuses progress", async () => {
    const token = await write();
    const app = await prisma().application.create({ data: { title: "A" } });
    await post(token, app.id, { status: "SENT" });
    const { PATCH } = await import("./applications/[id]/status/route");
    const refused = await PATCH(new Request(`http://localhost/api/v1/applications/${app.id}/status`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ status: "SENT" }) }), ctx(app.id));
    expect(refused.status).toBe(403);
    expect((await json(refused)).error?.message).toMatch(/propose/i);
    expect((await prisma().application.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("DRAFT");
  });
});

describe("GET /api/v1/proposals", () => {
  it("shows what is waiting for the owner, to a read token, and nothing that was resolved", async () => {
    const token = await write();
    const a = await prisma().application.create({ data: { title: "Alpha" } });
    const b = await prisma().application.create({ data: { title: "Beta" } });
    await post(token, a.id, { status: "SENT", reason: "first" });
    const second = await json(await post(token, b.id, { status: "INTERVIEW", reason: "second" }));
    await prisma().statusProposal.update({ where: { id: second.data.id }, data: { state: "DISMISSED" } });

    expect((await list(null)).status).toBe(401);
    const { token: reader } = await createApiToken("viewer", "READ");
    const answer = await json(await list(reader));
    expect(answer.data.map((proposal: { application: { title: string } }) => proposal.application.title)).toEqual(["Alpha"]);
    expect(answer.data[0]).toMatchObject({ status: "SENT", reason: "first", state: "PENDING" });
  });
});
