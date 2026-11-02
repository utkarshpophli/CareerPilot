import { ApiScope, ApplicationStatus } from "@/generated/prisma/enums";
import { optionalString, requiredString, withServiceErrors } from "@/lib/api-runs";
import { api, ApiError, jsonBody } from "@/lib/api-v1";
import { prisma } from "@/lib/prisma";
import { proposeStatus } from "@/lib/proposals";

/**
 * POST /api/v1/applications/{id}/proposals { "status": "SENT", "reason": "…" }
 * asks the user to confirm that an application reached a progress status
 * (SENT, SCREENING, INTERVIEW, OFFER, ACCEPTED). It changes nothing by itself:
 * the proposal waits on the dashboard for one click. DRAFT, REJECTED and
 * DECLINED are not proposed; set those directly.
 */
export const POST = (request: Request, { params }: RouteContext<"/api/v1/applications/[id]/proposals">) =>
  api(request, ApiScope.WRITE, async () => {
    const body = await jsonBody(request);
    const status = requiredString(body, "status");
    if (!Object.hasOwn(ApplicationStatus, status)) throw new ApiError(400, "bad_request", `status must be one of ${Object.keys(ApplicationStatus).join(", ")}.`);
    const reason = optionalString(body, "reason") ?? "";
    return withServiceErrors(async () => proposeStatus(prisma, { applicationId: (await params).id, status: status as ApplicationStatus, reason }));
  });
