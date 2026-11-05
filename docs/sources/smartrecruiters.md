# SmartRecruiters (board source)

**Verdict: not allowed.** Dropped. Checked 2026-11-04 from a GitHub Actions runner by a probe that identifies itself.

`https://api.smartrecruiters.com/robots.txt` reads, in full:

```
User-agent: LinkedInBot
Allow: /v1/companies/
User-agent: *
Disallow: /
```

The host that serves the public postings API tells every automated reader except LinkedIn's to stay away. CareerPilot honours `robots.txt`, so it does not read this API, and it does not pass itself off as LinkedIn. The probe made no request to the API for that reason.

Separately, the candidate terms of use (`smartrecruiters.com/legal/terms-of-use/`) prohibit using "automatic means to access content or data from other users", which is about candidate data but points the same way.

Reconsider only if SmartRecruiters changes its `robots.txt`, or documents an access route for readers like CareerPilot. career-ops's provider reads this API anyway; CareerPilot does not.
