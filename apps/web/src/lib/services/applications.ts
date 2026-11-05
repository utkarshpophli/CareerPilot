import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { ApplicationStatus, DocumentKind } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/action";
import { assertAgentMayMove } from "@/lib/agent-status-policy";
import { unitsSchema } from "@/lib/application-data";
import type { Duplicate } from "@/lib/duplicate-guard";
import { loadDuplicates } from "@/lib/duplicate-guard-data";
import { ACTIONS, recordActivity } from "@/lib/ledger";
import { withoutPrivateParts } from "@/lib/letter-frame";
import { platformFromUrl, platformOfApplication } from "@/lib/platform";
import { inspectPosting } from "@/lib/posting-check";
import { proposeStatus as propose } from "@/lib/proposals";
import { ServiceError } from "@/lib/service-error";
import { applyStatusChange } from "@/lib/status-changes";

import { reportAsRun } from "./runs";

// Applications as a service: what the REST API, the pilot CLI and the MCP
// tools all do with them, in one place and with no HTTP or MCP in sight. A
// door only parses its input, calls this, and formats the answer. Tracking
// writes a Draft and nothing else (no documents, nothing sent); the posting
// text goes through the posting guard first, like every other way a posting
// comes in.

export { listPendingProposals } from "@/lib/proposals";

const LIMITS = { company: 200, role: 200, title: 300, location: 200, url: 2000, text: 100_000 } as const;

export type TrackInput = {
  company?: string;
  role?: string;
  title?: string;
  location?: string;
  postingUrl?: string;
  postingText?: string;
};

export type TrackResult = {
  id: string;
  created: boolean;
  status: ApplicationStatus;
  /** Other applications that cover the same opening (same address is returned instead of made; same company, role and place is reported). */
  duplicates: Duplicate[];
};

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
async function track(db: PrismaClient, input: TrackInput): Promise<TrackResult> {
  const company = clean(input.company, LIMITS.company);
  const role = clean(input.role, LIMITS.role);
  if (!company && !role) throw new ServiceError("bad_request", "Send at least a company or a role.");
  const postingUrl = checkedUrl(clean(input.postingUrl, LIMITS.url));
  const title = clean(input.title, LIMITS.title) || [role, company].filter(Boolean).join(" · ");

  // The same posting address (tracking parameters, "www." and a trailing slash ignored) is the same application: a
  // retry or a second assistant gets the first one back. The same company, role and place on another board is made,
  // as a copy can be a different team's opening, and reported so the caller can tell the owner.
  const duplicates = await loadDuplicates(db, { company, role, location: clean(input.location, LIMITS.location), postingUrl });
  const sameAddress = duplicates.find((entry) => entry.relation === "same-url");
  if (sameAddress) return { id: sameAddress.id, created: false, status: sameAddress.status, duplicates: duplicates.filter((entry) => entry !== sameAddress) };

  let postingText = "";
  if (input.postingText !== undefined && input.postingText.trim()) {
    if (input.postingText.length > LIMITS.text) throw new ServiceError("bad_request", `A posting is at most ${LIMITS.text.toLocaleString("en")} characters.`);
    try {
      postingText = (await inspectPosting(input.postingText, "api", db)).text;
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
    return { id: application.id, created: true, status: application.status, duplicates };
  });
}

export type StatusMove = { id: string; status: ApplicationStatus; changed: boolean; eventId: string | null };

/**
 * Moves an application to `to` through the status machine; `eventId` is what
 * undoes the move. For assistants only: they may record DRAFT, REJECTED and
 * DECLINED, never progress (see agent-status-policy.ts).
 */
async function move(db: PrismaClient, id: string, to: ApplicationStatus): Promise<StatusMove> {
  await assertAgentMayMove(db, id, to);
  const result = await applyStatusChange(db, id, to);
  if (result.outcome === "not-found") throw new ServiceError("not_found", "No such application.");
  if (result.outcome === "changed") return { id, status: to, changed: true, eventId: result.event.id };
  const current = await db.application.findUniqueOrThrow({ where: { id }, select: { status: true } });
  return { id, status: current.status, changed: false, eventId: null };
}

