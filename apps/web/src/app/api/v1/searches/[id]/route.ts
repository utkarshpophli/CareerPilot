import { ApiScope } from "@/generated/prisma/enums";
import { api, ApiError } from "@/lib/api-v1";
import { postingSummary, readSearch } from "@/lib/services/searches";

/** GET /api/v1/searches/{id}: a kept search with its numbered postings. Uses no searches from the plan. */
export const GET = (request: Request, { params }: RouteContext<"/api/v1/searches/[id]">) =>
  api(request, ApiScope.READ, async () => {
    const search = await readSearch((await params).id);
    if (!search) throw new ApiError(404, "not_found", "That search is no longer kept.");
    return {
      id: search.id,
      found: search.postings.length,
      moreAvailable: search.next !== null,
      postings: search.postings.map((posting, index) => postingSummary(posting, index + 1)),
    };
  });
