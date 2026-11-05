# Greenhouse (board source)

**Verdict: allowed.** Single-employer applicant-tracking system: each board is one employer's own postings, so it clears the source policy by construction (ADR 0003).

- Reads: `GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` (full text in one request). Greenhouse also serves boards from `job-boards.greenhouse.io` and `job-boards.eu.greenhouse.io`; those are the addresses people paste, and the slug is taken from them.
- Needs no key. Greenhouse documents this Job Board API as public for reading published jobs.
- Limits we apply: HTTPS only, fixed host list, no redirects, 10 s timeout, 5 MB, one request at a time to the host, slug validated.
- Origin of the port: `upstream/career-ops/providers/greenhouse.mjs` (MIT, Santiago Fernández de Valderrama).
- **How this was checked:** from Greenhouse's public documentation and career-ops's notes. The build environment could not reach the live API or re-read the terms and `robots.txt` on 2026-11-02. The owner should confirm before relying on it for a board they care about; a live test (`greenhouse.live.test.ts`) is provided and skipped unless asked for.
