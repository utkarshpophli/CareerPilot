import "server-only";

import { prisma } from "@/lib/prisma";

// "Sign out everywhere" (audit A-04). Session cookies are stateless, so the
// server cannot take one back. Instead every token carries the epoch it was
// made in, and getSession() accepts only tokens from the current epoch.
// Bumping the epoch makes every cookie ever handed out stale at once. It is a
// Setting row, kept by "Delete everything" and never exported or imported.

export const EPOCH_SETTING = "sessionEpoch";

/** How long a process trusts what it last read. Another process's bump is seen within this time; this process's own bump at once. */
const CACHE_MS = 10_000;

let cached: { value: number; at: number } | null = null;

const parse = (value: string | undefined) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
};

/** The epoch new sessions are made in and old ones are checked against. */
export async function currentEpoch(now: number = Date.now()): Promise<number> {
  if (cached && now - cached.at < CACHE_MS) return cached.value;
  try {
    const row = await prisma.setting.findUnique({ where: { key: EPOCH_SETTING } });
    cached = { value: parse(row?.value), at: now };
    return cached.value;
  } catch (error) {
    // The database is unreachable for a moment: keep judging by the last epoch seen, if there is one.
    if (cached) return cached.value;
    throw error;
  }
}

/** Moves to the next epoch, which signs out every device. Returns the new epoch. */
export async function bumpEpoch(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: EPOCH_SETTING } });
  const next = parse(row?.value) + 1;
  await prisma.setting.upsert({ where: { key: EPOCH_SETTING }, create: { key: EPOCH_SETTING, value: String(next) }, update: { value: String(next) } });
  cached = { value: next, at: Date.now() };
  return next;
}

/** For tests: drops the remembered epoch so the next read goes to the database. */
export function forgetEpochCache(): void {
  cached = null;
}
