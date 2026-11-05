import { z } from "zod";

import { ApiScope } from "@/generated/prisma/enums";
import { withServiceErrors } from "@/lib/api-runs";
import { api, jsonBody, parseBody } from "@/lib/api-v1";
import { prisma } from "@/lib/prisma";
import { saveFitScores } from "@/lib/services/postings";

const scoresBody = z.object({
  searchId: z.string().max(100).optional(),
  scores: z
    .array(
      z.object({
        number: z.number().int().min(1).optional(),
        postingId: z.string().max(100).optional(),
        score: z.number().min(0).max(1000),
        reasons: z.array(z.string().max(300)).min(1).max(4),
        redFlags: z.array(z.string().max(300)).max(3).default([]),
      }),
    )
    .min(1)
    .max(50),
});

/**
 * POST /api/v1/postings/scores { "searchId"?, "scores": [{ "number" | "postingId", "score", "reasons", "redFlags"? }] }
 * keeps the fit scores an assistant worked out, so Find jobs shows each with
 * its reasons. Code decides nothing about the score except to keep it within
 * 0 to 100 and trim the reasons; the judgment is the caller's.
 */
export const POST = (request: Request) =>
  api(request, ApiScope.WRITE, async (principal) => {
    const { searchId, scores } = parseBody(scoresBody, await jsonBody(request));
    return withServiceErrors(() => saveFitScores(prisma, { searchId, scores, scoredWith: `api:${principal.name}` }));
  });
