import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/action";
import { assertAgentMayMove } from "@/lib/agent-status-policy";
import { ACTIONS, recordActivity } from "@/lib/ledger";
import { platformFromUrl } from "@/lib/platform";
import { inspectPosting } from "@/lib/posting-check";
import { ServiceError } from "@/lib/service-error";
import { applyStatusChange } from "@/lib/status-changes";

// Tracking an application from outside the dashboard (the REST API, the CLI,
// an agent): a Draft with what is known about the posting, and nothing else.
// It writes no documents and sends nothing; the posting text goes through the
// posting guard first, like every other way a posting comes in.

const LIMITS = { company: 200, role: 200, title: 300, location: 200, url: 2000, text: 100_000 } as const;

export type TrackInput = {
  company?: string;
  role?: string;
  title?: string;
  location?: string;
  postingUrl?: string;
  postingText?: string;
};

export type TrackResult = { id: string; created: boolean; status: ApplicationStatus };

const clean = (value: string | undefined, max: number) => (value ?? "").trim().slice(0, max);

/** A link the app may store: http or https only (never javascript:, data:, file:). */
function checkedUrl(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    // falls through
  }
  throw new ServiceError("bad_request", "postingUrl must be an http or https link.");
}

/**
 * Creates a Draft application, or returns the one already tracked for the same
 * posting link (so two agents, or a retry, never make two).
 */
export async function trackApplication(db: PrismaClient, input: TrackInput): Promise<TrackResult> {
  const company = clean(input.company, LIMITS.company);
  const role = clean(input.role, LIMITS.role);
  if (!company && !role) throw new ServiceError("bad_request", "Send at least a company or a role.");
  const postingUrl = checkedUrl(clean(input.postingUrl, LIMITS.url));
  const title = clean(input.title, LIMITS.title) || [role, company].filter(Boolean).join(" · ");

  if (postingUrl) {
    const existing = await db.application.findFirst({ where: { postingUrl }, select: { id: true, status: true }, orderBy: { createdAt: "asc" } });
    if (existing) return { id: existing.id, created: false, status: existing.status };
  }

  let postingText = "";
  if (input.postingText !== undefined && input.postingText.trim()) {
    if (input.postingText.length > LIMITS.text) throw new ServiceError("bad_request", `A posting is at most ${LIMITS.text.toLocaleString("en")} characters.`);
    try {
      postingText = (await inspectPosting(input.postingText, "api")).text;
    } catch (error) {
      if (error instanceof ActionError) throw new ServiceError("bad_request", error.message);
      throw error;
    }
  }

  return db.$transaction(async (tx) => {
    const application = await tx.application.create({
      data: { title, company, role, location: clean(input.location, LIMITS.location), postingUrl, postingText },
      select: { id: true, status: true },
    });
    await recordActivity(tx, {
      action: ACTIONS.applicationCreated,
      summary: `Created application: ${title}`,
      targetType: "application",
      targetId: application.id,
      applicationId: application.id,
      platform: platformFromUrl(postingUrl),
      data: { origin: "API" },
    });
    return { id: application.id, created: true, status: application.status };
  });
}

export type StatusMove = { id: string; status: ApplicationStatus; changed: boolean; eventId: string | null };

/**
 * Moves an application to `to` through the status machine; `eventId` is what
 * undoes the move. For assistants only: they may record DRAFT, REJECTED and
 * DECLINED, never progress (see agent-status-policy.ts).
 */
export async function moveApplication(db: PrismaClient, id: string, to: ApplicationStatus): Promise<StatusMove> {
  await assertAgentMayMove(db, id, to);
  const result = await applyStatusChange(db, id, to);
  if (result.outcome === "not-found") throw new ServiceError("not_found", "No such application.");
  if (result.outcome === "changed") return { id, status: to, changed: true, eventId: result.event.id };
  const current = await db.application.findUniqueOrThrow({ where: { id }, select: { status: true } });
  return { id, status: current.status, changed: false, eventId: null };
}
