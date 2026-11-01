"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ActionError, publicAction } from "@/lib/action";
import { clientIp } from "@/lib/auth/client-ip";
import { createLoginLock, LockBusy } from "@/lib/auth/login-lock";
import { globalPressure, loginWaitMs, recordLoginFailure, recordLoginSuccess } from "@/lib/auth/login-throttle";
import { safeNextPath } from "@/lib/auth/next-path";
import { passwordMatches, startSession } from "@/lib/auth/session";
import { GLOBAL_SLOWDOWN_MS, tooManyAttemptsMessage } from "@/lib/auth/throttle";
import { prisma } from "@/lib/prisma";
import { loadProfileName } from "@/lib/profile-data";

import { loginMessages } from "./messages";

const MAX_PASSWORD_LENGTH = 256;
/** Password checks waiting behind each other; more than this are turned away at once. */
const MAX_WAITING_CHECKS = 20;
const BUSY_RETRY_MS = 5_000;
const passwordChecks = createLoginLock({ maxQueued: MAX_WAITING_CHECKS });
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Signs in with the password that CAREERPILOT_PASSWORD is a hash of (PRD AUTH-1, AUTH-4).
 * Failed attempts are rate-limited per IP and globally (AUTH-5). Returns
 * where to go next: the requested page if it's on this site, or the dashboard.
 */
export const signIn = publicAction(
  z.object({
    // A password of a few hundred characters is plenty; more only costs the server time hashing it (audit A-03).
    password: z.string().max(MAX_PASSWORD_LENGTH),
    remember: z.boolean(),
    next: z.string().optional(),
  }),
  async ({ password, remember, next }, { toast }) => {
    const ip = clientIp(await headers());
    if (!password) throw new ActionError(loginMessages.empty);

    // One check at a time, with the block tested again inside the queue (audit A-03).
    try {
      await passwordChecks.run(async () => {
        const wait = await loginWaitMs(prisma, ip);
        if (wait > 0) throw new ActionError(tooManyAttemptsMessage(wait));
        // Failures from many IPs at once slow every check down; they never refuse the right password (audit A-02).
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

    await startSession({ persistent: remember });
    const firstName = (await loadProfileName()).trim().split(/\s+/)[0] || "there";
    toast(`Welcome back, ${firstName}.`);
    return { redirectTo: safeNextPath(next) };
  },
);

/** What the sign-in form shows after a submit that `signInWithForm` handled. */
export type SignInFormState = { error: string } | null;

/**
 * `signIn` for the form's own submit, which the browser makes before the
 * page's scripts have run or when they're off (#187). It posts, so the
 * password never ends up in the URL. Goes on to the next page, or returns the
 * error for the page to show. There's no welcome toast this way.
 */
export async function signInWithForm(_previous: SignInFormState, form: FormData): Promise<SignInFormState> {
  const result = await signIn({
    password: text(form, "password"),
    remember: form.get("remember") === "on",
    next: text(form, "next") || undefined,
  });
  if (!result.ok) return { error: result.error };
  redirect(result.data.redirectTo);
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
