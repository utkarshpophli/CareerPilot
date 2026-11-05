# IBM careers (www-api.ibm.com search API, company career page)

**Verdict: deferred, leaning not allowed.** Not shipped. Checked 2026-11-04 from GitHub Actions runners by a probe that identifies itself.

IBM's terms of use (`ibm.com/legal/terms`, read 2026-11-04) say: *"You may only use a crawler to crawl this Web site as permitted by this Web site's robots.txt protocol, and IBM may block any crawlers in its sole discretion. The use authorized under this agreement is non-commercial in nature… All other use of this site is prohibited."* The rules of conduct also list *"any robot, spider, site search/retrieval application, or other manual or automatic device or process to retrieve, index, 'data mine'"* among what is not allowed.

So automated reading is allowed only where `robots.txt` allows it. The search API host, `www-api.ibm.com`, has **no `robots.txt`**: the address answers with IBM's home page. Without a file there is nothing that "permits" the crawl, and the terms say all other use is prohibited, so CareerPilot does not read it. The search itself is a POST that the probe did not make.

What would change it: a `robots.txt` that allows the careers search path, or an IBM statement about the careers API. `www.ibm.com`'s own `robots.txt` has not been read and would only cover its pages, not the API host.
