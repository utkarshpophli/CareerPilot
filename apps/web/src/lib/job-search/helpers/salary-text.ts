// Free-text pay, read only when the text states it. Ported from career-ops (MIT, Santiago Fernández de Valderrama):
// upstream/career-ops/providers/_salary-text.mjs, with Danish and German period words added for the Danish portals.
// Currency and period are never guessed: a figure for another period is refused rather than returned in the wrong unit.

/**
 * Rewrites a number's separators into a form parseFloat reads correctly. Both separators mean different things in
 * different markets (Denmark, Germany, Spain group thousands with a period and write cents after a comma; the US and UK
 * the other way round), so which means what is decided before either is touched: with both present the last is the
 * decimal point; with one, three digits after it (and no fourth) read as grouping.
 */
function canonicalizeSeparators(numStr: string): string {
  const lastComma = numStr.lastIndexOf(",");
  const lastDot = numStr.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    const grouping = decimal === "," ? "." : ",";
    return numStr.split(grouping).join("").replace(decimal, ".");
  }
  const separator = lastComma !== -1 ? "," : lastDot !== -1 ? "." : null;
  if (separator === null) return numStr;
  const grouped = new RegExp(`(\\d)\\${separator}(?=\\d{3}(?!\\d))`, "g");
  return numStr.replace(grouped, "$1").replace(separator, ".");
}

export type Amount = { min: number; max: number; mid: number };

const ANNUAL = /\s*(?:\/\s*(?:year|yr)|per\s+(?:year|annum)|pr\.?\s+år|pro\s+jahr|annual(?:ly)?|yearly|årligt|jährlich)\s*$/i;

/**
 * An amount or range ("80-90k", "$123,684—$254,644 USD", "45.000 - 55.000") as numbers. Annual suffixes and currency
 * tokens are stripped; another period leaves the text unparseable, so the answer is null and not a wrong figure.
 */
export function parseAmount(raw: unknown): Amount | null {
  let s = String(raw ?? "").trim();
  if (!s || s === "?" || s === "-" || /^(n\/?a|null)$/i.test(s)) return null;
  const stripAnnual = (value: string) => value.replace(ANNUAL, "").trim();
  s = stripAnnual(s);
  // Currency symbols anywhere (ranges repeat them), and a trailing three-letter code in any case; exactly three letters,
  // so a lone "k" suffix is never eaten and prose ("competitive") still fails the numeric match below.
  s = s.replace(/[€$£¥]/g, "").replace(/\s*[A-Za-z]{3}\s*$/, "").trim();
  s = stripAnnual(s);
  const toNumber = (text: string, thousands: boolean) => {
    const n = parseFloat(canonicalizeSeparators(text));
    return Number.isNaN(n) ? null : thousands ? n * 1000 : n;
  };
  const range = /^([\d.,]+)\s*(k)?\s*[-–—]\s*([\d.,]+)\s*(k)?$/i.exec(s);
  if (range) {
    const low = toNumber(range[1]!, Boolean(range[2] || range[4])); // "80-90k": k applies to both
    const high = toNumber(range[3]!, Boolean(range[4] || range[2]));
    if (low === null || high === null) return null;
    const min = Math.min(low, high);
    const max = Math.max(low, high);
    return { min, max, mid: (min + max) / 2 };
  }
  const single = /^([\d.,]+)\s*(k)?$/i.exec(s);
  if (single) {
    const value = toNumber(single[1]!, Boolean(single[2]));
    return value === null ? null : { min: value, max: value, mid: value };
  }
  return null;
}

export type Period = "annual" | "monthly" | "hourly";

/** The pay period a text names, or null when it names none. */
export function compensationPeriod(raw: unknown): Period | null {
  const value = String(raw ?? "");
  if (/(?:\/\s*(?:year|yr)\b|\bper\s+(?:year|annum)\b|\bpr\.?\s+år\b|\bom\s+året\b|\bpro\s+jahr\b|\bannual(?:ly)?\b|\byearly\b|\bårligt\b|\bjährlich\b)/i.test(value)) return "annual";
  if (/(?:\/\s*(?:month|mo)\b|\bper\s+month\b|\bpr\.?\s+måned\b|\bom\s+måneden\b|\bpro\s+monat\b|\bmonthly\b|\bmånedlig(?:t)?\b|\bmonatlich\b)/i.test(value)) return "monthly";
  if (/(?:\/\s*(?:hour|hr)\b|\bper\s+hour\b|\bpr\.?\s+time\b|\bpro\s+stunde\b|\bhourly\b)/i.test(value)) return "hourly";
  return null;
}

// Symbols that name exactly one currency. "$" does not (USD, CAD, AUD...).
const CURRENCY_SYMBOLS: Record<string, string> = { "€": "EUR", "£": "GBP" };
const CURRENCY_CODE = /(?<![A-Za-z])[A-Z]{3}(?![A-Za-z])/g;

/**
 * The currency a text names: its one capital three-letter code, else its one unambiguous symbol. `undefined` when it
 * names none (a bare "$" included), so the caller may fall back to another source; "" when it names more than one, so
 * no fallback overrides the text.
 */
export function compensationCurrency(raw: unknown): string | undefined {
  const text = String(raw ?? "");
  const codes = new Set(text.match(CURRENCY_CODE) ?? []);
  const symbols = new Set([...text].map((char) => CURRENCY_SYMBOLS[char]).filter(Boolean));
  if (codes.size === 1) return [...codes][0];
  if (codes.size === 0 && symbols.size === 1) return [...symbols][0];
  if (codes.size === 0 && symbols.size === 0) return undefined;
  return "";
}

/** parseAmount for a yearly figure whose text may repeat its currency after each end; null for another period or no amount. */
export function parseAnnualCompensation(raw: unknown): Amount | null {
  const text = String(raw ?? "");
  const period = compensationPeriod(text);
  if (period && period !== "annual") return null;
  return parseAmount(text.replace(CURRENCY_CODE, " ").replace(/\s+/g, " "));
}
