# Apple careers (jobs.apple.com, company career page)

**Verdict: not allowed.** Dropped. Checked 2026-11-04 from a GitHub Actions runner by a probe that identifies itself.

Apple's Website Terms of Use (`apple.com/legal/internet-services/terms/site.html`, linked from the careers site's footer) say, in "Your Use of the Site": *"You may not use any 'deep-link', 'page-scrape', 'robot', 'spider' or other automatic device, program, algorithm or methodology, or any similar or equivalent manual process, to access, acquire, copy or monitor any portion of the Site or any Content."*

`jobs.apple.com` has no `robots.txt` (the address answers 404), so there is no permission to read from there either. The search page is an HTML application that would have to be scraped, which is exactly what the terms rule out. The probe made one request to the search page to see its shape, before the terms had been read; no further request was or will be made.

Reconsider only if Apple publishes a feed or API for job listings, or changes these terms. career-ops's provider reads the page anyway; CareerPilot does not.
