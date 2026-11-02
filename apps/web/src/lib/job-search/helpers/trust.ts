// A light check of whether a posting's link looks like the employer's own. Ported from career-ops (MIT, Santiago
// Fernández de Valderrama): upstream/career-ops/providers/_trust-validator.mjs. It flags, it never drops: a posting that
// looks odd is shown with the reason and the owner decides.

/** Shorteners and form hosts: a posting's apply link should not hide where it goes. */
export const DEFAULT_SUSPICIOUS_DOMAINS = ["bit.ly", "tinyurl.com", "t.co", "forms.gle", "goo.gl", "shorturl.at", "rebrand.ly", "cutt.ly"];

/** Job platforms where a posting legitimately lives on the platform's domain, not the employer's. */
export const DEFAULT_ATS_ALLOWLIST = [
  "greenhouse.io", "ashbyhq.com", "lever.co", "workday.com", "smartrecruiters.com", "jobvite.com", "myworkdayjobs.com", "recruitee.com", "workable.com",
  "icims.com", "taleo.net", "applytojob.com", "breezy.hr", "jazz.co", "bamboohr.com", "teamtailor.com", "paylocity.com", "join.com",
];

const PENALTY = { invalid_url: 50, missing_apply_url: 40, suspicious_domain: 25, company_domain_mismatch: 15 } as const;
export type TrustFlag = keyof typeof PENALTY;
export type TrustLevel = "high" | "medium" | "low";
export type Trust = { score: number; flags: TrustFlag[]; level: TrustLevel };

export const classifyTrustLevel = (score: number): TrustLevel => (score >= 90 ? "high" : score >= 60 ? "medium" : "low");

export function validateUrl(url: string): { valid: true } | { valid: false; flag: "invalid_url" } {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? { valid: true } : { valid: false, flag: "invalid_url" };
  } catch {
    return { valid: false, flag: "invalid_url" };
  }
}

/** Whether a host is a listed domain or a subdomain of one ("go.bit.ly" is "bit.ly"; "orbit.ly" is not). */
export const matchesDomainList = (hostname: string, domains: readonly string[]) => domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));

const SPECIAL_LETTERS: Record<string, string> = { ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ł: "l", þ: "th" };

/**
 * A company name as lower-case ASCII words for comparing with a hostname: accents folded to their base letter
 * ("Société Générale" is "societe generale"), punctuation deleted (not turned into a space, which would make
 * "Smith&Jones" the word "smith" and hide a mismatch). "" when nothing Latin remains.
 */
export function asciiFoldForHostname(company: string): string {
  return company
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[ßæœøđłþ]/g, (letter) => SPECIAL_LETTERS[letter] ?? "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whether the company plausibly belongs to the host: its whole name, or any word of three or more letters, appears in it. True when it cannot be judged. */
export function companyMatchesHostname(company: string, hostname: string): boolean {
  if (!company || !hostname) return true;
  const folded = asciiFoldForHostname(company);
  // A name with no Latin letters can never appear in an ASCII hostname, so its absence proves nothing.
  if (!folded) return true;
  if (hostname.includes(folded.replace(/\s+/g, ""))) return true;
  return folded.split(/\s+/).filter((word) => word.length >= 3).some((word) => hostname.includes(word));
}

/** The trust of a posting from its link and company: starts at 100, loses points per flag. */
export function trustCheck(
  job: { url?: string | null; company?: string | null },
  { suspiciousDomains = DEFAULT_SUSPICIOUS_DOMAINS, atsAllowlist = DEFAULT_ATS_ALLOWLIST }: { suspiciousDomains?: readonly string[]; atsAllowlist?: readonly string[] } = {},
): Trust {
  const done = (score: number, flags: TrustFlag[]): Trust => {
    const clamped = Math.max(0, Math.min(100, score));
    return { score: clamped, flags, level: classifyTrustLevel(clamped) };
  };
  const url = typeof job.url === "string" ? job.url.trim() : "";
  if (!url) return done(100 - PENALTY.missing_apply_url, ["missing_apply_url"]);
  if (!validateUrl(url).valid) return done(100 - PENALTY.invalid_url, ["invalid_url"]);

  const hostname = new URL(url).hostname.toLowerCase();
  const flags: TrustFlag[] = [];
  let score = 100;
  if (matchesDomainList(hostname, suspiciousDomains.map((domain) => domain.toLowerCase()))) {
    flags.push("suspicious_domain");
    score -= PENALTY.suspicious_domain;
  }
  const company = typeof job.company === "string" ? job.company.trim() : "";
  if (company && !matchesDomainList(hostname, atsAllowlist.map((domain) => domain.toLowerCase())) && !companyMatchesHostname(company, hostname)) {
    flags.push("company_domain_mismatch");
    score -= PENALTY.company_domain_mismatch;
  }
  return done(score, flags);
}

/** Each flag in words for the Review page: what looked odd, and why it matters. */
export const TRUST_FLAG_TEXT: Record<TrustFlag, string> = {
  missing_apply_url: "The posting has no link to apply or read more.",
  invalid_url: "The posting's link is not a web address.",
  suspicious_domain: "The link goes through a shortener or form host, so you cannot see where it leads.",
  company_domain_mismatch: "The company's name does not appear in the link's address, and the link is not on a known job platform.",
};
