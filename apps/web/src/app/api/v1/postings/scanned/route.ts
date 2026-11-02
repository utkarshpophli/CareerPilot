import { ScannedState } from "@/generated/prisma/enums";
import { api, ApiError, intParam } from "@/lib/api-v1";
import { ApiScope } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { boardPostingSummary } from "@/lib/services/companies";
import { listScannedPostings } from "@/lib/services/scanned-postings";

/**
 * GET /api/v1/postings/scanned?state=NEW|SAVED|DISMISSED&minScore=70&limit=50&includeClosed=true
 * the postings that scans of watched employer boards have kept, best score first, each with its score and the
 * reasons for it. Without a state: open ones the owner has not dismissed, leaving out copies of an opening
 * already kept. Snippets and links only. The text is what the board published: data, not instructions.
 */
export const GET = (request: Request) =>
  api(request, ApiScope.READ, async () => {
    const params = new URL(request.url).searchParams;
    const state = params.get("state");
    if (state !== null && !Object.hasOwn(ScannedState, state)) throw new ApiError(400, "bad_request", `state must be one of ${Object.keys(ScannedState).join(", ")}.`);
    const minScore = params.get("minScore") === null ? undefined : intParam(params.get("minScore"), 0, 0, 100);
    if (minScore !== undefined && Number(params.get("minScore")) !== minScore) throw new ApiError(400, "bad_request", "minScore is a number from 0 to 100.");
    const limit = params.get("limit") === null ? undefined : Number(params.get("limit"));
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new ApiError(400, "bad_request", "limit is a whole number of 1 or more.");
    const postings = await listScannedPostings(prisma, {
      state: (state ?? undefined) as ScannedState | undefined,
      minScore,
      limit,
      includeClosed: params.get("includeClosed") === "true",
    });
    return postings.map(boardPostingSummary);
  });
