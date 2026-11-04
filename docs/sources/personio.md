# Personio (board source)

**Verdict: deferred.** Not shipped. Checked 2026-11-04 from a GitHub Actions runner by a probe that identifies itself.

- `robots.txt` on a tenant host (`personio.jobs.personio.de`): `User-agent: *`, `Allow: /`. The documented XML feed (`/xml`) answered 200 with a valid, empty `workzag-jobs` document for that tenant.
- **Terms could not be read.** `personio.com` answered every terms address with a Vercel security checkpoint (HTTP 429) to the probe, so there is nothing to base a verdict on. A source ships only with a verdict, so it waits.
- What would settle it: reading Personio's terms from a place that is not challenged, or a written answer from Personio.
