import "server-only";

import { z } from "zod";

import { appVersion } from "@/lib/version";

import type { JobSourceAdapter, RequestContext } from "./adapter";
import { jobSearchError } from "./errors";
import { requestJson } from "./http";
import { POSTED_WITHIN, type FoundPosting, type SearchPage, type SearchQuery } from "./search";
import { JOBDANMARK_URL } from "./sources";

// Jobdanmark (jobdanmark.dk): the search call its own pages make, listing data
// only. The verdict is "allowed with limits" (docs/sources/jobdanmark.md):
// one request per search, no crawling, no ad pages (so `details` is never
// asked), an honest user agent, and only when the owner picks it. The answer
// carries no description, so a result is never "complete".

const SEARCH_PATH = "/api/jobsearch/search";
/** The server fixes the page size at 30. */
const PAGE_SIZE = 30;
/** However many pages the site claims, a search never walks past this many. */
const MAX_PAGES = 10;
const USER_AGENT = `CareerPilot/${appVersion} (+https://github.com/utkarshpophli/CareerPilot)`;

const maybeText = z.string().nullish().catch(null);

const itemSchema = z.object({
  title: z.string().min(1),
  companyName: maybeText,
  companyAddress: maybeText,
  jobTypes: z.array(z.string()).nullish().catch(null),
  publishedDate: maybeText,
  applicationDeadline: maybeText,
  url: z.string().min(1),
});
type Item = z.output<typeof itemSchema>;

const responseSchema = z.object({
  items: z.array(z.unknown()),
  currentPage: z.number().nullish().catch(null),
  totalPages: z.number().nullish().catch(null),
});

/**
 * The city of an address. The site writes "Lautruphoej 2, 2750 Ballerup" and
 * "2670, Greve" (a comma after a postcode needs a non-digit after it, so a
 * street number such as "Vejlevej 1234, 7100 Vejle" never wins over the
 * postcode); a postcode with nothing after it ("4100 ") has no city.
 */
export function placeOf(address: string | null | undefined): string {
  if (!address) return "";
  const city = address.match(/\d{4}\s+(.+)$/)?.[1] ?? address.match(/\d{4}\s*,\s*([^\d,].*)$/)?.[1];
  return (city ?? "").trim().slice(0, 300);
}

/** The site's "30-10-2026" as an ISO date; null for anything else or a day that doesn't exist. */
export function publishedOn(value: string | null | undefined): string | null {
  const match = value?.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day) ? date.toISOString() : null;
}

/** An ad's own page: only the site's relative "/job/<slug>" address counts. */
function adSlug(url: string): string | null {
  const match = url.match(/^\/job\/([A-Za-z0-9._~%-]{1,300})$/);
  return match ? match[1] : null;
}

function postingFromItem(item: Item, origin: string): FoundPosting | null {
  const slug = adSlug(item.url);
  if (!slug) return null;
  const types = (item.jobTypes ?? []).map((type) => type.trim()).filter(Boolean).join(", ");
  const deadline = (item.applicationDeadline ?? "").trim();
  const description = [types && `Job type: ${types}.`, deadline && `Apply by ${deadline}.`].filter(Boolean).join(" ");
  return {
    source: "JOBDANMARK",
    externalId: slug,
    title: item.title.trim().slice(0, 500),
    company: (item.companyName ?? "").trim().slice(0, 300),
    place: placeOf(item.companyAddress),
    remote: null,
    salary: "",
    postedAt: publishedOn(item.publishedDate),
    url: `${origin}/job/${slug}`,
    via: "",
    description,
    complete: false,
  };
}

function pageNumber(next: string | null): number {
  if (!next?.startsWith("page:")) return 1;
  return Math.min(MAX_PAGES, Math.max(1, Math.floor(Number(next.slice("page:".length))) || 1));
}

async function searchPage(query: SearchQuery, _credentials: Record<string, never>, next: string | null, context: RequestContext = {}): Promise<SearchPage> {
  const page = pageNumber(next);
  const origin = (context.baseUrl ?? JOBDANMARK_URL).replace(/\/+$/, "");
  const url = new URL(`${origin}${SEARCH_PATH}/${page}`);

  const filters: { type: string; value: string; displayText: string }[] = [];
  if (query.keywords) filters.push({ type: "freetext", value: query.keywords, displayText: query.keywords });
  // A municipality name, as the site's own place search takes it.
  if (query.place) filters.push({ type: "municipality", value: query.place, displayText: query.place });

  const answer = responseSchema.safeParse(
    await requestJson("JOBDANMARK", url, {
      method: "POST",
      body: { jobTypes: [], filters, locationMode: "Text", distance: 50 },
      headers: { "user-agent": USER_AGENT },
      signal: context.signal,
    }),
  );
  if (!answer.success) throw jobSearchError("changed", "JOBDANMARK", { detail: `${url.pathname}: unexpected answer` });

  // The date the site states; it has no filter for it, so older ones are left out of the page.
  const days = POSTED_WITHIN.find((option) => option.value === query.postedWithin)?.days;
  const oldest = days ? Date.now() - days * 86_400_000 : null;

  const seen = new Set<string>();
  const postings: FoundPosting[] = [];
  for (const raw of answer.data.items) {
    const item = itemSchema.safeParse(raw);
    if (!item.success) continue;
    const posting = postingFromItem(item.data, origin);
    if (!posting || seen.has(posting.externalId)) continue;
    seen.add(posting.externalId);
    if (oldest !== null && posting.postedAt && Date.parse(posting.postedAt) < oldest) continue;
    postings.push(posting);
  }

  const totalPages = answer.data.totalPages ?? (answer.data.items.length >= PAGE_SIZE ? page + 1 : page);
  return { postings, next: page < totalPages && page < MAX_PAGES ? `page:${page + 1}` : null };
}

export const jobdanmark: JobSourceAdapter<"JOBDANMARK"> = {
  source: "JOBDANMARK",
  search: searchPage,
  // Ad pages are not read (docs/sources/jobdanmark.md): the person opens the link to read and apply.
  details: async () => null,
  test: async (_credentials, context) => {
    await searchPage({ keywords: "udvikler", place: "", country: "dk", radiusKm: 25, remoteOnly: false, postedWithin: "any" }, {}, null, context);
  },
};
