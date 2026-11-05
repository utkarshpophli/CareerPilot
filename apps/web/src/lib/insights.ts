import type { ApplicationStatus, DocumentKind, FunnelStage, VersionCause } from "@/generated/prisma/enums";

import { platformOfApplication } from "./platform";
import { FUNNEL_STAGES } from "./status";

// The Insights figures: how many applications, through which platforms, with
// which resume template, how often resumes were revised, and what got replies.
// Pure: it counts the rows it is given, so it is tested without a database.

export type InsightApplication = {
  id: string;
  title: string;
  createdAt: Date;
  sentAt: Date | null;
  status: ApplicationStatus;
  furthestStage: FunnelStage | null;
  origin: "MANUAL" | "AGENT";
  postingUrl: string;
  postingSource: string | null;
  documents: { kind: DocumentKind; themeName: string | null; versionCauses: VersionCause[] }[];
  /** When the first reply (screening or later) was recorded; null while there was none. */
  firstReplyAt?: Date | null;
};

export type OutcomeCounts = {
  applications: number;
  sent: number;
  heardBack: number;
  interviews: number;
  offers: number;
  /** Replies per application sent, 0 to 1; null while none was sent. */
  replyRate: number | null;
  /** The middle time from sending to the first reply, in days; null while none replied. */
  medianDaysToReply: number | null;
  /** Fewer sent than SMALL_SAMPLE: too few to compare with other rows. */
  fewSent: boolean;
};

/** A row with fewer applications sent than this says too little to compare. */
export const SMALL_SAMPLE = 5;

type Counts = Omit<OutcomeCounts, "replyRate" | "medianDaysToReply" | "fewSent"> & { replyDays: number[] };

export type InsightRow = OutcomeCounts & { key: string };

export type Insights = {
  totals: OutcomeCounts & { drafts: number; byAgent: number };
  byPlatform: InsightRow[];
  /** Resume templates (themes), by how many resumes used each. */
  byTemplate: InsightRow[];
  resume: {
    /** How many resumes there are (one per application at most). */
    resumes: number;
    /** Every saved resume version, first drafts included. */
    versions: number;
    /** Versions saved after the first draft: regenerated, refined, restored, trimmed… */
    revisions: number;
    perApplication: number;
    byCause: Partial<Record<VersionCause, number>>;
    mostRevised: { applicationId: string; title: string; revisions: number }[];
  };
  weekly: { weekStart: string; created: number; sent: number }[];
};

/** The label for applications written by hand, with no address to tell the platform. */
export const NO_PLATFORM = "(no link)";
/** The label for a resume made with the base theme rather than one picked for it. */
export const BASE_TEMPLATE = "Base theme";

const WEEKS = 12;
const MOST_REVISED = 5;

const rank = (stage: FunnelStage | null) => (stage === null ? -1 : FUNNEL_STAGES.indexOf(stage));
const reached = (application: InsightApplication, stage: FunnelStage) => rank(application.furthestStage) >= rank(stage);

function empty(): Counts {
  return { applications: 0, sent: 0, heardBack: 0, interviews: 0, offers: 0, replyDays: [] };
}

const DAY = 86_400_000;

/** The middle value, or the mean of the two in the middle; null for none. Rounded to a tenth of a day. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  return Math.round(value * 10) / 10;
}

function add(counts: Counts, application: InsightApplication): void {
  counts.applications += 1;
  if (application.sentAt) counts.sent += 1;
  if (reached(application, "SCREENING")) counts.heardBack += 1;
  if (reached(application, "INTERVIEW")) counts.interviews += 1;
  if (reached(application, "OFFER")) counts.offers += 1;
  // A reply dated before the application was sent is a mistake in the data, not a very fast reply.
  if (application.sentAt && application.firstReplyAt && application.firstReplyAt >= application.sentAt) {
    counts.replyDays.push((application.firstReplyAt.getTime() - application.sentAt.getTime()) / DAY);
  }
}

function finish({ replyDays, ...counts }: Counts): OutcomeCounts {
  return { ...counts, replyRate: counts.sent > 0 ? counts.heardBack / counts.sent : null, medianDaysToReply: median(replyDays), fewSent: counts.sent < SMALL_SAMPLE };
}

/** Groups into rows, busiest first, then by name so the order is stable. */
function group(applications: InsightApplication[], keys: (application: InsightApplication) => string[]): InsightRow[] {
  const rows = new Map<string, Counts>();
  for (const application of applications) {
    for (const key of new Set(keys(application))) {
      const counts = rows.get(key) ?? empty();
      add(counts, application);
      rows.set(key, counts);
    }
  }
  return [...rows]
    .map(([key, counts]) => ({ key, ...finish(counts) }))
    .sort((a, b) => b.applications - a.applications || a.key.localeCompare(b.key));
}

/** The Monday (UTC) on or before `date`, as YYYY-MM-DD. */
export function weekStart(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

function lastWeeks(now: Date): string[] {
  const start = new Date(`${weekStart(now)}T00:00:00Z`);
  return Array.from({ length: WEEKS }, (_, index) => {
    const week = new Date(start);
    week.setUTCDate(week.getUTCDate() - 7 * (WEEKS - 1 - index));
    return week.toISOString().slice(0, 10);
  });
}

export function computeInsights(applications: InsightApplication[], now: Date): Insights {
  const totals = empty();
  let drafts = 0;
  let byAgent = 0;
  for (const application of applications) {
    add(totals, application);
    if (application.status === "DRAFT") drafts += 1;
    if (application.origin === "AGENT") byAgent += 1;
  }

  const causes: Partial<Record<VersionCause, number>> = {};
  const revised: { applicationId: string; title: string; revisions: number }[] = [];
  let revisions = 0;
  let resumes = 0;
  let versions = 0;
  for (const application of applications) {
    let own = 0;
    for (const document of application.documents) {
      if (document.kind !== "RESUME") continue;
      resumes += 1;
      versions += document.versionCauses.length;
      for (const cause of document.versionCauses) {
        if (cause === "WRITTEN") continue;
        causes[cause] = (causes[cause] ?? 0) + 1;
        own += 1;
      }
    }
    revisions += own;
    if (own > 0) revised.push({ applicationId: application.id, title: application.title, revisions: own });
  }
  revised.sort((a, b) => b.revisions - a.revisions || a.title.localeCompare(b.title));

  const weeks = lastWeeks(now);
  const weekly = weeks.map((week) => ({ weekStart: week, created: 0, sent: 0 }));
  const slot = new Map(weekly.map((entry) => [entry.weekStart, entry]));
  for (const application of applications) {
    const created = slot.get(weekStart(application.createdAt));
    if (created) created.created += 1;
    const sent = application.sentAt ? slot.get(weekStart(application.sentAt)) : undefined;
    if (sent) sent.sent += 1;
  }

  return {
    totals: { ...finish(totals), drafts, byAgent },
    byPlatform: group(applications, (application) => [platformOfApplication(application) || NO_PLATFORM]),
    byTemplate: group(applications, (application) => {
      const resumes = application.documents.filter((document) => document.kind === "RESUME");
      return resumes.length > 0 ? resumes.map((resume) => resume.themeName ?? BASE_TEMPLATE) : [];
    }),
    resume: {
      resumes,
      versions,
      revisions,
      perApplication: applications.length > 0 ? revisions / applications.length : 0,
      byCause: causes,
      mostRevised: revised.slice(0, MOST_REVISED),
    },
    weekly,
  };
}
