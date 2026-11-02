# Jobnet (jobnet.dk, search source)

**Verdict: deferred.** Not shipped. Checked 2026-11-02 from a GitHub Actions runner by a probe that identifies itself.

Jobnet is the Danish state's job portal, run by STAR (Styrelsen for Arbejdsmarked og Rekruttering). That makes it the most legitimate of the four in principle, but nothing that would let us use it was found:

- **No published interface.** The search the upstream CLI uses (`https://jobnet.dk/bff/FindJob/Search`) is the website's own *backend-for-frontend*; it answered JSON (status 200) when asked once, but it needs an `x-csrf: 1` header that exists for the site's own pages. It is not documented as a public API.
- **No `robots.txt`.** `https://jobnet.dk/robots.txt` returns an HTML error page (NemLog-in "Fejl"), i.e. there is no robots file to read.
- **No terms found.** Every plausible terms or privacy address (`/vilkaar`, `/betingelser`, `/cookies`, `/persondata`) returns the same error page, or 404.

What would settle it: a documented API or open-data feed from STAR for job ads (the state publishes other labour-market data openly), or a written answer from STAR about automated reading of the portal. Until then it is deferred rather than dropped, and nothing in the product calls it.
