# Recruitee (board source)

**Verdict: allowed with limits.** Checked 2026-11-04 from a GitHub Actions runner by a probe that identifies itself.

- **What is read:** `GET https://{slug}.recruitee.com/api/offers/`, the per-company offers API that the company's own careers site uses. A real tenant (`channable`) answered 200 JSON with an `offers` list (title, slug, description, requirements, location and more; 300 KB for a large board).
- **`robots.txt`** (tenant host): `User-agent: *`, `Disallow: /v/`. The offers API is not disallowed.
- **Terms** (`recruitee.com/terms`, read 2026-11-04): the subscriber agreement between Tellent (Recruitee) and employers. It governs the employer's use of the service. No clause restricting reading of published career pages was found in the matched passages; the 114,000-character page was searched for the relevant words, not read line by line.
- **Limits we apply:** ADR 0003's board contract. The tenant name goes into the host (`{slug}.recruitee.com`) only after it passes a strict one-label check (letters, digits, hyphen), HTTPS only, no redirects, time and size limits, one request at a time, an honest user agent, only boards the owner added.
- Origin of the port: `upstream/career-ops/providers/recruitee.mjs` (MIT, Santiago Fernández de Valderrama).
