// Ashby board source. Ported from career-ops (MIT, Santiago Fernández de
// Valderrama): upstream/career-ops/providers/ashby.mjs. Verdict:
// docs/sources/ashby.md.

import { MAX_DESCRIPTION } from "./html-text";
import { requestBoardJson, validSlug } from "./request";
import { BoardError, type BoardAdapter, type BoardPosting, type BoardRef, type BoardSalary } from "./types";

const API_HOST = "api.ashbyhq.com";
const BOARD_HOST = "jobs.ashbyhq.com";

// Ashby's public posting API answers slowly (about 10 s regardless of board size) and rate limits repeated unauthenticated calls:
// a long timeout, two retries with a growing wait, one request at a time.
const TIMEOUT_MS = 30_000;
const RETRIES = 2;
const BACKOFF_MS = 1_000;

function refFrom(input: string): BoardRef | null {
  const text = input.trim();
  if (validSlug(text)) return { slug: text };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const segments = url.pathname.split("/").filter(Boolean);
  let slug: string | undefined;
  if (url.hostname === BOARD_HOST) slug = segments[0];
  else if (url.hostname === API_HOST) slug = segments[0] === "posting-api" && segments[1] === "job-board" ? segments[2] : undefined;
  return slug && validSlug(slug) ? { slug } : null;
}

/** How many of each interval make a year. */
const PER_YEAR: Record<string, number> = {
  "1 HOUR": 2080,
  "1 DAY": 260,
  "1 WEEK": 52,
  "2 WEEK": 26,
  "0.5 MONTH": 24,
  "1 MONTH": 12,
  "2 MONTH": 6,
  "3 MONTH": 4,
  "6 MONTH": 2,
  "1 YEAR": 1,
};

type Component = { compensationType?: unknown; interval?: unknown; minValue?: unknown; maxValue?: unknown; currencyCode?: unknown; currency?: unknown };

