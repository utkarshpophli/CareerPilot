import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiToken } from "@/lib/api-tokens";
import { createTestClient, resetDatabase } from "@/test/db";

import { GET as read } from "./route";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
const prisma = () => db.client!;

beforeEach(() => resetDatabase(prisma()));
afterAll(() => prisma().$disconnect());

const get = async (id: string, token: string | null) =>
  read(new Request(`http://localhost/api/v1/applications/${id}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }), { params: Promise.resolve({ id }) } as never);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper reading JSON of several shapes
const json = async (response: Response) => (await response.json()) as { data?: any; error?: { code: string; message: string } };

describe("GET /api/v1/applications/{id}", () => {
  it("gives a read token the application with its documents as text, without contact details or private notes", async () => {
    const { token } = await createApiToken("reader", "READ");
    const app = await prisma().application.create({ data: { title: "Engineer", company: "Acme", postingText: "The posting." } });
    await prisma().note.create({ data: { applicationId: app.id, body: "my private note" } });
    await prisma().document.create({
      data: { applicationId: app.id, kind: "COVER_LETTER", units: [{ id: "sender", label: "Sender", text: "ada@example.com" }, { id: "p1", label: "Paragraph", text: "Hello." }] },
    });
    const answer = await json(await get(app.id, token));
    expect(answer.data).toMatchObject({ id: app.id, company: "Acme", posting: "The posting.", coverLetter: "## Paragraph\nHello.", status: "DRAFT" });
    expect(JSON.stringify(answer.data)).not.toContain("ada@example.com");
    expect(JSON.stringify(answer.data)).not.toContain("my private note");
  });

  it("404 for one that is missing or waiting for the owner's review, 401 without a token", async () => {
    const { token } = await createApiToken("reader", "READ");
    const waiting = await prisma().application.create({ data: { title: "Agent draft", awaitingReview: true } });
    expect((await get(waiting.id, token)).status).toBe(404);
    expect((await get("nope", token)).status).toBe(404);
    expect((await get(waiting.id, null)).status).toBe(401);
  });
});
