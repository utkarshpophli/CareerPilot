# Jobdanmark (jobdanmark.dk, search source)

**Verdict: allowed with limits.** Checked 2026-11-02 from a GitHub Actions runner by a probe that identifies itself (`CareerPilot-source-check/1.0`), and by reading the site's user terms (dated 2020-08-01) in full.

What was found:

- **`robots.txt` allows it.** `https://jobdanmark.dk/robots.txt` disallows only `/bin/` and `/umbraco/` for every agent. The search call the site's own pages make, `POST /api/jobsearch/search/{page}`, is not disallowed. A sample call answered JSON (status 200), no challenge page, no Cloudflare.
- **The terms allow a job seeker's use.** Section 3 of the user terms makes the job database available to people looking for work or career information, and to employers, for lawful use. A person searching for their own next job through their own copy of CareerPilot is that use. The terms say nothing that forbids a program acting for that person; they do not grant a licence to copy the database.
- **No documented API.** The search endpoint is the website's own, so it can change without notice. The adapter treats an unexpected answer as "the source changed" and says so, as the other sources do.

Limits CareerPilot holds itself to, narrower than the terms require:

1. **Opt-in.** Off until the owner picks it in Settings → Job search.
2. **The search is the person's own.** One search per click or per scheduled saved search; no crawling, no walking every page of every category, no mirroring of the database.
3. **Listing data only.** Title, employer, address, job type, published date and deadline come from the search answer. CareerPilot does not fetch or scrape the individual ad pages (`/job/...`); the link goes to the ad on jobdanmark.dk, which is where the person applies. The answer carries no description, so a result is "incomplete" and its text is read only if the person asks for it with the existing Fetch.
4. **One request at a time**, no retries in a loop, a page size the server fixes at 30, and a stop after the pages the person asked for.
5. **An honest user agent** (`CareerPilot/<version>`), not a browser's.
6. **Source shown with the results** ("Jobs by Jobdanmark"), linking to the ad.
7. **Nothing is sent to Jobdanmark** except the search words and place.

What would change the verdict: a notice from Jobdanmark that automated reading is unwanted (then it is removed), or a published API (then it is moved to that).