const amount = (value: unknown): number | null => {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

/**
 * Annual pay, only from a real salary component with a readable interval; never inferred. Equity and bonus
 * components are ignored. Of several salary components the widest readable range is the role's band.
 * The older flat shape (min and max on `compensation` itself) is still read, yearly unless it says otherwise.
 */
export function parseCompensation(job: unknown): BoardSalary | null {
  const comp = (job as { compensation?: Record<string, unknown> } | null)?.compensation;
  if (!comp || typeof comp !== "object") return null;

  let source: Component = comp as Component;
  let nested = false;
  const tiers = Array.isArray(comp.compensationTiers) ? (comp.compensationTiers as { components?: unknown }[]) : [];
  const components = tiers.flatMap((tier) => (Array.isArray(tier?.components) ? (tier.components as Component[]) : []));
  if (components.length > 0) {
    const salaries = components.filter((component) => String(component?.compensationType ?? "").toLowerCase() === "salary");
    const readable = salaries.filter((component) => (amount(component?.minValue) != null || amount(component?.maxValue) != null) && typeof component.interval === "string" && Object.hasOwn(PER_YEAR, component.interval));
    if (readable.length === 0) return null;
    const width = (component: Component) => (amount(component.maxValue) ?? amount(component.minValue) ?? 0) - (amount(component.minValue) ?? amount(component.maxValue) ?? 0);
    source = readable.reduce((best, component) => (width(component) > width(best) ? component : best), readable[0]!);
    nested = true;
  }

  // A nested component states its own interval; one with none is not assumed yearly.
  const interval = nested ? source.interval : (source.interval || (comp as Component).interval || "1 YEAR");
  if (typeof interval !== "string" || !Object.hasOwn(PER_YEAR, interval)) return null;
  const perYear = PER_YEAR[interval]!;
  const min = amount(source.minValue ?? (comp as Component).minValue);
  const max = amount(source.maxValue ?? (comp as Component).maxValue);
  if (min == null && max == null) return null;
  const low = (min ?? max!) * perYear;
  const high = (max ?? min!) * perYear;
  const rawCurrency = source.currencyCode ?? source.currency ?? (comp as Component).currency;
  return { min: Math.min(low, high), max: Math.max(low, high), currency: typeof rawCurrency === "string" ? rawCurrency.trim().toUpperCase() : "" };
}

const containsWord = (text: string, word: string) => new RegExp(`(?<![\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu").test(text);

type Address = { address?: { postalAddress?: Record<string, unknown> } };

/** Every place a role is open: its own, its address, the secondary locations, and "Remote" where the work model says so (workplaceType wins over isRemote, which boards set for hybrid roles too). */
function locationOf(job: Record<string, unknown> & Address): string {
  const parts: string[] = [];
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  if (text(job.location)) parts.push(text(job.location));
  const postal = job.address?.postalAddress;
  if (postal) {
    for (const key of ["addressLocality", "addressCountry"]) {
      const value = text(postal[key]);
      if (!value) continue;
      if (key === "addressCountry" && parts.some((part) => containsWord(part, value))) continue;
      parts.push(value);
    }
  }
  if (Array.isArray(job.secondaryLocations)) {
    for (const secondary of job.secondaryLocations as (Record<string, unknown> & Address)[]) {
      if (!secondary || typeof secondary !== "object") continue;
      if (text(secondary.location)) parts.push(text(secondary.location));
      const address = secondary.address?.postalAddress;
      if (address) for (const key of ["addressLocality", "addressCountry"]) if (text(address[key])) parts.push(text(address[key]));
    }
  }
  const model = text(job.workplaceType).toLowerCase();
  const remote = model ? model === "remote" : job.isRemote === true;
  if (remote && !parts.some((part) => /remote/i.test(part))) parts.push("Remote");
  return [...new Set(parts)].join(" · ");
}

function remoteOf(job: Record<string, unknown>): boolean | null {
  const model = typeof job.workplaceType === "string" ? job.workplaceType.trim().toLowerCase() : "";
  if (model) return model === "remote";
  return typeof job.isRemote === "boolean" ? job.isRemote : null;
}

const toIso = (value: unknown): string | null => {
  if (typeof value !== "string" || !value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

export function parseAshby(json: unknown, ref: BoardRef, company: string): BoardPosting[] {
  const jobs = (json as { jobs?: unknown } | null)?.jobs;
  if (!Array.isArray(jobs)) return [];
  return (jobs as (Record<string, unknown> & Address)[])
    .filter((job) => job && typeof job.jobUrl === "string" && job.jobUrl && typeof job.id === "string" && job.id.trim())
    .map((job) => ({
      source: "ASHBY" as const,
      externalId: `${ref.slug}:${(job.id as string).trim()}`,
      title: typeof job.title === "string" ? job.title : "",
      company,
      location: locationOf(job),
      remote: remoteOf(job),
      url: job.jobUrl as string,
      description: typeof job.descriptionPlain === "string" ? job.descriptionPlain.slice(0, MAX_DESCRIPTION) : "",
      postedAt: toIso(job.publishedAt),
      salary: parseCompensation(job),
    }));
}

export const ashby: BoardAdapter = {
  source: "ASHBY",
  name: "Ashby",
  hosts: [API_HOST],
  refFrom,
  async fetchBoard(ref, company, context = {}) {
    if (!validSlug(ref.slug)) throw new BoardError("bad-slug", "That is not an Ashby board name.");
    const json = await requestBoardJson(`https://${API_HOST}/posting-api/job-board/${encodeURIComponent(ref.slug)}?includeCompensation=true`, {
      hosts: [API_HOST],
      timeoutMs: TIMEOUT_MS,
      retries: RETRIES,
      backoffMs: BACKOFF_MS,
      maxBytes: 25 * 1024 * 1024,
      signal: context.signal,
      fetchImpl: context.fetchImpl,
      sleep: context.sleep,
    });
    return parseAshby(json, ref, company);
  },
};
