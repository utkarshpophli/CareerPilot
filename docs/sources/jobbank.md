# Jobbank (jobbank.dk, search source)

**Verdict: not allowed.** Dropped. Checked 2026-11-02 from a GitHub Actions runner by a probe that identifies itself.

- The site sits behind **Cloudflare bot protection**. The front page, `robots.txt` and the RSS feed (`/job/rss`) all answered **403** with the "Just a moment" challenge. A source whose operator actively blocks automated requests is not one to work around: we do not solve challenges or disguise the client.
- Because `robots.txt` itself could not be read, there is no basis to treat anything as permitted.
- The upstream CLI (ai-job-search's `jobbank-search`) says the same in its own notes: Jobbank "may block automated requests with Cloudflare bot protection; if that happens, report the portal as unavailable".

Reconsider only if Jobbank (Akademikernes Jobbank) publishes a feed or API for third parties, or the owner has an agreement with them.
