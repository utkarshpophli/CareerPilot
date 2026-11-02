"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { action, ActionError } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/service-error";
import { setScannedState } from "@/lib/services/scanned-postings";

// The owner's side of the Review queue: keep a posting, set it aside, or put it back. Only the signed-in owner
// gets here (action() checks the session); assistants have no door for this, by design.

const TOAST = { SAVED: "Saved. You'll find it under Saved.", DISMISSED: "Dismissed. It won't come back in new scans.", NEW: "Back in your review list." } as const;

export const setPostingStateAction = action(
  z.object({ id: z.string().min(1).max(64), state: z.enum(["NEW", "SAVED", "DISMISSED"]) }),
  async ({ id, state }, { toast }) => {
    try {
      const result = await setScannedState(prisma, id, state);
      revalidatePath("/review");
      toast(TOAST[state]);
      return result;
    } catch (error) {
      if (error instanceof ServiceError) throw new ActionError(error.message);
      throw error;
    }
  },
);
