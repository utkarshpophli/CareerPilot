// Reads, for each job source, what is needed to decide whether it may be used, and one small sample of its answer so the
// adapter's tests can use the real shape. Run by .github/workflows/probe-sources.yml (this sandbox cannot reach the sites).
//
//   node scripts/probe-sources.mjs danish
//
// For each site it fetches robots.txt, reads the front page for links that look like terms, privacy or data rules, and, only
// when robots.txt allows the path for a polite crawler, makes ONE sample request. Everything is printed between BEGIN/END
// lines (one line each) so a CI log read from the end cannot cut it off. Identifies itself honestly; no browser disguise.

const USER_AGENT = "CareerPilot-source-check/1.0 (+https://github.com/utkarshpophli/CareerPilot; one request per site)";
const GROUPS = {
  // The next batch of single-employer ATS vendors (M4c batch 1): robots.txt of the host the API is on, the vendor's front page
  // for terms links, and one sample of the public answer for a tenant that is the vendor itself.
  ats: [
    { name: "workable", origin: "https://apply.workable.com", front: "https://www.workable.com", sample: { method: "GET", path: "/api/v1/widget/accounts/workable?details=true", note: "public account widget" } },
    { name: "smartrecruiters", origin: "https://api.smartrecruiters.com", front: "https://www.smartrecruiters.com", sample: { method: "GET", path: "/v1/companies/smartrecruiters/postings?limit=5", note: "public postings API" } },
    { name: "recruitee", origin: "https://recruitee.recruitee.com", front: "https://recruitee.com", sample: { method: "GET", path: "/api/offers/", note: "per-tenant offers API" } },
    { name: "personio", origin: "https://personio.jobs.personio.de", front: "https://www.personio.com", sample: { method: "GET", path: "/xml", note: "per-tenant XML feed" } },
    { name: "teamtailor", origin: "https://career.teamtailor.com", front: "https://www.teamtailor.com", sample: { method: "GET", path: "/jobs.rss", note: "per-tenant RSS feed" } },
    { name: "bamboohr", origin: "https://bamboohr.bamboohr.com", front: "https://www.bamboohr.com", sample: { method: "GET", path: "/careers/list", note: "per-tenant careers list" } },
  ],
  // Round two: real tenants (named in career-ops's own examples), for the vendors whose first sample was not a tenant.
  ats2: [
    { name: "workable", origin: "https://apply.workable.com", front: "https://apply.workable.com/huggingface/", sample: { method: "GET", path: "/api/v1/widget/accounts/huggingface?details=true", note: "public account widget, a real tenant" } },
    { name: "recruitee", origin: "https://channable.recruitee.com", front: "https://channable.recruitee.com", sample: { method: "GET", path: "/api/offers/", note: "per-tenant offers API, a real tenant" } },
    { name: "teamtailor", origin: "https://podimo.teamtailor.com", front: "https://podimo.teamtailor.com", sample: { method: "GET", path: "/jobs.rss", note: "per-tenant RSS feed, a real tenant" } },
  ],
  danish: [
    {
      name: "jobindex",
      origin: "https://www.jobindex.dk",
      sample: { method: "GET", path: "/jobsoegning?q=designer&jobage=7", note: "search results are an HTML page" },
    },
    {
      name: "jobbank",
      origin: "https://jobbank.dk",
      sample: { method: "GET", path: "/job/rss?q=designer", note: "RSS feed" },
    },
    {
      name: "jobnet",
      origin: "https://jobnet.dk",
      sample: { method: "GET", path: "/bff/FindJob/Search?resultsPerPage=3&pageNumber=1&orderType=PublicationDate&searchString=designer", headers: { "x-csrf": "1" }, note: "STAR's front-end JSON" },
    },
    {
      name: "jobdanmark",
      origin: "https://jobdanmark.dk",
      sample: {
        method: "POST",
        path: "/api/jobsearch/search/1",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobTypes: [], filters: [{ type: "freetext", value: "designer", displayText: "designer" }], locationMode: "Text", distance: 50 }),
        note: "the site's own search call",
      },
    },
  ],
};

