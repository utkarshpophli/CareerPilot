// Workable board source. Ported from career-ops (MIT, Santiago Fernández de
// Valderrama): upstream/career-ops/providers/workable.mjs. Verdict:
// docs/sources/workable.md. Reads the public account widget only.

import { htmlToText, MAX_DESCRIPTION } from "./html-text";
import { requestBoardJson, validSlug } from "./request";
import { BoardError, type BoardAdapter, type BoardPosting, type BoardRef } from "./types";

const HOST = "apply.workable.com";

function refFrom(input: string): BoardRef | null {
  const text = input.trim();
  if (validSlug(text)) return { slug: text };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.hostname !== HOST) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  // /api/v1/widget/accounts/<slug>, or /<slug>[/j/<shortcode>]; /j/<shortcode> alone names no board.
  const slug = segments[0] === "api" ? (segments[3] === "accounts" ? segments[4] : undefined) : segments[0] === "j" ? undefined : segments[0];
  return slug && validSlug(slug) ? { slug } : null;
}

type RawLocation = { city?: unknown; region?: unknown; country?: unknown; hidden?: unknown };
type RawJob = {
  title?: unknown;
  shortcode?: unknown;
  url?: unknown;
  shortlink?: unknown;
  telecommuting?: unknown;
  published_on?: unknown;
  description?: unknown;
  city?: unknown;
  state?: unknown;
  country?: unknown;
  locations?: unknown;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** The places the employer shows. A location it marked hidden is left out, and a posting with only hidden ones has no place. */
function locationOf(job: RawJob): string {
  const place = (parts: unknown[]) => parts.map(text).filter(Boolean).join(", ");
  if (Array.isArray(job.locations) && job.locations.length > 0) {
    const shown = (job.locations as RawLocation[]).filter((location) => location && location.hidden !== true).map((location) => place([location.city, location.region, location.country]));
    return [...new Set(shown.filter(Boolean))].join("; ");
  }
  return place([job.city, job.state, job.country]);
}

const isoOf = (value: unknown): string | null => {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

export function parseWorkable(json: unknown, ref: BoardRef, company: string): BoardPosting[] {
  const jobs = (json as { jobs?: unknown } | null)?.jobs;
  if (!Array.isArray(jobs)) return [];
  const postings: BoardPosting[] = [];
  for (const job of jobs as RawJob[]) {
    const code = text(job?.shortcode);
    const link = text(job?.url) || text(job?.shortlink);
    if (!job || !code || !/^https:\/\//i.test(link)) continue;
    postings.push({
      source: "WORKABLE",
      externalId: `${ref.slug}:${code}`,
      title: text(job.title),
      company,
      location: locationOf(job),
      remote: typeof job.telecommuting === "boolean" ? job.telecommuting : null,
      url: link,
      description: htmlToText(job.description, { cap: MAX_DESCRIPTION }),
      postedAt: isoOf(job.published_on),
      salary: null,
    });
  }
  return postings;
}

export const workable: BoardAdapter = {
  source: "WORKABLE",
  name: "Workable",
  hosts: [HOST],
  refFrom,
  async fetchBoard(ref, company, context = {}) {
    if (!validSlug(ref.slug)) throw new BoardError("bad-slug", "That is not a Workable board name.");
    const json = await requestBoardJson(`https://${HOST}/api/v1/widget/accounts/${encodeURIComponent(ref.slug)}?details=true`, {
      hosts: [HOST],
      timeoutMs: 30_000,
      maxBytes: 25 * 1024 * 1024,
      retries: 1,
      signal: context.signal,
      fetchImpl: context.fetchImpl,
      sleep: context.sleep,
    });
    return parseWorkable(json, ref, company);
  },
};
