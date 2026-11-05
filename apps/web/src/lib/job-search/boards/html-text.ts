// HTML to plain text for postings that arrive as markup, ported from
// career-ops (MIT, Santiago Fernández de Valderrama):
//   upstream/career-ops/providers/_html-entities.mjs
//   upstream/career-ops/providers/_html-to-text.mjs
// The result is data: it still goes through the posting guard before anything
// stores it or hands it to a model.

/** The XML five and nbsp, then Latin-1 letters and the punctuation boards put around titles. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", aring: "å", aelig: "æ", ccedil: "ç",
  egrave: "è", eacute: "é", ecirc: "ê", euml: "ë", igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
  ntilde: "ñ", ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", oslash: "ø",
  ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", yacute: "ý", yuml: "ÿ", szlig: "ß",
  Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Auml: "Ä", Aring: "Å", AElig: "Æ", Ccedil: "Ç",
  Egrave: "È", Eacute: "É", Ecirc: "Ê", Euml: "Ë", Igrave: "Ì", Iacute: "Í", Icirc: "Î", Iuml: "Ï",
  Ntilde: "Ñ", Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ", Ouml: "Ö", Oslash: "Ø",
  Ugrave: "Ù", Uacute: "Ú", Ucirc: "Û", Uuml: "Ü", Yacute: "Ý",
  deg: "°", hellip: "…", laquo: "«", raquo: "»", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", middot: "·", euro: "€",
};

const CASE_INSENSITIVE_NAMES = new Set(["amp", "lt", "gt", "quot", "apos", "nbsp"]);

/**
 * Whether a numeric reference names a code point that is safe to put in a title
 * or a stored posting: XML 1.0 section 2.2 Char (so no NUL, no C0 controls
 * except tab, LF and CR, no lone surrogates, no U+FFFE or U+FFFF).
 */
function isEmittableCodePoint(code: number): boolean {
  return code === 0x9 || code === 0xa || code === 0xd || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff);
}

/** Decodes named and numeric HTML references; anything unknown or unsafe stays as written. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return isEmittableCodePoint(code) ? String.fromCodePoint(code) : match;
    }
    // Letter entities are case-sensitive (&Eacute; is É); only the XML five and nbsp are not.
    if (Object.hasOwn(NAMED_ENTITIES, body)) return NAMED_ENTITIES[body]!;
    const lower = body.toLowerCase();
    return CASE_INSENSITIVE_NAMES.has(lower) ? NAMED_ENTITIES[lower]! : match;
  });
}

/** The default cap for a short field. */
export const DESCRIPTION_CAP = 4000;

/** A whole posting body kept from a board: 10 KB is normal, and a runaway one must not fill the database. */
export const MAX_DESCRIPTION = 20_000;

// A tag ends at an unquoted ">" (attribute values may hold angle brackets) and
// starts with "<" followed by a letter, "/", "!" or "?", the only openers an
// HTML tokenizer reads as markup. So "teams of <10 engineers" is prose.
const TAG = /<(?=[a-z/!?])(?:[^>"']|"[^"]*"|'[^']*')+>/gi;
const SCRIPT_OR_STYLE = /<(script|style)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>/gi;

const stripMarkup = (content: string) => content.replace(SCRIPT_OR_STYLE, " ").replace(TAG, " ");

/**
 * Markup, possibly entity-escaped twice (Greenhouse sends `&lt;p&gt;`), to plain
 * text. Each decode is followed by a strip, so escaped active markup cannot
 * become the final output; a trailing unfinished tag opener loses its "<".
 */
export function htmlToText(content: unknown, { cap = DESCRIPTION_CAP }: { cap?: number } = {}): string {
  if (typeof content !== "string" || !content) return "";
  const decoded = decodeEntities(stripMarkup(content));
  const decodedTwice = decodeEntities(stripMarkup(decoded));
  return stripMarkup(decodedTwice)
    .replace(/<(?=\/?[a-z!?])/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, cap);
}
