// Which job board or site a posting came from, as one short, stable name, so
// the Insights page can group applications by platform. Pure: no I/O.

/** Known sites by the end of their host name, most specific first. */
const KNOWN: readonly (readonly [suffix: string, name: string])[] = [
  ["boards.greenhouse.io", "greenhouse"],
  ["job-boards.greenhouse.io", "greenhouse"],
  ["greenhouse.io", "greenhouse"],
  ["jobs.lever.co", "lever"],
  ["lever.co", "lever"],
  ["jobs.ashbyhq.com", "ashby"],
  ["ashbyhq.com", "ashby"],
  ["apply.workable.com", "workable"],
  ["workable.com", "workable"],
  ["myworkdayjobs.com", "workday"],
  ["myworkdaysite.com", "workday"],
  ["smartrecruiters.com", "smartrecruiters"],
  ["recruitee.com", "recruitee"],
  ["teamtailor.com", "teamtailor"],
  ["personio.de", "personio"],
  ["personio.com", "personio"],
  ["bamboohr.com", "bamboohr"],
  ["linkedin.com", "linkedin"],
  ["indeed.com", "indeed"],
  ["glassdoor.com", "glassdoor"],
  ["wellfound.com", "wellfound"],
  ["angel.co", "wellfound"],
  ["news.ycombinator.com", "hackernews"],
  ["ycombinator.com", "ycombinator"],
  ["arbeitsagentur.de", "arbeitsagentur"],
  ["adzuna.com", "adzuna"],
  ["freehire.dev", "freehire"],
];

/** Second-level labels that make "co.uk"-style endings, so "acme.co.uk" groups as "acme.co.uk", not "co.uk". */
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac"]);

/** The platform for a posting's address; "" when it has none or isn't an http(s) address. */
export function platformFromUrl(url: string): string {
  let host: string;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
  if (!host) return "";
  for (const [suffix, name] of KNOWN) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return name;
  }
  // Indeed and Glassdoor have a host per country: "uk.indeed.com", "de.indeed.com", "indeed.co.uk".
  if (/(^|\.)indeed\.[a-z.]+$/.test(host)) return "indeed";
  if (/(^|\.)glassdoor\.[a-z.]+$/.test(host)) return "glassdoor";
  const labels = host.split(".");
  if (labels.length <= 2) return host.replace(/^www\./, "");
  const take = SECOND_LEVEL.has(labels[labels.length - 2]!) && labels[labels.length - 1]!.length === 2 ? 3 : 2;
  return labels.slice(-take).join(".");
}

/** The aggregator a saved posting was found through (Posting.source), as a platform name. */
export function platformFromPostingSource(source: string): string {
  return source.toLowerCase();
}

/**
 * The platform for an application: the address of its posting when it has
 * one, else the aggregator that found it, else "" (typed in by hand).
 */
export function platformOfApplication(application: { postingUrl: string; postingSource?: string | null }): string {
  const fromUrl = platformFromUrl(application.postingUrl);
  if (fromUrl) return fromUrl;
  return application.postingSource ? platformFromPostingSource(application.postingSource) : "";
}
