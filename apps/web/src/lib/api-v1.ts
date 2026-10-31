import "server-only";

import { ActivityActor, ApiScope } from "@/generated/prisma/enums";

import { allows, verifyApiToken, type TokenPrincipal } from "./api-tokens";
import { runAsActor } from "./ledger";
import { logServerError } from "./log";

// The REST API, version 1: bearer-token auth, a scope check, the caller named
// in the Activity Ledger, and one JSON envelope for answers and errors:
// { "data": … } or { "error": { "code", "message" } }.

const NO_STORE = { "cache-control": "no-store" };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const fail = (status: number, code: string, message: string, headers: Record<string, string> = {}) =>
  Response.json({ error: { code, message } }, { status, headers: { ...NO_STORE, ...headers } });

/** Runs `handler` for a caller with a valid token whose scope is enough. Anything it throws becomes an error answer. */
export async function api(request: Request, scope: ApiScope, handler: (principal: TokenPrincipal) => Promise<unknown>): Promise<Response> {
  const principal = await verifyApiToken(request.headers.get("authorization"));
  if (!principal) return fail(401, "unauthorized", "Send a valid API token as 'Authorization: Bearer <token>'.", { "www-authenticate": 'Bearer realm="careerpilot"' });
  if (!allows(principal, scope)) return fail(403, "forbidden", "This token is read-only.");
  try {
    const data = await runAsActor({ kind: ActivityActor.CLI, name: principal.name }, () => handler(principal));
    return Response.json({ data }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ApiError) return fail(error.status, error.code, error.message);
    logServerError(`API ${new URL(request.url).pathname}`, error);
    return fail(500, "server_error", "Something went wrong on the server.");
  }
}

/** A JSON object from the request body; anything else is a 400. */
export async function jsonBody(request: Request, maxBytes = 200_000): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > maxBytes) throw new ApiError(413, "too_large", "The request body is too large.");
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // falls through
  }
  throw new ApiError(400, "bad_request", "Send a JSON object.");
}

/** A whole number from a query string, kept within bounds. */
export function intParam(value: string | null, fallback: number, min: number, max: number): number {
  const number = value === null || value === "" ? fallback : Number(value);
  if (!Number.isInteger(number)) throw new ApiError(400, "bad_request", "A number was expected.");
  return Math.min(max, Math.max(min, number));
}
