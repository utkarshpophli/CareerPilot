import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { appVersion } from "@/lib/version";

import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: vi.fn(), workerHeartbeat: { findMany: vi.fn(async () => []) } } }));

describe("GET /api/health (E12-4)", () => {
  beforeEach(() => vi.useRealTimers());

  it("answers 200 with the version when the database answers", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }] as never);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", version: appVersion, db: "ok", worker: "none" });
  });

  it("says whether a worker is reporting, and stays ok without one", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }] as never);
    vi.mocked(prisma.workerHeartbeat.findMany).mockResolvedValueOnce([{ beatAt: new Date() }] as never);
    expect(await (await GET()).json()).toMatchObject({ status: "ok", worker: "ok" });
    vi.mocked(prisma.workerHeartbeat.findMany).mockResolvedValueOnce([{ beatAt: new Date(Date.now() - 10 * 60_000) }] as never);
    expect(await (await GET()).json()).toMatchObject({ status: "ok", worker: "stale" });
    // A database that has no worker table yet (migrations not applied) is not a failed check.
    vi.mocked(prisma.workerHeartbeat.findMany).mockRejectedValueOnce(new Error("relation does not exist") as never);
    expect(await (await GET()).json()).toMatchObject({ status: "ok", worker: "none" });
  });

  it("answers 503 when the database fails", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("connection refused") as never);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable", version: appVersion, db: "unreachable", worker: "none" });
  });

  it("answers 503 when the database doesn't answer in time", async () => {
    vi.useFakeTimers();
    vi.mocked(prisma.$queryRaw).mockReturnValue(new Promise(() => {}) as never);
    const pending = GET();
    await vi.advanceTimersByTimeAsync(3_000);
    expect((await pending).status).toBe(503);
  });
});
