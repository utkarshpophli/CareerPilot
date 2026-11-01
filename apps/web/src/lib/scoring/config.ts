import "server-only";

import { env, type Env } from "@/lib/env";
import { decryptSecret, SecretUnreadable, TYPESAFE_KEY } from "@/lib/secrets";
import type { SettingsData } from "@/lib/settings";
import { loadSettings } from "@/lib/settings-data";

import { SCORING_KEY_MISSING, SCORING_KEY_UNREADABLE, type Scorer, type ScoringKeyState, type ScoringView } from "./scorers";

// What scores postings (#274): the choice saved in Settings → Scoring, or
// else CAREERPILOT_SCORER, or else the AI model; and Jev's key, saved there or
// in CAREERPILOT_TYPESAFE_KEY.

export type ScoringConfig = {
  scorer: Scorer;
  /** Whether the choice is saved in Settings, rather than coming from CAREERPILOT_SCORER or the default. */
  saved: boolean;
  key: string | null;
  keyState: ScoringKeyState;
};

const FROM_ENV: Record<NonNullable<Env["CAREERPILOT_SCORER"]>, Scorer> = { ai: "AI", jev: "JEV" };

export function resolveScoringConfig(
  saved: Pick<SettingsData, "scorer" | "typesafeKeyEnc">,
  source: Pick<Env, "CAREERPILOT_SCORER" | "CAREERPILOT_TYPESAFE_KEY">,
  secret?: string,
): ScoringConfig {
  const scorer = saved.scorer ?? (source.CAREERPILOT_SCORER ? FROM_ENV[source.CAREERPILOT_SCORER] : "AI");
  const choice = { scorer, saved: saved.scorer !== null };
  if (saved.typesafeKeyEnc) {
    try {
      return { ...choice, key: decryptSecret(TYPESAFE_KEY, saved.typesafeKeyEnc, secret), keyState: "set" };
    } catch (error) {
      if (!(error instanceof SecretUnreadable)) throw error;
      return { ...choice, key: null, keyState: "unreadable" };
    }
  }
  return source.CAREERPILOT_TYPESAFE_KEY ? { ...choice, key: source.CAREERPILOT_TYPESAFE_KEY, keyState: "env" } : { ...choice, key: null, keyState: "none" };
}

/** The scoring configuration in effect right now. */
export async function loadScoringConfig(): Promise<ScoringConfig> {
  return resolveScoringConfig(await loadSettings(), env);
}

export const scoringView = (config: ScoringConfig): ScoringView => ({ scorer: config.scorer, keyState: config.keyState });

/** Jev's key, or why there isn't one, in words. */
export function jevKey({ key, keyState }: Pick<ScoringConfig, "key" | "keyState">): { key: string; problem: null } | { key: null; problem: string } {
  if (key) return { key, problem: null };
  return { key: null, problem: keyState === "unreadable" ? SCORING_KEY_UNREADABLE : SCORING_KEY_MISSING };
}
