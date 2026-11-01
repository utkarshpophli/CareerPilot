import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";

import { bumpEpoch, currentEpoch, forgetEpochCache } from "./session-epoch";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
const prisma = () => db.client!;

beforeEach(async () => {
  await resetDatabase(prisma());
  forgetEpochCache();
});
afterAll(() => prisma().$disconnect());

// Audit A-04: "sign out everywhere" has to be something the server can do. Every session
// token carries the epoch it was made in; bumping the epoch makes all of them stale.
describe("the session epoch", () => {
  it("starts at 0, and every bump is the next number, kept in the database", async () => {
    expect(await currentEpoch()).toBe(0);
    expect(await bumpEpoch()).toBe(1);
    expect(await bumpEpoch()).toBe(2);
    expect((await prisma().setting.findUniqueOrThrow({ where: { key: "sessionEpoch" } })).value).toBe("2");
  });

  it("is seen at once by the process that bumped it", async () => {
    expect(await currentEpoch()).toBe(0);
    await bumpEpoch();
    expect(await currentEpoch()).toBe(1);
  });

  it("is read from the database again after the cache is forgotten (another process bumped it)", async () => {
    expect(await currentEpoch()).toBe(0);
    await prisma().setting.create({ data: { key: "sessionEpoch", value: "7" } });
    expect(await currentEpoch()).toBe(0); // cached for a few seconds
    forgetEpochCache();
    expect(await currentEpoch()).toBe(7);
  });

  it("treats a damaged value as 0 rather than failing every request", async () => {
    await prisma().setting.create({ data: { key: "sessionEpoch", value: "not a number" } });
    expect(await currentEpoch()).toBe(0);
  });
});
