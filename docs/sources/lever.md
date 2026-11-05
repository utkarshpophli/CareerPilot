# Lever (board source)

**Verdict: allowed.** Single-employer applicant-tracking system; each board is one employer's own postings (ADR 0003).

- Reads: `GET https://api.lever.co/v0/postings/{slug}` (EU accounts: `api.eu.lever.co`). One response carries the whole board with descriptions; large boards can be tens of megabytes (career-ops measured 42.8 MB for one aggregator-like account), so this adapter has a 30 s timeout and a 50 MB cap, stated here and in the code.
- Needs no key. Lever documents the Postings API as public for reading an account's published postings.
- Limits we apply: HTTPS only, fixed host list, no redirects, one request at a time, slug validated.
- Origin of the port: `upstream/career-ops/providers/lever.mjs` (MIT, Santiago Fernández de Valderrama).
- **How this was checked:** from Lever's public documentation and career-ops's notes, not from a live call or a fresh read of the terms and `robots.txt` (the build environment could not reach them on 2026-11-02). Owner to confirm; a skipped-by-default live test is provided.
