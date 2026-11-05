import { ApiScope, RunStatus } from "@/generated/prisma/enums";
import { optionalString, requiredString, runJson, withServiceErrors } from "@/lib/api-runs";
import { api, ApiError, jsonBody } from "@/lib/api-v1";
import { prisma } from "@/lib/prisma";
import { finishRun } from "@/lib/services/runs";

const FINAL = [RunStatus.OK, RunStatus.FAILED, RunStatus.CANCELLED] as const;

/**
 * POST /api/v1/runs/{id}/finish { "status": "OK" | "FAILED" | "CANCELLED", "summary"?: "..." }
 * closes a run. Sending the same status again is harmless.
 */
export const POST = (request: Request, { params }: RouteContext<"/api/v1/runs/[id]/finish">) =>
  api(request, ApiScope.WRITE, async () => {
    const body = await jsonBody(request);
    const status = requiredString(body, "status");
    if (!FINAL.includes(status as (typeof FINAL)[number])) throw new ApiError(400, "bad_request", `status must be one of ${FINAL.join(", ")}.`);
    const run = await withServiceErrors(async () => finishRun(prisma, (await params).id, { status: status as RunStatus, summary: optionalString(body, "summary") }));
    return runJson(run);
  });
