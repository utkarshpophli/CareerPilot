import { companyKey } from "./job-identity";

// Deterministic scoring of a posting against what the owner's profile and settings say (M4d.3). Code decides the
// number, from the posting and the preferences alone, the same every time, and every score carries the reasons for
// it. A model may help extract facts from a posting; it never sets the number. Weights are from ai-job-search's
// score bands and career-ops's A-to-G report, kept simple: title 35, skills 30, place 20, pay 10, freshness 5.
// A part that cannot be judged (no preference, or the posting does not say) is left out and the rest is scaled to
// 100, so a missing salary is neither a penalty nor a free point.

export const SCORE_VERSION = "board-score@1";

export type Preferences = {
  /** Roles wanted, as the owner writes them ("Product Designer"). */
  titles: string[];
  skills: string[];
  /** Cities or regions wanted. */
  places: string[];
  /** Whether remote work is wanted; "unknown" when nothing says. Never assumed. */
  remote: "yes" | "no" | "unknown";
  excludeKeywords: string[];
  excludeCompanies: string[];
  minSalary?: { amount: number; currency: string };
};

export type Scorable = {
  title: string;
  companyName: string;
  location: string;
  remote: boolean | null;
  description: string;
  salary: { min: number; max: number; currency: string } | null;
  postedAt: Date | null;
  guardAlarm: boolean;
};

export type Band = "excellent" | "good" | "possible" | "poor";
export type PostingScore = { score: number; band: Band; reasons: string[]; redFlags: string[]; vetoed: boolean; version: typeof SCORE_VERSION };

export const bandOf = (score: number): Band => (score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "possible" : "poor");

const WEIGHT = { title: 35, skills: 30, place: 20, pay: 10, fresh: 5 } as const;
const MAX_REASONS = 6;
const MAX_FLAGS = 4;
const FRESH_DAYS = 14;
const SKILLS_FOR_FULL_MARKS = 8;

const fold = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const words = (text: string) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const short = (text: string) => (text.length > 200 ? `${text.slice(0, 197)}...` : text);
const money = (amount: number, currency: string) => `${currency} ${amount.toLocaleString("en")}`.trim();

