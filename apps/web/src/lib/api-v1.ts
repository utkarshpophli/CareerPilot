import "server-only";

import type { z } from "zod";

import { ActivityActor, ApiScope } from "@/generated/prisma/enums";

import { allows, verifyApiToken, type TokenPrincipal } from "./api-tokens";
import { runAsActor } from "./ledger";
import { logServerError } from "./log";
import { createLimiter, type Limiter } from "./rate-limit";
import { BodyTooLarge, readLimitedText } from "./read-limited";

// The REST API, version 1: bearer-token auth, a scope check, the caller named
// in the Activity Ledger, and one JSON envelope for answers and errors:
// { "data": … } or { "error": { "code", "message" } }.

const NO_STORE = { "cache-control": "no-store" };

// Each token gets a burst of 100 requests and then 2 a second (120 a minute):
// plenty for an assistant reporting steps, far too little to flood the ledger
// (audit A-06). Requests with a missing or wrong token share a small allowance
// of their own, so guessing tokens is slow and cannot starve real clients.
// Kept on globalThis so a development reload does not reset the counts.
const limiters = globalThis as { __careerpilotApiLimiter?: Limiter; __careerpilotBadTokenLimiter?: Limiter };
const tokenLimiter = (limiters.__careerpilotApiLimiter ??= createLimiter({ capacity: 100, refillPerSecond: 2 }));
const badTokenLimiter = (limiters.__careerpilotBadTokenLimiter ??= createLimiter({ capacity: 30, refillPerSecond: 0.5 }));

const tooMany = (retryAfterSeconds: number) =>
  fail(429, "rate_limited", `Too many requests. Try again in ${retryAfterSeconds} seconds.`, { "retry-after": String(retryAfterSeconds) });

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
  if (!principal) {
    const verdict = badTokenLimiter.take("bad-token");
    if (!verdict.ok) return tooMany(verdict.retryAfterSeconds);
    return fail(401, "unauthorized", "Send a valid API token as 'Authorization: Bearer <token>'.", { "www-authenticate": 'Bearer realm="careerpilot"' });
  }
  const verdict = tokenLimiter.take(principal.id);
  if (!verdict.ok) return tooMany(verdict.retryAfterSeconds);
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

/** A JSON object from the request body; anything else is a 400, and a body over `maxBytes` a 413. */
export async function jsonBody(request: Request, maxBytes = 200_000): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await readLimitedText(request, maxBytes);
  } catch (error) {
    if (error instanceof BodyTooLarge) throw new ApiError(413, "too_large", "The request body is too large.");
    throw error;
  }
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

/** A request body checked against a schema; the first problem becomes a 400 that names the field. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0]!;
  const field = issue.path.join(".");
  throw new ApiError(400, "bad_request", field ? `${field}: ${issue.message}` : issue.message);
}
