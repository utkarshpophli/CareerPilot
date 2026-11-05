# Amazon.jobs (amazon.jobs, company career page)

**Verdict: not allowed.** Dropped. Checked 2026-11-04 from GitHub Actions runners by a probe that identifies itself.

- **The terms that bind a reader of amazon.jobs are amazon.com's.** The careers site's legal page (`/content/en/legal-disclosures-and-notices`) has one link, to Amazon.com's **Conditions of Use**. Those say (read 2026-11-04) that you may not make *"any use of data mining, robots, or similar data gathering and extraction tools"* of an Amazon Service or its contents.
- **`robots.txt`** (`amazon.jobs`) disallows only `/internal` pages and the careers search JSON (`/en/search.json`) answers 200. That is a technical door left open, not permission: the terms above forbid the use, and CareerPilot reads terms as well as `robots.txt`.
- The probe made one request to the search JSON, before the terms were read; no more were or will be made.

Reconsider only if Amazon publishes a feed or API for job listings, or changes these terms. career-ops's provider reads the JSON anyway; CareerPilot does not.