/** The rules of the first matching group for our agent, else for "*": [{ allow, path }]. */
function rulesFor(robots) {
  const groups = [];
  let current = null;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, field, value] = [null, match[1].toLowerCase(), match[2].trim()];
    if (field === "user-agent") {
      if (!current || current.rules.length > 0) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current) current.rules.push({ allow: field === "allow", path: value });
  }
  const mine = groups.find((group) => group.agents.some((agent) => agent !== "*" && "careerpilot-source-check".includes(agent))) ?? groups.find((group) => group.agents.includes("*"));
  return mine?.rules ?? [];
}

/** Longest matching rule wins; Allow wins a tie; nothing matching means allowed. */
function allowed(rules, path) {
  let best = null;
  for (const rule of rules) {
    if (!rule.path) continue;
    const pattern = new RegExp("^" + rule.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (pattern.test(path) && (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow))) best = rule;
  }
  return best ? best.allow : true;
}

const clip = (text, max) => (text.length > max ? `${text.slice(0, max)}[... ${text.length - max} characters cut]` : text);
const get = (url, init = {}) => fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30_000), ...init, headers: { "user-agent": USER_AGENT, "accept-language": "da,en;q=0.8", ...(init.headers ?? {}) } });

function emit(name, value) {
  console.log(`BEGIN ${name}`);
  console.log(JSON.stringify(value));
  console.log(`END ${name}`);
}

const TERMS = {
  jobindex: ["https://www.jobindex.dk/betingelser", "https://www.jobindex.dk/handelsbetingelser"],
  jobdanmark: ["https://jobdanmark.dk/privatlivspolitik", "https://jobdanmark.dk/vilkaar", "https://jobdanmark.dk/betingelser", "https://jobdanmark.dk/brugerbetingelser"],
  jobnet: ["https://jobnet.dk/vilkaar", "https://jobnet.dk/betingelser", "https://jobnet.dk/cookies", "https://jobnet.dk/om-jobnet", "https://jobnet.dk/persondata"],
};
Object.assign(TERMS, {
  workable: ["https://www.workable.com/terms", "https://www.workable.com/terms-of-service", "https://www.workable.com/legal/terms", "https://www.workable.com/privacy"],
  smartrecruiters: ["https://www.smartrecruiters.com/legal/terms-of-use/", "https://www.smartrecruiters.com/legal/", "https://www.smartrecruiters.com/legal/website-terms-of-use/"],
  recruitee: ["https://recruitee.com/terms", "https://recruitee.com/legal/terms-of-service", "https://recruitee.com/terms-of-use"],
  personio: ["https://www.personio.com/legal/terms-of-use/", "https://www.personio.com/terms-of-use/", "https://www.personio.com/legal-notice/"],
  teamtailor: ["https://www.teamtailor.com/en/terms-of-service/", "https://www.teamtailor.com/en/legal/", "https://www.teamtailor.com/en/terms/"],
  bamboohr: ["https://www.bamboohr.com/legal/terms-of-service/", "https://www.bamboohr.com/legal/", "https://www.bamboohr.com/legal/website-terms-of-use/"],
});
const KEYWORDS = /automat|robot|scrap|crawl|spider|harvest|bot\b|careers? (site|page)|public(ly)? (available|posting)|indsaml|systematisk|kopier|data ?mining|maskinel|API\b|genanvend|videreanvend|tekst- og data|ophavsret/i;

