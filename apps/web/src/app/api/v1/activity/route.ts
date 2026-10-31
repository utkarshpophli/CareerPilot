import { ActivityActor, ApiScope } from "@/generated/prisma/enums";
import { api, ApiError, intParam } from "@/lib/api-v1";
import { listActivity } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";

/** GET /api/v1/activity?actor=MCP&action=application.&before=<id>&limit=50: the ledger, newest first. */
export const GET = (request: Request) =>
  api(request, ApiScope.READ, async () => {
    const params = new URL(request.url).searchParams;
    const actor = params.get("actor");
    if (actor !== null && !Object.hasOwn(ActivityActor, actor)) throw new ApiError(400, "bad_request", `actor must be one of ${Object.keys(ActivityActor).join(", ")}.`);
    const action = params.get("action") ?? undefined;
    if (action !== undefined && !/^[a-z_.]{1,64}$/.test(action)) throw new ApiError(400, "bad_request", "action is a dotted name such as application.created, or a prefix ending in a dot.");
    const before = params.get("before") ?? undefined;
    if (before !== undefined && before.length > 64) throw new ApiError(400, "bad_request", "before is not a valid cursor.");
    const { events, next } = await listActivity(prisma, { ...(actor ? { actorKind: actor as ActivityActor } : {}), ...(action ? { action } : {}) }, { before, limit: intParam(params.get("limit"), 50, 1, 200) });
    return { events, next };
  });
