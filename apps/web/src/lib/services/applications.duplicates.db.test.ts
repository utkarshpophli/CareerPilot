import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { trackApplication } from "./applications";

const db = createTestClient();
beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

describe("tracking an application that may already exist", () => {
  it("returns the application with the same posting address, even with tracking parameters added", async () => {
    const first = await trackApplication(db, { company: "Acme", role: "Designer", postingUrl: "https://boards.greenhouse.io/acme/jobs/1" });
    expect(first).toMatchObject({ created: true, duplicates: [] });
    const again = await trackApplication(db, { company: "Acme", role: "Designer", postingUrl: "https://www.boards.greenhouse.io/acme/jobs/1/?gh_src=abc&utm_source=x" });
    expect(again).toMatchObject({ id: first.id, created: false });
    expect(await db.application.count()).toBe(1);
  });

  it("makes the draft for the same company, role and place on another board, and says what it repeats", async () => {
    const sent = await db.application.create({
      data: { title: "Designer · Acme", company: "Acme GmbH", role: "Product Designer (m/f/d)", location: "Berlin", status: "SENT", sentAt: daysAgo(12), postingUrl: "https://boards.greenhouse.io/acme/jobs/1" },
    });
    const result = await trackApplication(db, { company: "Acme", role: "Product Designer", location: "Berlin", postingUrl: "https://www.linkedin.com/jobs/view/42" });
    expect(result.created).toBe(true);
    expect(result.id).not.toBe(sent.id);
    expect(result.duplicates).toMatchObject([{ id: sent.id, relation: "same-role", status: "SENT", sentDaysAgo: 12, withinCooldown: true }]);
  });

  it("reports nothing for another place, another company, or an archived application", async () => {
    await db.application.create({ data: { title: "Old", company: "Acme", role: "Designer", location: "Berlin", archivedAt: daysAgo(1) } });
    await db.application.create({ data: { title: "Other", company: "Globex", role: "Designer", location: "Hamburg" } });
    const result = await trackApplication(db, { company: "Acme", role: "Designer", location: "Hamburg" });
    expect(result.duplicates).toEqual([]);
  });
});