/** The readable text of a page, without scripts, styles and tags. */
const textOf = (html) => html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const group = process.argv[2] ?? "danish";
if (group === "jobdanmark-full-terms") {
  const response = await get("https://jobdanmark.dk/brugerbetingelser");
  emit("jobdanmark-brugerbetingelser", { status: response.status, text: textOf(await response.text()).slice(0, 12000) });
  process.exit(0);
}
if (group === "terms-urls") {
  // Reads the pages named on the command line: the start of each, every link that looks like terms, and the sentences around the words that would matter.
  const STRICT = /scrap|crawl|spider|harvest|robot|automat(ed|ic)|bots?\b|data ?mining|machine[- ]readable|public(ly)? (available|accessible)|career(s)? (site|page)|job (posting|listing|board)s?|aggregat|third[- ]part(y|ies) (site|service|platform)/i;
  for (const url of process.argv.slice(3)) {
    try {
      const response = await get(url);
      const html = await response.text();
      const text = textOf(html);
      const windows = [...text.matchAll(new RegExp(STRICT, "gi"))].slice(0, 14).map((match) => text.slice(Math.max(0, match.index - 260), match.index + 300));
      const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
        .map(([, href, label]) => ({ href, label: label.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }))
        .filter(({ href, label }) => /terms|tos\b|conditions|legal|agreement|acceptable|api/i.test(`${href} ${label}`));
      emit(`terms-url ${url}`, { url, status: response.status, chars: text.length, start: text.slice(0, 300), links: links.slice(0, 20), windows });
    } catch (error) {
      emit(`terms-url ${url}`, { url, error: String(error.message ?? error) });
    }
  }
  process.exit(0);
}
if (group === "danish-terms" || group === "ats-terms") {
  const wanted = group === "ats-terms" ? new Set(["workable", "smartrecruiters", "recruitee", "personio", "teamtailor", "bamboohr"]) : new Set(["jobindex", "jobdanmark", "jobnet"]);
  for (const [name, urls] of Object.entries(TERMS).filter(([name]) => wanted.has(name))) {
    const pages = [];
    for (const url of urls) {
      try {
        const response = await get(url);
        const html = await response.text();
        const text = textOf(html);
        const windows = [...text.matchAll(new RegExp(KEYWORDS, "gi"))].slice(0, 10).map((match) => text.slice(Math.max(0, match.index - 220), match.index + 260));
        pages.push({ url, status: response.status, contentType: response.headers.get("content-type"), chars: text.length, start: text.slice(0, 300), windows });
      } catch (error) {
        pages.push({ url, error: String(error.message ?? error) });
      }
    }
    emit(`terms-${name}`, { site: name, pages });
  }
  process.exit(0);
}
for (const site of GROUPS[group] ?? []) {
  const result = { site: site.name, origin: site.origin };
  try {
    const robots = await get(`${site.origin}/robots.txt`);
    const text = await robots.text();
    result.robots = { status: robots.status, contentType: robots.headers.get("content-type"), text: clip(text, 6000) };
    const rules = robots.ok && /user-agent/i.test(text) ? rulesFor(text) : [];
    result.samplePath = site.sample.path;
    // robots.txt rules match the path together with its query string (Jobindex, for one, disallows page=, sort= and jobage=).
    result.sampleAllowedByRobots = allowed(rules, site.sample.path);
  } catch (error) {
    result.robots = { error: String(error.message ?? error) };
    result.sampleAllowedByRobots = false;
  }
  try {
    const front = await get(site.front ?? site.origin);
    const html = await front.text();
    result.front = { status: front.status, server: front.headers.get("server"), cloudflare: /cloudflare|just a moment|cf-chl/i.test(html) || /cloudflare/i.test(front.headers.get("server") ?? "") };
    const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(([, href, label]) => ({ href, label: label.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }))
      .filter(({ href, label }) => /vilk|betingelse|terms|brugerbetingelser|cookie|persondata|privat|privacy|databeskyt|api|scrap|robot|data/i.test(`${href} ${label}`));
    result.termsLinks = links.slice(0, 25);
  } catch (error) {
    result.front = { error: String(error.message ?? error) };
  }
  if (result.sampleAllowedByRobots) {
    try {
      const response = await get(site.origin + site.sample.path, { method: site.sample.method, headers: site.sample.headers, body: site.sample.body });
      const body = await response.text();
      result.sample = { status: response.status, contentType: response.headers.get("content-type"), bytes: body.length, note: site.sample.note, cloudflareChallenge: /just a moment|cf-chl/i.test(body), body: clip(body, 5000) };
    } catch (error) {
      result.sample = { error: String(error.message ?? error) };
    }
  } else {
    result.sample = { skipped: "robots.txt does not allow this path for a polite crawler, or could not be read" };
  }
  emit(site.name, result);
}
