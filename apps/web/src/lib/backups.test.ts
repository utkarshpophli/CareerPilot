import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { backupsDir, writeBackup } from "./backups";

const dataDir = vi.hoisted(() => ({ path: "" }));
vi.mock("@/lib/env", () => ({ env: { get CAREERPILOT_DATA_DIR() { return dataDir.path; } } }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/data-export", () => ({ buildExport: async () => ({ applications: [], note: "stand-in" }) }));

beforeAll(async () => {
  dataDir.path = await mkdtemp(path.join(tmpdir(), "careerpilot-backups-"));
});
afterAll(() => rm(dataDir.path, { recursive: true, force: true }));

// Audit A-18: a backup holds the whole profile, every posting and the emails; other users of the machine must not read it.
// File modes mean nothing on Windows, so this is checked where they do (CI on Linux).
describe.skipIf(process.platform === "win32")("backup files are private to their owner", () => {
  it("writes the file readable and writable only by the owner, in a folder only the owner may enter", async () => {
    const name = await writeBackup("nightly", new Date(2026, 10, 1, 3, 0, 0));
    expect((await stat(path.join(backupsDir(), name))).mode & 0o777).toBe(0o600);
    expect((await stat(backupsDir())).mode & 0o777).toBe(0o700);
  });
});

describe("writeBackup", () => {
  it("writes the export as JSON under the backups folder and returns its name", async () => {
    const name = await writeBackup("before-import", new Date(2026, 10, 1, 12, 30, 0));
    expect(name).toBe("dossier-backup-before-import-2026-11-01-123000.json");
    expect((await stat(path.join(backupsDir(), name))).size).toBeGreaterThan(10);
  });
});
