import { ApiScope, ApplicationStatus } from "@/generated/prisma/enums";
import { requiredString, withServiceErrors } from "@/lib/api-runs";
import { api, ApiError, jsonBody } from "@/lib/api-v1";
import { moveApplication } from "@/lib/application-track";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/v1/applications/{id}/status { "status": "SENT" }
 * moves an application through the same status machine as the dashboard. The
 * answer's eventId is what undoes the move. This records where an application
 * stands; it never sends anything.
 */
export const PATCH = (request: Request, { params }: RouteContext<"/api/v1/applications/[id]/status">) =>
  api(request, ApiScope.WRITE, async () => {
    const status = requiredString(await jsonBody(request), "status");
    if (!Object.hasOwn(ApplicationStatus, status)) throw new ApiError(400, "bad_request", `status must be one of ${Object.keys(ApplicationStatus).join(", ")}.`);
    return withServiceErrors(async () => moveApplication(prisma, (await params).id, status as ApplicationStatus));
  });
