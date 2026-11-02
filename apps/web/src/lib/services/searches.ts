import "server-only";

import { countryCodeFor } from "@/lib/job-search/countries";
import { DEFAULT_RADIUS_KM, type PostedWithin, type RadiusKm, type SearchProblem, type SearchQuery, type ShownPosting, type StoredSearch } from "@/lib/job-search/search";
import { loadSearch, runSearch, showMoreFor } from "@/lib/posting-searches";
import type { FoundPosting } from "@/lib/job-search/search";
import type { PrismaClient } from "@/generated/prisma/client";
import { ServiceError } from "@/lib/service-error";

import { reportAsRun } from "./runs";

// Job searches as a service: what an assistant asks for becomes a SearchQuery
// (defaults from the profile), the chosen source answers, and the search is
// kept so going back to it costs nothing. Every door (REST, CLI, MCP) calls
// these; none of them talks to a job source itself.

export type SearchInput = {
  keywords: string;
  /** City or region; defaults to the profile's city. "" searches the whole country. */
  place?: string;
  /** A country name or ISO code; defaults to the profile's country. */
  country?: string;
  remoteOnly?: boolean;
  radiusKm?: RadiusKm;
  postedWithin?: PostedWithin;
};

type Basics = { city: string; country: string };

/** The query for an input, with the profile's city and country where the input is silent. */
export function searchQueryFrom(input: SearchInput, basics: Basics): SearchQuery {
  const country = countryCodeFor(input.country ?? basics.country) || (input.country?.trim().length === 2 ? input.country.trim().toLowerCase() : "");
  if (!country) throw new ServiceError("bad_request", "Say which country to search in, e.g. country: 'Germany'.");
  const remoteOnly = input.remoteOnly ?? false;
  return {
    keywords: input.keywords,
    place: remoteOnly ? "" : (input.place ?? basics.city).trim(),
    country,
    radiusKm: input.radiusKm ?? DEFAULT_RADIUS_KM,
    remoteOnly,
    postedWithin: input.postedWithin ?? "month",
  };
}

const CODE_FOR_PROBLEM: Record<SearchProblem["problem"], ServiceError["code"]> = {
  off: "bad_request",
  "not-accepted": "bad_request",
  "no-country": "bad_request",
  "no-key": "bad_request",
  key: "bad_request",
  country: "bad_request",
  quota: "conflict",
  unavailable: "conflict",
  changed: "not_found",
};

const problem = (answer: SearchProblem) => new ServiceError(CODE_FOR_PROBLEM[answer.problem], answer.message);

/** Runs a search on the chosen source and keeps it. Uses one search from the user's plan with that source. */
export const runJobSearch = (db: PrismaClient, input: SearchInput, basics: Basics): Promise<{ query: SearchQuery; search: StoredSearch }> =>
  reportAsRun(
    db,
    { kind: "searches.run", title: `Search: ${input.keywords.trim()}` },
    async () => {
      const query = searchQueryFrom(input, basics);
      const ran = await runSearch(query);
      if (!ran.ok) throw problem(ran);
      const search = await loadSearch(ran.id);
      if (!search) throw new ServiceError("not_found", "The search ran, but couldn't be read back. Try again.");
      return { query, search };
    },
    ({ search }) => ({ summary: `Found ${search.postings.length} posting${search.postings.length === 1 ? "" : "s"}`, data: { found: search.postings.length } }),
  );

/** A kept search with its postings; null when it is no longer kept. Costs no searches. */
export const readSearch = (id: string): Promise<StoredSearch | null> => loadSearch(id);

/** The next page of a kept search, added to it. Uses one more search from the user's plan. */
export const moreJobs = (db: PrismaClient, id: string): Promise<{ postings: ShownPosting[]; next: string | null }> =>
  reportAsRun(
    db,
    { kind: "searches.more", title: "More search results" },
    async () => {
      const more = await showMoreFor(id);
      if (!more.ok) throw problem(more);
      return { postings: more.postings, next: more.next };
    },
    (more) => ({ summary: `Added ${more.postings.length} posting${more.postings.length === 1 ? "" : "s"}`, data: { added: more.postings.length } }),
  );

/** A posting as an assistant sees it in a list: numbered, with a snippet instead of the whole text. */
export function postingSummary(posting: ShownPosting | FoundPosting, number: number) {
  const state = "state" in posting ? posting.state : null;
  return {
    number,
    title: posting.title,
    company: posting.company,
    place: posting.place,
    remote: posting.remote,
    salary: posting.salary || undefined,
    posted: posting.postedAt?.slice(0, 10),
    via: posting.via || undefined,
    url: posting.url || undefined,
    saved: state?.saved || undefined,
    applied: state?.applicationId ? true : undefined,
    fit: state?.score ?? undefined,
    snippet: posting.description.replace(/\s+/g, " ").slice(0, 280),
  };
}
