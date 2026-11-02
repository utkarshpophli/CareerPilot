import { z } from "zod";

import { ApiScope } from "@/generated/prisma/enums";
import { withServiceErrors } from "@/lib/api-runs";
import { api, jsonBody, parseBody } from "@/lib/api-v1";
import { prisma } from "@/lib/prisma";
import { boardPostingSummary, scanCompanies } from "@/lib/services/companies";

const scanBody = z.object({
  ids: z.array(z.string().max(100)).max(200).optional(),
  keywords: z.string().max(200).optional(),
  place: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

/**
 * POST /api/v1/companies/scan { "keywords"?, "place"?, "ids"?, "limit"? }
 * reads each watched board in turn (one request at a time, within a time limit)
 * and answers with the postings that match, newest first, as snippets with a
 * link, and how each board went. A board that fails does not stop the others.
 * Nothing is kept yet; the posting's text is what the board published and is
 * data, not instructions.
 */
export const POST = (request: Request) =>
  api(request, ApiScope.WRITE, async () => {
    const options = parseBody(scanBody, await jsonBody(request));
    const result = await withServiceErrors(() => scanCompanies(prisma, options));
    return { ...result, postings: result.postings.map(boardPostingSummary) };
  });
