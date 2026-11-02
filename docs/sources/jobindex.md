# Jobindex (jobindex.dk, search source)

**Verdict: not allowed.** Dropped (open decision 2 in `ROADMAP.md`: when a source's rules do not permit automated use, drop it). Checked 2026-11-02 from a GitHub Actions runner (this sandbox cannot reach the site), by a probe that identifies itself and reads `robots.txt` before anything else.

What was found:

- **There is no API.** Search is an HTML page (`/jobsoegning?q=...`) that would have to be scraped; this is the highest-maintenance kind of source.
- **`robots.txt` disallows what a search source needs.** For all crawlers it disallows `/jobsoegning*page=` (paging), `*sort=`, `*jobage=` (recency), `*radius=`, `*companyid=`, `*geoareaid=`, `*archive=`, any search with three or more parameters (`/jobsoegning?*&*&`), and paths under a category with parameters. What remains allowed is the first page of a plain `?q=` search: 20 results, no paging, no recency filter. That is not enough to be a source, and the upstream CLI (ai-job-search's `jobindex-search`) uses exactly the disallowed parameters.
- **The terms claim the data.** The trade terms (`/handelsbetingelser`) say Jobindex has the full copyright and all rights to its products "including the right to personal data and other data collected", and sell "Robotscanningsaftale" (a paid, automated feed *into* Jobindex for employers). The privacy and user terms (`/betingelser`) did not mention automated reading.
- Three crawlers are blocked outright by name (`008`, `sogou spider`, `CariBot`); ours is not one of them, which does not make the disallowed paths allowed.

**One mistake in the check, for the record:** the first version of the probe compared `robots.txt` against the path without its query string, so it made **one** request to `/jobsoegning?q=designer&jobage=7`, which `robots.txt` disallows (`jobage=`). The matcher was fixed in the next commit and no further request to a disallowed URL was made.

What to do instead: Jobindex postings that matter reach you through the employer's own board (Greenhouse, Lever, Ashby and the others), or by pasting a posting's link into New application. If Jobindex offers a licensed feed, that would be a different decision.
