import { ApiScope, RunStatus } from "@/generated/prisma/enums";
import { optionalString, requiredString, runJson, withServiceErrors } from "@/lib/api-runs";
import { api, ApiError, intParam, jsonBody } from "@/lib/api-v1";
import { prisma } from "@/lib/prisma";
import { listRuns, startRun } from "@/lib/runs";

/** GET /api/v1/runs?status=RUNNING&limit=50&before=<next>: runs, newest first. */
export const GET = (request: Request) =>
  api(request, ApiScope.READ, async () => {
    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    if (status !== null && !Object.hasOwn(RunStatus, status)) throw new ApiError(400, "bad_request", `status must be one of ${Object.keys(RunStatus).join(", ")}.`);
    const page = await listRuns(prisma, status ? { status: status as RunStatus } : {}, {
      limit: intParam(params.get("limit"), 50, 1, 200),
      before: params.get("before") ?? undefined,
    });
    const now = new Date();
    return { runs: page.runs.map((run) => runJson(run, now)), next: page.next };
  });

/**
 * POST /api/v1/runs { "kind": "scan", "title": "Daily scan", "applicationId"?: "..." }
 * opens a run so the dashboard can show the work while it happens. Send an
 * Idempotency-Key header to make a retry safe: the same key gives the same run.
 */
export const POST = (request: Request) =>
  api(request, ApiScope.WRITE, async () => {
    const body = await jsonBody(request);
    const run = await withServiceErrors(() =>
      startRun(prisma, {
        kind: requiredString(body, "kind"),
        title: requiredString(body, "title"),
        applicationId: optionalString(body, "applicationId"),
        idempotencyKey: request.headers.get("idempotency-key"),
      }),
    );
    return runJson(run);
  });
