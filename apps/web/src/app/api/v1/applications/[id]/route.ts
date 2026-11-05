import { ApiScope } from "@/generated/prisma/enums";
import { api, ApiError } from "@/lib/api-v1";
import { prisma } from "@/lib/prisma";
import { describeApplication, readApplication } from "@/lib/services/applications";

/**
 * GET /api/v1/applications/{id}: one application with its posting, match and
 * the resume and cover letter as text. Private notes and contact details are
 * never included, and a draft still waiting for the owner's review is not there.
 */
export const GET = (request: Request, { params }: RouteContext<"/api/v1/applications/[id]">) =>
  api(request, ApiScope.READ, async () => {
    const application = await readApplication(prisma, (await params).id);
    if (!application) throw new ApiError(404, "not_found", "No such application.");
    return describeApplication(application);
  });
