// Recruitee board source. Ported from career-ops (MIT, Santiago Fernández de
// Valderrama): upstream/career-ops/providers/recruitee.mjs. Verdict:
// docs/sources/recruitee.md. Each company has its own host, {tenant}.recruitee.com.

import { htmlToText, MAX_DESCRIPTION } from "./html-text";
import { requestBoardJson, tenantHost } from "./request";
import { BoardError, type BoardAdapter, type BoardPosting, type BoardRef, type BoardSalary } from "./types";

const DOMAIN = "recruitee.com";
/** Subdomains that are Recruitee's own, not a company. */
const NOT_TENANTS = new Set(["www", "api", "app", "support", "help"]);

function refFrom(input: string): BoardRef | null {
  const text = input.trim();
  if (tenantHost(text, DOMAIN)) return { slug: text };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const match = /^([a-z0-9-]+)\.recruitee\.com$/.exec(url.hostname);
  return match && tenantHost(match[1], DOMAIN) && !NOT_TENANTS.has(match[1]) ? { slug: match[1] } : null;
}

type RawOffer = {
  id?: unknown;
  title?: unknown;
  careers_url?: unknown;
  location?: unknown;
  remote?: unknown;
  published_at?: unknown;
  description?: unknown;
  requirements?: unknown;
  salary?: unknown;
};

const PER_YEAR: Record<string, number> = { year: 1, month: 12, week: 52, day: 260, hour: 2080 };

/** Annual pay, only from a figure with a stated interval and currency; never inferred. */
function salaryOf(raw: unknown): BoardSalary | null {
  if (!raw || typeof raw !== "object") return null;
  const { min, max, period, currency } = raw as Record<string, unknown>;
  const times = typeof period === "string" ? PER_YEAR[period.toLowerCase()] : undefined;
  const low = Number(min);
  const high = Number(max);
  if (!times || typeof currency !== "string" || !/^[A-Za-z]{3}$/.test(currency)) return null;
  if (min == null || max == null || min === "" || max === "" || !Number.isFinite(low) || !Number.isFinite(high) || low < 0 || low > high) return null;
  return { min: Math.round(low * times), max: Math.round(high * times), currency: currency.toUpperCase() };
}

/** "2026-11-03 20:08:14 UTC" as an ISO time. */
function isoOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/, "$1T$2Z"));
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

export function parseRecruitee(json: unknown, ref: BoardRef, company: string): BoardPosting[] {
  const offers = (json as { offers?: unknown } | null)?.offers;
  if (!Array.isArray(offers)) return [];
  const postings: BoardPosting[] = [];
  for (const offer of offers as RawOffer[]) {
    const id = typeof offer?.id === "number" || typeof offer?.id === "string" ? String(offer.id).trim() : "";
    const link = typeof offer?.careers_url === "string" ? offer.careers_url.trim() : "";
    if (!id || !/^https:\/\//i.test(link)) continue;
    postings.push({
      source: "RECRUITEE",
      externalId: `${ref.slug}:${id}`,
      title: typeof offer.title === "string" ? offer.title.trim() : "",
      company,
      location: typeof offer.location === "string" ? offer.location.trim() : "",
      remote: typeof offer.remote === "boolean" ? offer.remote : null,
      url: link,
      description: [htmlToText(offer.description, { cap: MAX_DESCRIPTION }), htmlToText(offer.requirements, { cap: MAX_DESCRIPTION })].filter(Boolean).join("\n\n").slice(0, MAX_DESCRIPTION),
      postedAt: isoOf(offer.published_at),
      salary: salaryOf(offer.salary),
    });
  }
  return postings;
}

export const recruitee: BoardAdapter = {
  source: "RECRUITEE",
  name: "Recruitee",
  // Not a fixed list: one host per company, built only from a one-label tenant name.
  hosts: [`{tenant}.${DOMAIN}`],
  refFrom,
  async fetchBoard(ref, company, context = {}) {
    const host = tenantHost(ref.slug, DOMAIN);
    if (!host) throw new BoardError("bad-slug", "That is not a Recruitee board name.");
    const json = await requestBoardJson(`https://${host}/api/offers/`, {
      hosts: [host],
      timeoutMs: 30_000,
      maxBytes: 25 * 1024 * 1024,
      retries: 1,
      signal: context.signal,
      fetchImpl: context.fetchImpl,
      sleep: context.sleep,
    });
    return parseRecruitee(json, ref, company);
  },
};
