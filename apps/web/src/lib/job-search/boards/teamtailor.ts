// Teamtailor board source. Ported from career-ops (MIT, Santiago Fernández de
// Valderrama): upstream/career-ops/providers/teamtailor.mjs. Verdict:
// docs/sources/teamtailor.md. Reads the public jobs feed of {tenant}.teamtailor.com only.

import { decodeEntities, htmlToText, MAX_DESCRIPTION } from "./html-text";
import { requestBoardText, tenantHost } from "./request";
import { BoardError, type BoardAdapter, type BoardPosting, type BoardRef } from "./types";

const DOMAIN = "teamtailor.com";
const NOT_TENANTS = new Set(["www", "api", "app", "support", "help", "docs", "trust", "career", "careers"]);

function refFrom(input: string): BoardRef | null {
  const text = input.trim();
  if (tenantHost(text, DOMAIN)) return { slug: text };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const match = /^([a-z0-9-]+)\.teamtailor\.com$/.exec(url.hostname);
  return match && tenantHost(match[1], DOMAIN) && !NOT_TENANTS.has(match[1]) ? { slug: match[1] } : null;
}

/** The inside of the first `<name>…</name>` in `xml`, CDATA unwrapped; "" when there is none. A tag is never matched across another's start, so a field cannot swallow the next one. */
function inner(xml: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\:]/g, "\\$&");
  const match = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`).exec(xml);
  if (!match) return "";
  return match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
}

/** Plain text of a field that may carry entities or markup. */
const plain = (value: string) => htmlToText(value, { cap: 500 });

function locationOf(item: string): string {
  const places = [...item.matchAll(/<tt:location>([\s\S]*?)<\/tt:location>/g)].map(([, block]) =>
    [plain(inner(block, "tt:city")) || plain(inner(block, "tt:name")), plain(inner(block, "tt:country"))].filter(Boolean).join(", "),
  );
  return [...new Set(places.filter(Boolean))].join("; ");
}

/** The feed says "none", "hybrid" or "fully"; only the two plain answers become a yes or a no. */
function remoteOf(status: string): boolean | null {
  const word = status.trim().toLowerCase();
  return word === "none" ? false : word === "fully" || word === "remote" ? true : null;
}

export function parseTeamtailor(xml: string, ref: BoardRef, company: string): BoardPosting[] {
  const postings: BoardPosting[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const guid = plain(inner(item, "guid"));
    const link = decodeEntities(inner(item, "link")).trim();
    if (!guid || !/^https:\/\//i.test(link)) continue;
    const time = Date.parse(inner(item, "pubDate"));
    postings.push({
      source: "TEAMTAILOR",
      externalId: `${ref.slug}:${guid}`,
      title: plain(inner(item, "title")),
      company,
      location: locationOf(item),
      remote: remoteOf(inner(item, "remoteStatus")),
      url: link,
      // The feed escapes its HTML once; htmlToText takes it from there.
      description: htmlToText(inner(item, "description"), { cap: MAX_DESCRIPTION }),
      postedAt: Number.isNaN(time) ? null : new Date(time).toISOString(),
      salary: null,
    });
  }
  return postings;
}

export const teamtailor: BoardAdapter = {
  source: "TEAMTAILOR",
  name: "Teamtailor",
  hosts: [`{tenant}.${DOMAIN}`],
  refFrom,
  async fetchBoard(ref, company, context = {}) {
    const host = tenantHost(ref.slug, DOMAIN);
    if (!host) throw new BoardError("bad-slug", "That is not a Teamtailor board name.");
    const xml = await requestBoardText(`https://${host}/jobs.rss`, {
      hosts: [host],
      accept: "application/rss+xml, application/xml;q=0.9",
      timeoutMs: 30_000,
      maxBytes: 25 * 1024 * 1024,
      retries: 1,
      signal: context.signal,
      fetchImpl: context.fetchImpl,
      sleep: context.sleep,
    });
    return parseTeamtailor(xml, ref, company);
  },
};
