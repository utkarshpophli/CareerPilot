# Atlassian careers (atlassian.com/endpoint/careers/listings, company career page)

**Verdict: allowed with limits.** Checked 2026-11-04 from a GitHub Actions runner by a probe that identifies itself. Adapter not built yet (next: a CI recording, then the parser).

- **What is read:** `GET https://www.atlassian.com/endpoint/careers/listings`, the JSON that Atlassian's own careers page uses: every open posting, about 2.5 MB, each with title, locations and a link to the iCIMS posting. One request answers a whole scan.
- **`robots.txt`** (`www.atlassian.com`): the listings path is not disallowed for `*` (checked with the path). The file disallows blog author and tag pages, a few PDFs and `*/purchase/*`, `*/variants/*`; none touches this.
- **Terms:** the site's "Terms" link goes to the Atlassian Customer Agreement (`/legal/atlassian-customer-agreement`), which governs customers' use of Atlassian's products. No website terms of use page was found (`/legal/website-terms-of-use` is a 404). The agreement was searched for the words that would matter (scrape, crawl, robot, automated, bot) and nothing about reading the public careers listings was found; it was not read line by line.
- **Limits we apply:** a single-employer source on ADR 0003's board contract: HTTPS only, the one fixed host, no redirects, time and size limits (the answer is large), one request per scan, an honest user agent, only when the owner adds it.
- Origin of the later port: `upstream/career-ops/providers/atlassian.mjs` (MIT, Santiago Fernández de Valderrama).
