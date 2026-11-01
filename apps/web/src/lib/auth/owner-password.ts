import "server-only";

import { loginMessages } from "@/app/login/messages";
import { ActionError } from "@/lib/action";
import { createLoginLock, LockBusy } from "@/lib/auth/login-lock";
import { globalPressure, loginWaitMs, recordLoginFailure, recordLoginSuccess } from "@/lib/auth/login-throttle";
import { passwordMatches } from "@/lib/auth/session";
import { GLOBAL_SLOWDOWN_MS, tooManyAttemptsMessage } from "@/lib/auth/throttle";
import { prisma } from "@/lib/prisma";

// Checking the owner's password, for everything that asks for it: signing in
// and making an API token. One code path, so the throttle cannot be dodged by
// choosing the other door (audit A-03, A-20).

/** Password checks waiting behind each other; more than this are turned away at once. */
const MAX_WAITING_CHECKS = 20;
const BUSY_RETRY_MS = 5_000;
const passwordChecks = createLoginLock({ maxQueued: MAX_WAITING_CHECKS });
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Resolves when `password` is the owner's; throws an ActionError saying why not
 * otherwise (empty, wrong, or too many attempts from this IP). Checks run one at
 * a time with the IP's block tested again inside the queue (A-03). Failures from
 * many IPs at once slow every check down; they never refuse the right password (A-02).
 */
export async function checkOwnerPassword(password: string, ip: string): Promise<void> {
  if (!password) throw new ActionError(loginMessages.empty);
  try {
    await passwordChecks.run(async () => {
      const wait = await loginWaitMs(prisma, ip);
      if (wait > 0) throw new ActionError(tooManyAttemptsMessage(wait));
      if (await globalPressure(prisma)) await pause(GLOBAL_SLOWDOWN_MS);
      if (!(await passwordMatches(password))) {
        await recordLoginFailure(prisma, ip);
        throw new ActionError(loginMessages.wrong);
      }
      await recordLoginSuccess(prisma, ip);
    });
  } catch (error) {
    if (error instanceof LockBusy) throw new ActionError(tooManyAttemptsMessage(BUSY_RETRY_MS));
    throw error;
  }
}
