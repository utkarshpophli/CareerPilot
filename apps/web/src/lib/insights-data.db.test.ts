import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { loadInsights } from "./insights-data";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
const prisma = () => db.client!;

beforeEach(() => resetDatabase(prisma()));
afterAll(() => prisma().$disconnect());

const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n, 10));

describe("loadInsights", () => {
  it("times the first reply from the first move on from sent, not from a later one", async () => {
    const application = await prisma().application.create({
      data: { title: "Designer · Acme", company: "Acme", postingUrl: "https://jobs.lever.co/acme/1", status: "INTERVIEW", furthestStage: "INTERVIEW", sentAt: day(0) },
    });
    await prisma().statusEvent.createMany({
      data: [
        { applicationId: application.id, from: "DRAFT", to: "SENT", at: day(0) },
        { applicationId: application.id, from: "SENT", to: "SCREENING", at: day(3) },
        { applicationId: application.id, from: "SCREENING", to: "INTERVIEW", at: day(9) },
      ],
    });
    const { byPlatform, totals } = await loadInsights(day(20));
    expect(byPlatform.find((row) => row.key === "lever")).toMatchObject({ sent: 1, heardBack: 1, medianDaysToReply: 3, fewSent: true });
    expect(totals.medianDaysToReply).toBe(3);
  });

  it("does not count a rejection as a reply, and has no time while nothing replied", async () => {
    const application = await prisma().application.create({ data: { title: "Designer · Beta", company: "Beta", postingUrl: "https://jobs.lever.co/beta/1", status: "REJECTED", furthestStage: "SENT", sentAt: day(0) } });
    await prisma().statusEvent.createMany({
      data: [
        { applicationId: application.id, from: "DRAFT", to: "SENT", at: day(0) },
        { applicationId: application.id, from: "SENT", to: "REJECTED", at: day(2) },
      ],
    });
    expect((await loadInsights(day(20))).totals.medianDaysToReply).toBeNull();
  });
});