export type ListOptions = {
  status?: ApplicationStatus;
  /** Archived applications are left out unless asked for. */
  includeArchived?: boolean;
  limit?: number;
  /** "created" is the order they were added in, "updated" the order they last changed in; newest first either way. */
  order?: "created" | "updated";
};

/**
 * The applications an assistant may see, newest first. A draft still waiting
 * for the owner's review on the Agent screen is never listed (#195).
 */
export async function listApplications(db: PrismaClient, { status, includeArchived = false, limit = 100, order = "created" }: ListOptions = {}) {
  const rows = await db.application.findMany({
    where: { awaitingReview: false, ...(status ? { status } : {}), ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: order === "updated" ? [{ updatedAt: "desc" }, { id: "desc" }] : [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(500, Math.max(1, limit)),
    select: { id: true, title: true, company: true, role: true, location: true, status: true, postingUrl: true, sentAt: true, createdAt: true, updatedAt: true, posting: { select: { source: true } } },
  });
  return rows.map(({ posting, ...row }) => ({ ...row, platform: platformOfApplication({ postingUrl: row.postingUrl, postingSource: posting?.source }) }));
}

/** One application with its posting, match and documents' parts; null when it is missing or waiting for the owner's review. */
export function readApplication(db: PrismaClient, id: string) {
  return db.application.findFirst({
    where: { id, awaitingReview: false },
    select: {
      id: true,
      title: true,
      company: true,
      role: true,
      location: true,
      mode: true,
      salary: true,
      status: true,
      postingUrl: true,
      postingText: true,
      match: true,
      documents: { select: { kind: true, units: true } },
    },
  });
}

/** Tracks an application as a Draft (see above). Reported as a run when an assistant does it. */
export const trackApplication = (db: PrismaClient, input: TrackInput): Promise<TrackResult> =>
  reportAsRun(
    db,
    { kind: "applications.track", title: `Track: ${[input.role, input.company].map((part) => part?.trim()).filter(Boolean).join(" at ") || "an application"}` },
    () => track(db, input),
    (result) => ({ summary: result.created ? "Tracked a new draft" : "Already tracked; nothing added", data: { created: result.created } }),
  );

/** Moves an application through the status machine (see above). Reported as a run when an assistant does it, including when it is refused. */
export const moveApplication = (db: PrismaClient, id: string, to: ApplicationStatus): Promise<StatusMove> =>
  reportAsRun(
    db,
    { kind: "applications.move", title: `Move to ${to}`, applicationId: id },
    () => move(db, id, to),
    (result) => ({ summary: result.changed ? `Now ${result.status}` : `Was already ${result.status}`, data: { changed: result.changed } }),
  );

/** Asks the owner to confirm a progress status; changes nothing itself. Reported as a run when an assistant does it. */
export const proposeStatus = (db: PrismaClient, input: Parameters<typeof propose>[1], ...rest: Parameters<typeof propose> extends [unknown, unknown, ...infer Rest] ? Rest : never) =>
  reportAsRun(
    db,
    { kind: "proposals.propose", title: `Propose ${input.status}`, applicationId: input.applicationId },
    () => propose(db, input, ...rest),
    () => ({ summary: `Proposed ${input.status}; it waits for the owner to confirm` }),
  );

/** The text of a tailored document's parts, in order, without the sender and signature (contact details). */
function documentText(units: unknown): string {
  const parsed = unitsSchema.safeParse(units);
  if (!parsed.success) return "";
  return withoutPrivateParts(parsed.data)
    .map((unit) => `## ${unit.label || unit.id}\n${unit.text}`)
    .join("\n\n");
}

/** What an assistant is told about an application: details, the posting (at most 20,000 characters), the match, and both documents as text. No private notes, no contact details. */
export function describeApplication(application: NonNullable<Awaited<ReturnType<typeof readApplication>>>) {
  const text = (kind: DocumentKind) => documentText(application.documents.find((document) => document.kind === kind)?.units);
  return {
    id: application.id,
    title: application.title,
    company: application.company,
    role: application.role,
    location: application.location,
    mode: application.mode,
    salary: application.salary,
    status: application.status,
    postingUrl: application.postingUrl,
    posting: application.postingText.slice(0, 20_000),
    match: application.match,
    resume: text(DocumentKind.RESUME),
    coverLetter: text(DocumentKind.COVER_LETTER),
  };
}
