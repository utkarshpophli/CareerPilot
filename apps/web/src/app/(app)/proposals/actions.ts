"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { action, ActionError } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { confirmProposal, dismissProposal } from "@/lib/proposals";
import { ServiceError } from "@/lib/service-error";
import { statusInfo } from "@/lib/status";

// The owner's side of the proposal queue: one click to confirm or dismiss what
// an assistant suggested. Only the signed-in owner gets here (action() checks
// the session), which is the whole point: assistants cannot call these.

const input = z.object({ id: z.string().min(1).max(64) });

/** A service's plain-language refusal becomes a message the user sees as it is. */
async function plain<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ServiceError) throw new ActionError(error.message);
    throw error;
  }
}

/** "Yes": moves the application. The answer's eventId is what Undo needs. */
export const confirmProposalAction = action(input, async ({ id }, { toast }) => {
  const confirmed = await plain(() => confirmProposal(prisma, id));
  revalidatePath("/", "layout");
  toast(statusInfo(confirmed.status).toast);
  return { applicationId: confirmed.applicationId, status: confirmed.status, eventId: confirmed.eventId };
});

/** "No": the proposal goes away and the application stays as it is. */
export const dismissProposalAction = action(input, async ({ id }) => {
  await plain(() => dismissProposal(prisma, id));
  revalidatePath("/", "layout");
  return null;
});
