# Amazon.jobs (amazon.jobs, company career page)

**Verdict: deferred.** Not shipped. Checked 2026-11-04 from a GitHub Actions runner by a probe that identifies itself.

- **`robots.txt`:** `User-agent: *` disallows only `/internal` pages (in several languages); `AhrefsBot` is blocked entirely. The careers site's search JSON (`/en/search.json`) is not disallowed, and one sample answered 200 with the postings (10,000 hits for a keyword).
- **Terms not found.** The privacy page (`/en/privacy_page`) has nothing about automated reading. The footer's other legal page (`/content/en/legal-disclosures-and-notices`) has not been read. The guessed `/en/landing_pages/legal` is a 404. Amazon's general conditions of use for `amazon.com` are known to restrict robots and scrapers, and it is not established that they or something like them apply to `amazon.jobs`; that has to be read, not assumed either way.
- What would settle it: reading the legal disclosures page (next probe round). If it is silent on automated access, the verdict becomes allowed with limits, on `robots.txt`.
