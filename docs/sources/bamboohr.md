# BambooHR (board source)

**Verdict: deferred.** Not shipped. Checked 2026-11-04 from a GitHub Actions runner by a probe that identifies itself.

- `robots.txt` on a tenant-style host: `User-Agent: *`, `Disallow:` (nothing disallowed).
- **No real tenant answered.** The one sample (`bamboohr.bamboohr.com/careers/list`) was BambooHR's own marketing page, not a careers list, so the answer's shape was not seen. The terms index (`bamboohr.com/legal/`) was found but the terms of service it links were not read.
- What would settle it: a real tenant's `careers/list` answer and the terms of service text. Until both are seen it does not ship.
