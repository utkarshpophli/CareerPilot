# Workable (board source)

**Verdict: allowed with limits.** Checked 2026-11-04 from a GitHub Actions runner by a probe that identifies itself (`CareerPilot-source-check/1.0`).

- **What is read:** `GET https://apply.workable.com/api/v1/widget/accounts/{slug}?details=true`, Workable's public account widget: one employer's own published openings, in one answer. A real account (`huggingface`) answered 200 JSON with a `jobs` list (title, shortcode, url, department, location fields, description).
- **`robots.txt`** (`apply.workable.com`): `User-agent: *`, `Disallow:` (nothing disallowed), with `Content-Signal: search=yes, ai-input=yes, ai-train=no`. CareerPilot does not train models on what it reads; it shows postings to their owner and lets their own assistant read them.
- **Terms** (`workable.com/terms`, read 2026-11-04): the customer agreement between Workable and the employers that buy it. Its recruitment obligations bind the employer's use (no false openings, no harvesting candidates). It says nothing that restricts reading an employer's published openings; no clause about automated access to career pages was found in the matched passages. The page is 40,000 characters and was searched for the words that would matter (scrape, crawl, robot, automated, bot, harvest, aggregator), not read line by line.
- **Limits we apply:** the single-employer board contract of ADR 0003: HTTPS only, the fixed host `apply.workable.com`, a validated slug, no redirects, time and size limits, one request at a time, an honest user agent, only boards the owner added, text shown as data.
- Origin of the port: `upstream/career-ops/providers/workable.mjs` (MIT, Santiago Fernández de Valderrama).
