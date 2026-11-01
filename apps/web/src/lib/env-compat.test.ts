import { describe, expect, it } from "vitest";

import { applyLegacyEnv } from "./env-compat";

// Audit C-25: settings are called CAREERPILOT_* now. A server that still uses the
// dossier names must keep working, with a nudge to rename.

describe("applyLegacyEnv", () => {
  it("copies an old DOSSIER_ name to the new name, and says which names to rename", () => {
    const env: Record<string, string | undefined> = { DOSSIER_PASSWORD: "hash", DOSSIER_SECRET: "s".repeat(40), OTHER: "x" };
    const renamed = applyLegacyEnv(env);
    expect(env.CAREERPILOT_PASSWORD).toBe("hash");
    expect(env.CAREERPILOT_SECRET).toBe("s".repeat(40));
    expect(renamed.sort()).toEqual(["DOSSIER_PASSWORD", "DOSSIER_SECRET"]);
  });

  it("never overrides a new name that is set; the new name wins", () => {
    const env: Record<string, string | undefined> = { DOSSIER_AI_MODEL: "old", CAREERPILOT_AI_MODEL: "new" };
    expect(applyLegacyEnv(env)).toEqual([]);
    expect(env.CAREERPILOT_AI_MODEL).toBe("new");
  });

  it("does nothing when no old names are present", () => {
    const env: Record<string, string | undefined> = { CAREERPILOT_PASSWORD: "hash", PATH: "/bin" };
    expect(applyLegacyEnv(env)).toEqual([]);
    expect(env).toEqual({ CAREERPILOT_PASSWORD: "hash", PATH: "/bin" });
  });

  it("ignores an old name that is set to nothing", () => {
    const env: Record<string, string | undefined> = { DOSSIER_AI_KEY: undefined };
    expect(applyLegacyEnv(env)).toEqual([]);
    expect(env.CAREERPILOT_AI_KEY).toBeUndefined();
  });

  it("keeps an empty old value as empty, as the app treats empty as unset", () => {
    const env: Record<string, string | undefined> = { DOSSIER_AI_KEY: "" };
    applyLegacyEnv(env);
    expect(env.CAREERPILOT_AI_KEY).toBe("");
  });
});
