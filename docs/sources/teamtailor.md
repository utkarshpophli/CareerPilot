# Teamtailor (board source)

**Verdict: allowed with limits.** Checked 2026-11-04 from a GitHub Actions runner by a probe that identifies itself.

- **What is read:** `GET https://{slug}.teamtailor.com/jobs.rss`, the public jobs feed every Teamtailor careers site serves. Two tenants answered 200 `application/rss+xml` (Teamtailor's own, 130 KB, and `podimo`, 75 KB), with titles, HTML descriptions and locations per item.
- **`robots.txt`**: `User-Agent: *` disallows `/app/`, `/messages/`, `/messenger/`, `/facebook/tab/` and `/jobs/internal/`; `/jobs.rss` is not disallowed. It carries `Content-Signal: search=yes, ai-train=no, ai-input=yes`. It singles out one crawler (`aihitdata`) for a full block; CareerPilot is not that agent. CareerPilot does not train models on what it reads.
- **Terms** (`teamtailor.com/en/terms-and-conditions/`, read 2026-11-04): the customer agreement. Section 14 says the customer's *own* access to Teamtailor's interfaces is as-is; nothing in the matched passages restricts reading a published feed. The 44,000-character page was searched for the relevant words, not read line by line.
- **Limits we apply:** ADR 0003's board contract. The tenant goes into the host only after a strict one-label check. Branded domains that front the same feed (`careers.example.com/jobs.rss`) are not followed: only `{slug}.teamtailor.com`. HTTPS only, no redirects, time and size limits, one request at a time, an honest user agent, only boards the owner added. The feed's HTML is turned into plain text.
- Origin of the port: `upstream/career-ops/providers/teamtailor.mjs` (MIT, Santiago Fernández de Valderrama).
