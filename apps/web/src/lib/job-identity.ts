import { createHash } from "node:crypto";

// Identity and dedup for postings (M4d.1): one place that says whether two postings are the same opening.
// Ported in spirit from career-ops (MIT, Santiago Fernández de Valderrama): url-key.mjs, dedup-tracker.mjs,
// and ai-job-search (MIT): tools/job_key.py. A key is a pure function of the posting. "No key" is the empty
// string, and the empty string never matches another one.

const sha1 = (text: string) => createHash("sha1").update(text).digest("hex");

/** Parameters that say where a visitor came from, not which posting it is. Everything else is kept. */
const TRACKING = [/^utm_/i, /^mc_/i, /^_hs/i, /^(gclid|fbclid|msclkid|igshid|dclid|yclid|twclid|li_fat_id)$/i, /^(ref|referrer|referral|source|src|gh_src|lever-source|lever-origin|trk|trackingid|campaign)$/i];

/** A posting address reduced to a stable comparison key; "" when there is nothing to key on. */
export function normalizeUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const text = raw.trim();
  if (!text) return "";
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return ""; // a placeholder ("N/A"), a reference or free text identifies nothing
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  url.hash = "";
  const keep = [...url.searchParams.entries()].filter(([name]) => !TRACKING.some((pattern) => pattern.test(name)));
  keep.sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : x > y ? 1 : 0) : a < b ? -1 : 1));
  url.search = "";
  for (const [name, value] of keep) url.searchParams.append(name, value);
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
  return url.toString();
}

const slug = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** True when folding to ASCII dropped letters of another script, so the slug says less than the text did ("Сбер AI" keeps only "ai"). */
function lostLetters(text: string): boolean {
  for (const char of text.normalize("NFKD")) {
    if (char.charCodeAt(0) < 128) continue;
    if (/\p{L}/u.test(char) && !/\p{Script=Latin}/u.test(char)) return true;
  }
  return false;
}

/** Capped without making the cut differ between runs: a hash of the whole slug is appended. */
function capped(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).replace(/-+$/, "")}-${sha1(value).slice(0, 6)}`;
}

const LEGAL_SUFFIX = new Set(["inc", "incorporated", "llc", "ltd", "limited", "gmbh", "mbh", "ag", "kg", "ug", "se", "corp", "corporation", "co", "company", "sa", "sas", "srl", "spa", "bv", "nv", "plc", "ab", "oy", "as", "pty", "pvt"]);

/** A company name as a key: no legal suffix, punctuation, case or accents. A name that folds to nothing still gets an identity of its own. */
export function companyKey(name: string): string {
  const folded = name.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").toLowerCase();
  const words = folded.split(/[^a-z0-9]+/).filter(Boolean);
  while (words.length > 1 && LEGAL_SUFFIX.has(words[words.length - 1]!)) words.pop();
  const base = capped(words.join("-"), 40);
  const trimmed = name.trim();
  if (!trimmed) return "unknown-company";
  if (!base || lostLetters(trimmed)) {
    const identity = sha1(trimmed.normalize("NFC").toLowerCase()).slice(0, 6);
    return base ? `${base}-${identity}` : `company-${identity}`;
  }
  return base;
}

/** "(m/f/d)", "(w/m/x)", "(all genders)" and the like say nothing about the role. */
const GENDER_MARKERS = /\s*[([]\s*(?:[mwfdxg](?:\s*[/|*:]\s*[mwfdxgn])+|all genders|alle geschlechter|gn)\s*[)\]]|\s+[mwfd]\s*\/\s*[mwfdx]\s*\/\s*[mwfdx]\b/gi;

/** A job title as a key; "" when it folds to nothing. */
export function titleKey(title: string): string {
  return capped(slug(title.replace(GENDER_MARKERS, " ")), 60);
}

const locationKey = (place: string) => slug(place);

export type Identified = { company: string; title: string; url: string };

/**
 * The canonical key for a posting: `<company>_<role>`, lowercase letters, digits and hyphens only, safe as a
 * key and as a folder name. A title in a script that cannot be folded takes the posting's own numeric id, or a
 * hash of its address, so two such titles never collide.
 */
export function canonicalKey({ company, title, url }: Identified): string {
  let role = titleKey(title);
  if (!role || lostLetters(title)) {
    const id = /(\d{6,})/.exec(url)?.[1];
    const hash = sha1(url || title).slice(0, 6);
    role = id ? (role ? `${role}-${id}` : id) : role ? `${role}-${hash}` : `untitled-${hash}`;
  }
  return `${companyKey(company)}_${role}`;
}

const plain = (html: string) => html.replace(/<[^>]*>/g, " ").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** A fingerprint of what a posting says: company, role, place and the start of its text, ignoring case, spacing, punctuation and markup. */
export function contentFingerprint({ company, title, location, description }: { company: string; title: string; location: string; description: string }): string {
  return sha1([companyKey(company), titleKey(title), locationKey(location), plain(description).slice(0, 1000)].join("|")).slice(0, 16);
}

export type Relation = "same-url" | "same-role";

/**
 * How two postings are the same opening, strongest first, or null. The same address is the same posting. The same
 * company, role and place under another address is a repost or a copy on another board. The same role in another
 * place is a different opening (one role can be open in two cities).
 */
export function relation(a: Identified & { location?: string }, b: Identified & { location?: string }): Relation | null {
  const urlA = normalizeUrl(a.url);
  if (urlA && urlA === normalizeUrl(b.url)) return "same-url";
  if (!a.company.trim() || !a.title.trim() || !b.company.trim() || !b.title.trim()) return null;
  if (canonicalKey(a) === canonicalKey(b) && locationKey(a.location ?? "") === locationKey(b.location ?? "")) return "same-role";
  return null;
}