/** A phrase as a whole word or words: not inside another word, and "C++" or "C#" keep their symbols. */
function mentions(text: string, phrase: string, { caseSensitive = false } = {}): boolean {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escape(phrase.trim())}(?![\\p{L}\\p{N}+#])`, caseSensitive ? "u" : "iu");
  return pattern.test(text);
}

type Part = { weight: number; earned: number };

/** Scores one posting, or returns null when there are no preferences to compare it with. */
export function scorePosting(posting: Scorable, prefs: Preferences, now: Date): PostingScore | null {
  const text = `${posting.title}\n${posting.description}`;
  const reasons: string[] = [];
  const redFlags: string[] = [];

  // Vetoes first: what the owner excluded, whatever else matches.
  const vetoWord = prefs.excludeKeywords.map((word) => word.trim()).filter(Boolean).find((word) => mentions(fold(text), fold(word)));
  const vetoCompany = prefs.excludeCompanies.map((name) => name.trim()).filter(Boolean).find((name) => companyKey(name) === companyKey(posting.companyName));
  if (vetoWord || vetoCompany) {
    redFlags.push(short(vetoWord ? `Contains "${vetoWord}", which you excluded` : `${posting.companyName} is a company you excluded`));
    return { score: 0, band: "poor", reasons: [], redFlags, vetoed: true, version: SCORE_VERSION };
  }

  const parts: Part[] = [];
  let judged = 0; // parts that come from the owner's preferences, as opposed to freshness alone

  // Title: the whole phrase in the posting's title, else the share of its words that match.
  const titles = prefs.titles.map((title) => title.trim()).filter(Boolean);
  if (titles.length > 0) {
    judged++;
    const postingWords = new Set(words(posting.title));
    let best = 0;
    let bestTitle = titles[0]!;
    for (const wanted of titles) {
      const phrase = mentions(fold(posting.title), fold(wanted));
      const wantedWords = words(wanted);
      const shared = wantedWords.filter((word) => postingWords.has(word)).length;
      const ratio = wantedWords.length === 0 ? 0 : shared / wantedWords.length;
      const earned = phrase ? WEIGHT.title : ratio >= 0.6 ? WEIGHT.title * 0.6 : ratio >= 0.3 ? WEIGHT.title * 0.3 : 0;
      if (earned > best) {
        best = earned;
        bestTitle = wanted;
      }
    }
    parts.push({ weight: WEIGHT.title, earned: best });
    if (best === WEIGHT.title) reasons.push(short(`The title matches the role you want: ${bestTitle}`));
    else if (best > 0) reasons.push(short(`The title partly matches ${bestTitle}`));
  }

  // Skills: how many of the profile's skills the posting mentions, out of the first eight (a long list is not held against it).
  const skills = prefs.skills.map((skill) => skill.trim()).filter(Boolean);
  if (skills.length > 0) {
    judged++;
    const matched = skills.filter((skill) => mentions(text, skill, { caseSensitive: skill.length <= 2 }));
    const share = Math.min(1, matched.length / Math.min(skills.length, SKILLS_FOR_FULL_MARKS));
    parts.push({ weight: WEIGHT.skills, earned: WEIGHT.skills * share });
    if (matched.length > 0) reasons.push(short(`Mentions ${matched.length} of your skills: ${matched.slice(0, 5).join(", ")}`));
  }

  // Place: the posting is in one of the wanted places, or is remote and remote work is (or is not known to be) wanted.
  if (prefs.places.length > 0 || prefs.remote === "yes") {
    judged++;
    const place = prefs.places.map((name) => name.trim()).filter(Boolean).find((name) => mentions(fold(posting.location), fold(name)));
    let earned: number = 0;
    if (place) {
      earned = WEIGHT.place;
      reasons.push(short(`Located in ${place}, which you asked for`));
    } else if (posting.remote === true) {
      if (prefs.remote === "yes") {
        earned = WEIGHT.place;
        reasons.push("Remote, which you asked for");
      } else if (prefs.remote === "unknown") {
        earned = WEIGHT.place / 2;
        reasons.push("Remote; your profile does not say whether you want remote work");
      } else {
        redFlags.push("Remote, and you do not want remote work");
      }
    } else if (posting.location.trim()) {
      redFlags.push(short(`Located in ${posting.location.trim()}, outside the places you asked for`));
    }
    parts.push({ weight: WEIGHT.place, earned });
  }

  // Pay: only when the posting states it, in the same currency as the minimum. The top of the range is what counts.
  if (prefs.minSalary && posting.salary) {
    const minimum = prefs.minSalary;
    if (posting.salary.currency.toUpperCase() !== minimum.currency.toUpperCase()) {
      reasons.push(short(`Pay is stated in ${posting.salary.currency || "an unknown currency"} and your minimum is in ${minimum.currency}, so they are not compared`));
    } else {
      judged++;
      const meets = posting.salary.max >= minimum.amount;
      parts.push({ weight: WEIGHT.pay, earned: meets ? WEIGHT.pay : 0 });
      if (meets) reasons.push(short(`Pay up to ${money(posting.salary.max, posting.salary.currency)} meets your minimum of ${money(minimum.amount, minimum.currency)}`));
      else redFlags.push(short(`Pay up to ${money(posting.salary.max, posting.salary.currency)} is below your minimum of ${money(minimum.amount, minimum.currency)}`));
    }
  }

  // Freshness: posted within two weeks.
  if (posting.postedAt) {
    const days = (now.getTime() - posting.postedAt.getTime()) / 86_400_000;
    const fresh = days <= FRESH_DAYS;
    parts.push({ weight: WEIGHT.fresh, earned: fresh ? WEIGHT.fresh : 0 });
    if (fresh) reasons.push("Posted in the last two weeks");
  }

  if (judged === 0) return null;
  const total = parts.reduce((sum, part) => sum + part.weight, 0);
  const earned = parts.reduce((sum, part) => sum + part.earned, 0);
  let score = Math.round((earned / total) * 100);

  // Text that tries to instruct an AI is never recommended, however well it matches.
  if (posting.guardAlarm) {
    redFlags.push("The posting's text contains instruction-like lines aimed at an AI; read it yourself");
    score = Math.min(score, 49);
  }
  return { score, band: bandOf(score), reasons: reasons.slice(0, MAX_REASONS), redFlags: redFlags.slice(0, MAX_FLAGS), vetoed: false, version: SCORE_VERSION };
}
