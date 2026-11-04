# IBM careers (www-api.ibm.com search API, company career page)

**Verdict: deferred.** Not shipped. Checked 2026-11-04 from a GitHub Actions runner by a probe that identifies itself.

- **No `robots.txt`** on `www-api.ibm.com` (the address answers with IBM's home page). The search API is a POST; the probe did not make that call.
- **Terms not read.** `ibm.com/legal` is an index; it points to `ibm.com/legal/terms` (the website terms of use, "a binding agreement between IBM and the user that defines the website's rules"), which has not been read yet.
- What would settle it: reading `ibm.com/legal/terms`, and `robots.txt` on `www.ibm.com` for the careers pages.
