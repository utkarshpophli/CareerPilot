import { ApiScope, ApplicationStatus } from "@/generated/prisma/enums";
import { optionalString, withServiceErrors } from "@/lib/api-runs";
import { api, ApiError, intParam, jsonBody } from "@/lib/api-v1";
import { listApplications, trackApplication } from "@/lib/services/applications";
import { prisma } from "@/lib/prisma";

/** GET /api/v1/applications?status=SENT&limit=100: applications, newest first, without the posting text or documents. */
export const GET = (request: Request) =>
  api(request, ApiScope.READ, async () => {
    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    if (status !== null && !Object.hasOwn(ApplicationStatus, status)) throw new ApiError(400, "bad_request", `status must be one of ${Object.keys(ApplicationStatus).join(", ")}.`);
    // The API lists every application, archived ones included, newest first.
    return listApplications(prisma, { status: (status ?? undefined) as ApplicationStatus | undefined, limit: intParam(params.get("limit"), 100, 1, 500), includeArchived: true, order: "created" });
  });

/**
 * POST /api/v1/applications { "company"?, "role"?, "title"?, "location"?, "postingUrl"?, "postingText"? }
 * tracks an application as a Draft (at least a company or a role). A posting
 * link already tracked gives back that application with "created": false.
 * Posting text goes through the posting guard. Nothing is written or sent.
 */
export const POST = (request: Request) =>
  api(request, ApiScope.WRITE, async () => {
    const body = await jsonBody(request);
    return withServiceErrors(() =>
      trackApplication(prisma, {
        company: optionalString(body, "company"),
        role: optionalString(body, "role"),
        title: optionalString(body, "title"),
        location: optionalString(body, "location"),
        postingUrl: optionalString(body, "postingUrl"),
        postingText: optionalString(body, "postingText"),
      }),
    );
  });
