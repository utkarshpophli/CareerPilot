// Lever board source. Ported from career-ops (MIT, Santiago Fernández de
// Valderrama): upstream/career-ops/providers/lever.mjs. Verdict:
// docs/sources/lever.md.

import { htmlToText, MAX_DESCRIPTION } from "./html-text";
import { requestBoardJson, validSlug } from "./request";
import { BoardError, type BoardAdapter, type BoardPosting, type BoardRef } from "./types";

const HOSTS = { us: "api.lever.co", eu: "api.eu.lever.co" } as const;
const BOARD_HOSTS: Record<string, "us" | "eu"> = { "jobs.lever.co": "us", "jobs.eu.lever.co": "eu", "api.lever.co": "us", "api.eu.lever.co": "eu" };

// The v0 list is one response with every description inlined; a large board is tens of megabytes (career-ops saw 42.8 MB).
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 50 * 1024 * 1024;

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
  const region = BOARD_HOSTS[url.hostname];
  if (!region) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const slug = url.hostname.startsWith("api.") ? (segments[0] === "v0" && segments[1] === "postings" ? segments[2] : undefined) : segments[0];
  if (!slug || !validSlug(slug)) return null;
  return region === "eu" ? { slug, region: "eu" } : { slug };
}

/** One primary city plus every other eligible location, without repeats (a role open in Barcelona and Montevideo is both). */
function locationOf(categories: unknown): string {
  const c = (categories ?? {}) as { location?: unknown; allLocations?: unknown };
  const primary = typeof c.location === "string" ? c.location.trim() : "";
  const all = Array.isArray(c.allLocations) ? c.allLocations.filter((place): place is string => typeof place === "string" && place.trim() !== "").map((place) => place.trim()) : [];
  const merged: string[] = [];
  for (const place of [primary, ...all]) if (place && !merged.some((seen) => seen.toLowerCase() === place.toLowerCase())) merged.push(place);
  return merged.join("; ");
}

type RawPosting = { id?: unknown; text?: unknown; hostedUrl?: unknown; createdAt?: unknown; workplaceType?: unknown; categories?: unknown; descriptionPlain?: unknown; description?: unknown; lists?: unknown; additionalPlain?: unknown };

/** The intro (plain, or its HTML where the plain one is empty), then each list, then the closing copy, in page order. */
function descriptionOf(job: RawPosting): string {
  const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const intro = str(job.descriptionPlain) || htmlToText(job.description);
  const lists = Array.isArray(job.lists) ? (job.lists as { text?: unknown; content?: unknown }[]).map((list) => [str(list?.text), htmlToText(list?.content)].filter(Boolean).join("\n")) : [];
  return [intro, ...lists, str(job.additionalPlain)].filter(Boolean).join("\n\n").slice(0, MAX_DESCRIPTION);
}

const remoteOf = (workplaceType: unknown): boolean | null => (typeof workplaceType === "string" && workplaceType.trim() ? workplaceType.trim().toLowerCase() === "remote" : null);

export function parseLever(json: unknown, ref: BoardRef, company: string): BoardPosting[] {
  if (!Array.isArray(json)) return [];
  return (json as RawPosting[])
    .filter((job) => job && typeof job.hostedUrl === "string" && job.hostedUrl && typeof job.id === "string" && job.id.trim())
    .map((job) => ({
      source: "LEVER" as const,
      externalId: `${ref.slug}:${(job.id as string).trim()}`,
      title: typeof job.text === "string" ? job.text : "",
      company,
      location: locationOf(job.categories),
      remote: remoteOf(job.workplaceType),
      url: job.hostedUrl as string,
      description: descriptionOf(job),
      postedAt: typeof job.createdAt === "number" && Number.isFinite(job.createdAt) ? new Date(job.createdAt).toISOString() : null,
      salary: null,
    }));
}

export const lever: BoardAdapter = {
  source: "LEVER",
  name: "Lever",
  hosts: [HOSTS.us, HOSTS.eu],
  refFrom,
  async fetchBoard(ref, company, context = {}) {
    if (!validSlug(ref.slug)) throw new BoardError("bad-slug", "That is not a Lever board name.");
    const host = HOSTS[ref.region === "eu" ? "eu" : "us"];
    const json = await requestBoardJson(`https://${host}/v0/postings/${encodeURIComponent(ref.slug)}`, {
      hosts: [host],
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_BYTES,
      signal: context.signal,
      fetchImpl: context.fetchImpl,
      sleep: context.sleep,
    });
    return parseLever(json, ref, company);
  },
};
