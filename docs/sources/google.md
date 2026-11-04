# Google careers (google.com/about/careers, company career page)

**Verdict: allowed with limits, conditional on `robots.txt`.** Adapter queued with the HTML-scraped sources (it reads a large HTML page, not an API). Checked 2026-11-04 from a GitHub Actions runner by a probe that identifies itself.

- **Terms** (`policies.google.com/terms`, read 2026-11-04, in Danish): among the things you may not do is *"use automated methods to access content from our services in a way that violates the machine-readable instructions on our web pages (for example robots.txt files that disallow crawling, training or other activities)"*. So automated reading is permitted where `robots.txt` allows it, and forbidden where it does not.
- **`robots.txt`** (`www.google.com`): the results path `/about/careers/applications/jobs/results/` is not disallowed for `*` (checked with the path and query string). The condition above therefore holds today and must be checked again by the adapter before every scan, not once.
- **Shape:** the results come as a 1.4 MB HTML page with the data embedded in a script; there is no JSON endpoint. That is the highest-maintenance kind of source, so it waits for batch 4 (HTML-scraped sites), behind its own parser tests.
- Origin of the later port: `upstream/career-ops/providers/google.mjs` (MIT, Santiago Fernández de Valderrama).
