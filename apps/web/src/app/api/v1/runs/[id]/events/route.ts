import { ApiScope } from "@/generated/prisma/enums";
import { optionalDetails, requiredString, runJson, withServiceErrors } from "@/lib/api-runs";
import { api, jsonBody } from "@/lib/api-v1";
import { prisma } from "@/lib/prisma";
import { addRunStep } from "@/lib/runs";

/**
 * POST /api/v1/runs/{id}/events { "summary": "Fetched Greenhouse", "data"?: { ... } }
 * adds a step to a running run. Keep the summary to one readable line and the
 * data to small counts and causes; never put secrets or whole documents in it.
 */
export const POST = (request: Request, { params }: RouteContext<"/api/v1/runs/[id]/events">) =>
  api(request, ApiScope.WRITE, async () => {
    const body = await jsonBody(request);
    const run = await withServiceErrors(async () =>
      addRunStep(prisma, (await params).id, { summary: requiredString(body, "summary"), data: optionalDetails(body) }),
    );
    return runJson(run);
  });
