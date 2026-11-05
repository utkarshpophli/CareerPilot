# Dassault Systèmes careers (3ds.com card search API, company career page)

**Verdict: deferred.** Not shipped. Checked 2026-11-04 from a GitHub Actions runner by a probe that identifies itself.

- **`robots.txt`** (`www.3ds.com`): `User-agent: *` has `Disallow: */search*` among many PDF rules. The API path `/apisearch/card_search_api` does not contain `/search` and is not disallowed by the file as written, but it is the site-wide card search (all content, with job cards among it), and a rule written against `search` suggests the site would rather automated readers did not use search. That is a judgement call this file does not make for the site.
- **Terms not found.** The guessed website terms address (`/terms/website-terms-use`) is a 404, so there is nothing to base a verdict on.
- What would settle it: finding and reading the site's terms of use.
