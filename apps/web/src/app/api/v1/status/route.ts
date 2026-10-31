import { ApiScope } from "@/generated/prisma/enums";
import { api } from "@/lib/api-v1";
import { prisma } from "@/lib/prisma";
import { appVersion } from "@/lib/version";

/** GET /api/v1/status: that the token works, which version this is, and how much there is. */
export const GET = (request: Request) =>
  api(request, ApiScope.READ, async (principal) => ({
    version: appVersion,
    token: { name: principal.name, scope: principal.scope },
    applications: await prisma.application.count({ where: { awaitingReview: false } }),
    activityEvents: await prisma.activityEvent.count(),
  }));
