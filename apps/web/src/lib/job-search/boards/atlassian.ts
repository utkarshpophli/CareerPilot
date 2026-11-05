// Atlassian's own careers board. Ported from career-ops (MIT, Santiago Fernández de
// Valderrama): upstream/career-ops/providers/atlassian.mjs. Verdict:
// docs/sources/atlassian.md. One employer, one fixed address, the JSON its careers page uses.

import { htmlToText, MAX_DESCRIPTION } from "./html-text";
import { requestBoardJson } from "./request";
import { BoardError, type BoardAdapter, type BoardPosting, type BoardRef } from "./types";

const HOST = "www.atlassian.com";
const LISTINGS = `https://${HOST}/endpoint/careers/listings`;
/** The only board this source has. */
const SLUG = "atlassian";

function refFrom(input: string): BoardRef | null {
  const text = input.trim();
  if (text.toLowerCase() === SLUG) return { slug: SLUG };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.hostname !== HOST) return null;
  return url.pathname.startsWith("/company/careers") || url.pathname.startsWith("/endpoint/careers") ? { slug: SLUG } : null;
}

type RawListing = {
  id?: unknown;
  title?: unknown;
  locations?: unknown;
  overview?: unknown;
  responsibilities?: unknown;
  qualifications?: unknown;
  compensation?: unknown;
  applyUrl?: unknown;
  portalJobPost?: { portalUrl?: unknown } | null;
};

/** "Manila - Philippines -   Manila,  1634 Philippines" as "Manila, Philippines"; "Remote - India - Remote" as "Remote, India"; "Remote - Remote" as "Remote". */
function placeOf(raw: string): string {
  const parts = raw.split(" - ").map((part) => part.trim()).filter(Boolean);
  const [first, second] = parts;
  if (!first) return "";
  if (parts.length === 1 || !second || second.toLowerCase() === first.toLowerCase()) return first;
  return `${first}, ${second}`;
}

const https = (value: unknown): string => (typeof value === "string" && /^https:\/\//i.test(value.trim()) ? value.trim() : "");

export function parseAtlassian(json: unknown, ref: BoardRef, company: string): BoardPosting[] {
  if (!Array.isArray(json)) return [];
  const postings: BoardPosting[] = [];
  for (const listing of json as RawListing[]) {
    const id = typeof listing?.id === "number" || typeof listing?.id === "string" ? String(listing.id).trim() : "";
    // The posting's page, else the apply address without the form (`mode=apply`).
    const page = https(listing?.portalJobPost?.portalUrl) || https(listing?.applyUrl).replace(/\?mode=apply$/, "");
    if (!id || !page) continue;
    const places = [...new Set((Array.isArray(listing.locations) ? (listing.locations as unknown[]) : []).filter((place): place is string => typeof place === "string").map(placeOf).filter(Boolean))];
    postings.push({
      source: "ATLASSIAN",
      externalId: `${ref.slug}:${id}`,
      title: typeof listing.title === "string" ? listing.title.trim() : "",
      company,
      location: places.join("; "),
      // Remote is a yes only when every place says so; "Sydney or remote" is neither.
      remote: places.length > 0 && places.every((place) => place === "Remote" || place.startsWith("Remote,")) ? true : null,
      url: page,
      // The pay statement stays text: it is prose about a range, never a figure we could rely on.
      description: [listing.overview, listing.responsibilities, listing.qualifications, listing.compensation].map((part) => htmlToText(part, { cap: MAX_DESCRIPTION })).filter(Boolean).join("\n\n").slice(0, MAX_DESCRIPTION),
      postedAt: null,
      salary: null,
    });
  }
  return postings;
}

export const atlassian: BoardAdapter = {
  source: "ATLASSIAN",
  name: "Atlassian",
  hosts: [HOST],
  refFrom,
  async fetchBoard(ref, company, context = {}) {
    if (ref.slug !== SLUG) throw new BoardError("bad-slug", "Atlassian has one board; its name is “atlassian”.");
    const json = await requestBoardJson(LISTINGS, {
      hosts: [HOST],
      timeoutMs: 60_000,
      // The whole list is about 2.5 MB today.
      maxBytes: 25 * 1024 * 1024,
      retries: 1,
      signal: context.signal,
      fetchImpl: context.fetchImpl,
      sleep: context.sleep,
    });
    return parseAtlassian(json, ref, company);
  },
};
