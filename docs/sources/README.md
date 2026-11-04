# Job source verdicts

One file per source, written before the source ships (ADR 0003). A verdict is **allowed**, **allowed with limits**, or **not allowed**, with what was checked and on what date. A source with no verdict file does not ship.

A verdict reached from documentation alone says so. Nothing here was checked by calling the source from the build environment unless the file says it was.

| Source | Kind | Verdict | File |
|---|---|---|---|
| JSearch | search | existing (key from the owner) | n/a |
| Adzuna | search | existing (key from the owner) | n/a |
| FreeHire | search | existing | n/a |
| Bundesagentur für Arbeit | search | existing (owner accepts the note in Settings) | n/a |
| Jobindex | search | not allowed (robots.txt and terms) | [jobindex.md](jobindex.md) |
| Jobbank | search | not allowed (terms) | [jobbank.md](jobbank.md) |
| Jobnet | search | deferred (no published interface, no terms found) | [jobnet.md](jobnet.md) |
| Jobdanmark | search | allowed with limits (listing data only, opt-in) | [jobdanmark.md](jobdanmark.md) |
| Workable | board | allowed with limits (verdict written; adapter in progress) | [workable.md](workable.md) |
| Recruitee | board | allowed with limits (verdict written; adapter in progress) | [recruitee.md](recruitee.md) |
| Teamtailor | board | allowed with limits (verdict written; adapter in progress) | [teamtailor.md](teamtailor.md) |
| SmartRecruiters | board | not allowed (robots.txt) | [smartrecruiters.md](smartrecruiters.md) |
| Personio | board | deferred (terms unreadable) | [personio.md](personio.md) |
| BambooHR | board | deferred (no real tenant sampled, terms not read) | [bamboohr.md](bamboohr.md) |
| Greenhouse | board | allowed (single-employer ATS) | [greenhouse.md](greenhouse.md) |
| Lever | board | allowed (single-employer ATS) | [lever.md](lever.md) |
| Ashby | board | allowed with limits (slow, rate limited) | [ashby.md](ashby.md) |

M4c adds the rest of career-ops's providers (the full list and where each stands is [career-ops-providers.md](career-ops-providers.md)) to this table, each ported, dropped with a reason, or deferred with a reason, and the total must add up to the original count.
