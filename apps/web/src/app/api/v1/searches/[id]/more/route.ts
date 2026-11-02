import { ApiScope } from "@/generated/prisma/enums";
import { withServiceErrors } from "@/lib/api-runs";
import { api, ApiError } from "@/lib/api-v1";
import { prisma } from "@/lib/prisma";
import { moreJobs, postingSummary } from "@/lib/services/searches";

/** POST /api/v1/searches/{id}/more: the next page of a kept search, added to it. Uses one more search from the user's plan. */
export const POST = (request: Request, { params }: RouteContext<"/api/v1/searches/[id]/more">) =>
  api(request, ApiScope.WRITE, async () => {
    const id = (await params).id;
    const before = await prisma.postingSearch.findUnique({ where: { id }, select: { found: true } });
    if (!before) throw new ApiError(404, "not_found", "That search is no longer kept.");
    const more = await withServiceErrors(() => moreJobs(prisma, id));
    return { id, added: more.postings.length, moreAvailable: more.next !== null, postings: more.postings.map((posting, index) => postingSummary(posting, before.found + index + 1)) };
  });
