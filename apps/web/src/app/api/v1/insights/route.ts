import { ApiScope } from "@/generated/prisma/enums";
import { api } from "@/lib/api-v1";
import { loadInsights } from "@/lib/insights-data";

/** GET /api/v1/insights: the figures shown on the Insights page. */
export const GET = (request: Request) => api(request, ApiScope.READ, () => loadInsights());
