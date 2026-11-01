import "server-only";

import type { ActivityEvent, Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-v1";
import { toRunView } from "@/lib/runs-view";
import { ServiceError } from "@/lib/service-error";

// What the REST API says about runs: a stable JSON shape (not the table), and
// the run service's errors turned into HTTP answers.

/** A run as the API shows it: the same shape the dashboard uses. */
export const runJson = toRunView;

export const eventJson = (event: ActivityEvent) => ({
  id: event.id,
  at: event.at,
  action: event.action,
  actorKind: event.actorKind,
  actorName: event.actorName,
  outcome: event.outcome,
  summary: event.summary,
  data: event.data,
});

const STATUS_BY_CODE = { bad_request: 400, not_found: 404, conflict: 409 } as const;

/** Runs `work`; a problem a service reports in plain terms becomes the matching API error (400, 404 or 409). */
export async function withServiceErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ServiceError) throw new ApiError(STATUS_BY_CODE[error.code], error.code, error.message);
    throw error;
  }
}

/** An optional string field of a JSON body; anything else that is present is a 400. */
export function optionalString(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new ApiError(400, "bad_request", `${field} must be a string.`);
  return value;
}

export function requiredString(body: Record<string, unknown>, field: string): string {
  const value = optionalString(body, field);
  if (value === undefined || !value.trim()) throw new ApiError(400, "bad_request", `Send "${field}" as a non-empty string.`);
  return value;
}

/** Optional small structured details: a JSON object, never an array or a scalar. */
export function optionalDetails(body: Record<string, unknown>, field = "data"): Prisma.InputJsonObject | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "bad_request", `${field} must be a JSON object.`);
  return value as Prisma.InputJsonObject;
}
