# ADR 0003: One contract for job sources: search sources and board sources

Status: accepted. Date: 2026-11-02.

## Context

CareerPilot has four job sources today (JSearch, Adzuna, FreeHire, Bundesagentur). Each is an *aggregator you search*: you send keywords and a place, and get one page of postings back (`lib/job-search/adapter.ts`). The owner picks one in Settings.

career-ops has about 125 provider modules with a different shape. Most are *an employer's own published job board* (Greenhouse, Lever, Ashby, Workable and so on): there is no search, you name a company, get everything it has open, and filter on your side. It also has things dossier lacks: a rule for which sources may be indexed at all, SSRF-safe fetching, a trust check on what a source returns, and salary parsing that never guesses. ai-job-search adds a few regional portals.

M4b and M4c port these. Before code we need one contract, or each port invents its own.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Source kinds | Two. A **search source** answers a query (today's four, unchanged). A **board source** lists one employer's open postings, given a slug (`stripe` on Greenhouse). | They differ in what you ask and what you get. Forcing boards into `search(query)` would make them pretend to filter by keyword server-side, which they cannot. |
| Language | TypeScript adapters in `lib/job-search/`, one file per source. career-ops's `.mjs` modules are ported, not wrapped. | One language, one test runner, the existing `JobSearchError` and request limits apply. |
| Board adapter shape | `{ source, hosts, fetchBoard(slug, ctx) → BoardPosting[] }` where the network call goes through one function, `requestBoardJson`, and **parsing is a pure function** over the response (`parseGreenhouse(json, slug)`). | Pure parsers are tested with recorded responses and no network. One network function is the one place that enforces the rules below. |
| Network rules for boards | HTTPS only; the host must be in the adapter's fixed allow-list; `redirect: "error"`; 10 s default timeout (30 s where the source is known to be slow); 5 MB cap (larger for the one-response boards that need it, stated per adapter); one request at a time per host. Slugs are validated (`[A-Za-z0-9._-]{1,100}`) and URL-encoded, never concatenated raw. | A board's slug comes from the owner or an assistant, so it is input. With a fixed host list and no redirects, a slug cannot point the server at an internal address (the SSRF class career-ops guards against). |
| Identity | A posting is `(source, externalId)`, as now. For boards `externalId` is `"<slug>:<id>"`, because ids are only unique within a board. The employer's requisition id, when the source gives one, is kept apart and never used alone to decide two postings are the same opening (career-ops measured many postings per requisition id). | Fits the existing `Posting` table and `PostingScore` key. Avoids a wrong merge. |
| What is a posting's text | Plain text, tags stripped, entities decoded twice (boards double-encode), capped. It is **data**. Everything that stores it or hands it to a model still goes through the posting guard, as for pasted text. | Hard rule: web text is data, not instructions. |
| Salary | Only when the source states figures. Never inferred. Annualised with the interval stated by the source. | Hard rule: no invented facts. |
| Which companies | A `TrackedCompany` table: source, slug, display name, enabled, last success, last error, how many postings last time. Added by the owner, or by an assistant through the same service (it is a draft-level action: it reads public data, sends nothing). | Settings shows source health; a broken board turns red instead of silently returning nothing. |
| Eligibility | Before a source ships, `docs/sources/<name>.md` records its verdict (allowed, allowed with limits, not allowed), what was checked, and when. A single-employer ATS clears the policy by construction (the postings are the employer's own). A board or aggregator needs its terms and `robots.txt` read first. | Same rule as career-ops's source-indexing policy; a port is not a licence to scrape. |
| Tests | Recorded responses only in CI. One opt-in live test per source (`*.live.test.ts`, skipped unless asked), never run in CI. Ported tests keep their origin noted. | CI must not depend on someone else's server. |
| Licence | Ported files keep career-ops's MIT notice and name their origin path at the top. | MIT requires it. |
| Scans are runs | Scanning boards reports as a run with a step per source and counts (found, skipped and why, failed). | ADR 0002 and M4a.4. |

## Not decided here

- Scheduling scans (M5 worker). Until then a scan runs when asked.
- Matching and scoring postings found by a scan (M4d).
- HTML-scraped sources (M4c batch 4): each needs its own robots/terms verdict first.

## Consequences

- A new source is a parser, a fixture, a verdict file and a line in a list, not a new subsystem.
- `PostingSource` (a database enum) grows by one value per board source; each is a migration.
- Search sources and board sources are listed together in Settings, but only search sources are chosen as "the" source; board sources are used through tracked companies.
