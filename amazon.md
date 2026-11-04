# Amazon.jobs (amazon.jobs, company career page)

**Verdict: deferred.** Not shipped. Checked 2026-11-04 from GitHub Actions runners by a probe that identifies itself.

- **`robots.txt`:** `User-agent: *` disallows only `/internal` pages (in several languages); `AhrefsBot` is blocked entirely. The careers site's search JSON (`/en/search.json`) is not disallowed, and one sample answered 200 with the postings.
- **Terms:** the site's legal page (`/content/en/legal-disclosures-and-notices`, read 2026-11-04) has one link: **Amazon.com's Conditions of Use** (`amazon.com/gp/help/customer/display.html?nodeId=508088`). The privacy page has nothing about automated reading. So the terms that bind a reader of amazon.jobs are the ones on that link, and they have not been read yet.
- What would settle it: reading those Conditions of Use for what they say about robots and automated access (next probe round). If they forbid it, the verdict is not allowed; if they allow it where `robots.txt` does, it becomes allowed with limits.
