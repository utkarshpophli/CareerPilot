# Ashby (board source)

**Verdict: allowed with limits.** Single-employer applicant-tracking system (ADR 0003), but the public posting API is slow and rate limited for repeated unauthenticated calls.

- Reads: `GET https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true`.
- Needs no key. Ashby documents this posting API as public for reading a board's published jobs.
- Limits we apply: HTTPS only, fixed host, no redirects, **30 s timeout, at most 2 retries with growing backoff, one request at a time to this host**, slug validated. Salary is read only from a salary component with real figures; equity and bonus components are ignored.
- Origin of the port: `upstream/career-ops/providers/ashby.mjs` (MIT, Santiago Fernández de Valderrama).
- **How this was checked:** from Ashby's public documentation and career-ops's measurements, not from a live call or a fresh read of the terms and `robots.txt` (not reachable from the build environment on 2026-11-02). Owner to confirm; a skipped-by-default live test is provided.
