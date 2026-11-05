# Dassault Systèmes careers (3ds.com card search API, company career page)

**Verdict: deferred.** Not shipped. Checked 2026-11-04 from GitHub Actions runners by a probe that identifies itself.

- **`robots.txt`** (`www.3ds.com`): `User-agent: *` has `Disallow: */search*` among many PDF rules. The API path `/apisearch/card_search_api` does not contain `/search` and is not disallowed by the file as written, but it is the site-wide card search (all content, with job cards among it).
- **Terms:** the address that holds terms (`3ds.com/terms-use`) turned out to be the terms of *La Fondation Dassault Systèmes*, a separate website. Its terms say *"the use of robots, data mining or similar data collection and/or extraction tools is strictly prohibited."* That is not the careers site's terms, but it is the only wording from the company found, and it points the same way. The main site's own terms (`/legal`, `/terms/website-terms-use`) are 404s.
- What would settle it: finding the terms that govern `3ds.com` itself.
