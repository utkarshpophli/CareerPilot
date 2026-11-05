import { ApiScope } from "@/generated/prisma/enums";
import { api } from "@/lib/api-v1";
import { prisma } from "@/lib/prisma";
import { listPendingProposals } from "@/lib/services/applications";

/** GET /api/v1/proposals: what is waiting for the user to confirm or dismiss, newest first. */
export const GET = (request: Request) => api(request, ApiScope.READ, () => listPendingProposals(prisma));
