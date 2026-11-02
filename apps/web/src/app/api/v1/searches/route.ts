import { z } from "zod";

import { ApiScope } from "@/generated/prisma/enums";
import { api, jsonBody, parseBody } from "@/lib/api-v1";
import { withServiceErrors } from "@/lib/api-runs";
import { POSTED_WITHIN, RADII_KM, type PostedWithin } from "@/lib/job-search/search";
import { prisma } from "@/lib/prisma";
import { loadProfile } from "@/lib/profile-data";
import { postingSummary, runJobSearch } from "@/lib/services/searches";

const POSTED = POSTED_WITHIN.map((option) => option.value) as [PostedWithin, ...PostedWithin[]];

const searchBody = z.object({
  keywords: z.string().trim().min(1).max(200),
  place: z.string().max(200).optional(),
  country: z.string().max(60).optional(),
  remoteOnly: z.boolean().optional(),
  radiusKm: z.literal(RADII_KM).optional(),
  postedWithin: z.enum(POSTED).optional(),
});

/**
 * POST /api/v1/searches { "keywords": "product designer", "place"?, "country"?, "remoteOnly"?, "radiusKm"?, "postedWithin"? }
 * runs a job search on the source chosen in Settings (the profile's city and
 * country unless told otherwise) and keeps it under Find jobs → Past searches.
 * Each search uses one search from the user's plan with that source.
 */
export const POST = (request: Request) =>
  api(request, ApiScope.WRITE, async () => {
    const input = parseBody(searchBody, await jsonBody(request));
    const { basics } = await loadProfile();
    const { query, search } = await withServiceErrors(() => runJobSearch(prisma, input, basics));
    return {
      id: search.id,
      searched: `${query.keywords} in ${query.place || query.country}${query.remoteOnly ? " (remote only)" : ""}`,
      found: search.postings.length,
      moreAvailable: search.next !== null,
      postings: search.postings.map((posting, index) => postingSummary(posting, index + 1)),
    };
  });
