import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { describeApplication, listApplications, readApplication } from "./applications";

const db = createTestClient();
beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T09:00:00Z`);

async function seed() {
  const newest = await db.application.create({ data: { title: "Newest", company: "Acme", status: "SENT", createdAt: at(3), updatedAt: at(4) } });
  const oldest = await db.application.create({ data: { title: "Oldest", company: "Beta", createdAt: at(1), updatedAt: at(9) } });
  const archived = await db.application.create({ data: { title: "Archived", company: "Gamma", createdAt: at(2), updatedAt: at(2), archivedAt: at(5) } });
  const waiting = await db.application.create({ data: { title: "Awaiting review", company: "Delta", awaitingReview: true, createdAt: at(6) } });
  return { newest, oldest, archived, waiting };
}

describe("listApplications", () => {
  it("never lists a draft still waiting for the owner's review, whichever door asks", async () => {
    const { waiting } = await seed();
    const rows = await listApplications(db, { includeArchived: true });
    expect(rows.map((row) => row.id)).not.toContain(waiting.id);
  });

  it("leaves archived applications out unless asked, and filters by status", async () => {
    const { newest, oldest, archived } = await seed();
    expect((await listApplications(db, {})).map((row) => row.id).sort()).toEqual([newest.id, oldest.id].sort());
    expect((await listApplications(db, { includeArchived: true })).map((row) => row.id)).toContain(archived.id);
    expect((await listApplications(db, { status: "SENT" })).map((row) => row.id)).toEqual([newest.id]);
  });

  it("orders by creation or by last change, newest first, and keeps within the limit", async () => {
    const { newest, oldest } = await seed();
    expect((await listApplications(db, { order: "created" })).map((row) => row.id)).toEqual([newest.id, oldest.id]);
    expect((await listApplications(db, { order: "updated" })).map((row) => row.id)).toEqual([oldest.id, newest.id]);
    expect(await listApplications(db, { limit: 1 })).toHaveLength(1);
  });

  it("names the platform the posting came from", async () => {
    await db.application.create({ data: { title: "On a board", company: "Acme", postingUrl: "https://www.linkedin.com/jobs/view/1" } });
    const [row] = await listApplications(db, {});
    expect(row!.platform).toBe("linkedin");
  });
});

describe("readApplication", () => {
  it("gives the application with its documents' units, and nothing for one waiting for review or missing", async () => {
    const { newest, waiting } = await seed();
    await db.document.create({ data: { applicationId: newest.id, kind: "RESUME", units: [] } });
    const read = await readApplication(db, newest.id);
    expect(read).toMatchObject({ id: newest.id, company: "Acme" });
    expect(read!.documents).toHaveLength(1);
    expect(await readApplication(db, waiting.id)).toBeNull();
    expect(await readApplication(db, "nope")).toBeNull();
  });
});

describe("describeApplication", () => {
  it("gives the documents as text, without the sender's and signature's contact details", async () => {
    const { newest } = await seed();
    await db.application.update({ where: { id: newest.id }, data: { postingText: "x".repeat(25_000), postingUrl: "https://example.com/j" } });
    await db.document.create({
      data: {
        applicationId: newest.id,
        kind: "COVER_LETTER",
        units: [
          { id: "sender", label: "Sender", text: "Ada Lovelace\nada@example.com\n+49 170 0000000" },
          { id: "p1", label: "Paragraph 1", text: "I build design systems." },
          { id: "signature", label: "Signature", text: "Ada Lovelace" },
        ],
      },
    });
    await db.document.create({ data: { applicationId: newest.id, kind: "RESUME", units: [{ id: "summary", label: "Summary", text: "Designer." }] } });

    const view = describeApplication((await readApplication(db, newest.id))!);
    expect(view).toMatchObject({ id: newest.id, company: "Acme", status: "SENT", postingUrl: "https://example.com/j", resume: "## Summary\nDesigner.", coverLetter: "## Paragraph 1\nI build design systems." });
    expect(view.posting).toHaveLength(20_000);
    expect(JSON.stringify(view)).not.toContain("ada@example.com");
    expect(JSON.stringify(view)).not.toContain("+49");
  });

  it("says nothing for a document that does not exist or has parts it cannot read", async () => {
    const { oldest } = await seed();
    await db.document.create({ data: { applicationId: oldest.id, kind: "RESUME", units: "not units" } });
    expect(describeApplication((await readApplication(db, oldest.id))!)).toMatchObject({ resume: "", coverLetter: "" });
  });
});
