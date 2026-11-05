import { ApiScope } from "@/generated/prisma/enums";
import { eventJson, runJson } from "@/lib/api-runs";
import { api, ApiError } from "@/lib/api-v1";
import { prisma } from "@/lib/prisma";
import { getRun } from "@/lib/services/runs";

/** GET /api/v1/runs/{id}: a run with every step and event that belongs to it, oldest first. */
export const GET = (request: Request, { params }: RouteContext<"/api/v1/runs/[id]">) =>
  api(request, ApiScope.READ, async () => {
    const run = await getRun(prisma, (await params).id);
    if (!run) throw new ApiError(404, "not_found", "No such run.");
    const { events, ...rest } = run;
    return { ...runJson(rest), events: events.map(eventJson) };
  });
