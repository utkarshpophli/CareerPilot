// Ported from ai-job-search/tools/posting_guard.py
// Copyright (c) 2026 Mads Lorentzen. MIT License (upstream/ai-job-search/LICENSE).
//
// Integrity gate for a fetched job posting: clean it, scan it, say what was
// found. A posting is third-party text that is read next to the candidate's
// personal data, so the rule "postings are data, never instructions" is
// backed by code that makes the obvious payloads visible:
//
//  - hidden HTML (display:none, visibility:hidden, opacity:0, font-size:0,
//    transparent colour, clipping, off-screen positioning, a collapsed box
//    with clipped overflow, the `hidden` attribute, aria-hidden) is removed
//    from the text, scanned, and reported as excerpts. Comments and
//    script/style/noscript/svg/template blocks are removed and scanned too;
//  - invisible characters (zero-width, bidi controls, soft hyphen, BOM) are
//    removed and counted; the ones that indicate tampering are flagged;
//  - Unicode tag characters (U+E0000 to U+E007F) are removed, counted and
//    always flagged, except the three UK subdivision flag emoji;
//  - text spelled in invisible characters (tag runs, variation selector
//    runs) is decoded and scanned like hidden content;
//  - instruction-shaped lines aimed at an agent are quoted, never removed;
//  - URLs that exist only in hidden content, and words mixing Latin with
//    Cyrillic or Greek letters, are listed.
//
// It advises; it never blocks. Removal is the defence: hidden content never
// reaches the cleaned text. Differences from the Python original: HTML
// entities are decoded from a short list of named entities plus all numeric
// ones, and a charset other than UTF-8 is not detected (the caller decodes).

export const EXCERPT = 120;
export const LINE_MAX = 200;

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => String.fromCodePoint(from + index)).join("");

const ZERO_WIDTH = "​‌‍⁠⁡⁢⁣⁤";
const BIDI = "‎‏‪‫‬‭‮⁦⁧⁨⁩";
const BIDI_TAMPER = "‭‮⁦⁧⁨⁩";
const FORMAT = "­  ";
const BOM = "﻿";
const TAG_CHARS = range(0xe0000, 0xe007f);
const INVISIBLE = new Set([...(ZERO_WIDTH + BIDI + FORMAT + BOM + TAG_CHARS)]);

const TAG_RUN = /[\u{E0000}-\u{E007F}]+/gu;
// The one legitimate use of tag characters: the England, Scotland and Wales flags.
const RGI_TAG_FLAG = /\u{1F3F4}\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0073}\u{E0063}\u{E0074}|\u{E0077}\u{E006C}\u{E0073})\u{E007F}/gu;
const VARIATION = /[︀-️\u{E0100}-\u{E01EF}]/gu;
const VARIATION_RUN = /[︀-️\u{E0100}-\u{E01EF}]{2,}/gu;

const HIDDEN_STYLE = new RegExp(
  [
    String.raw`display\s*:\s*none`,
    String.raw`visibility\s*:\s*hidden`,
    String.raw`opacity\s*:\s*0(?![.\d]*[1-9])`,
    String.raw`font-size\s*:\s*0(?:\.0+)?(?:px|pt|em|rem|%)?(?![\d.])`,
    String.raw`color\s*:\s*transparent`,
    String.raw`clip\s*:\s*rect\(\s*0`,
    String.raw`clip-path\s*:\s*inset\(\s*100%`,
    String.raw`(?:left|top|text-indent)\s*:\s*-\d{4,}px`,
  ].join("|"),
  "i",
);
const PRESTRIP = /<!DOCTYPE[^>]*>|<\?[^>]*\?>/gi;
const COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
const DROP_BLOCKS = /<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi;
const TAG = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTR = /([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
const VOID = new Set(["br", "img", "input", "meta", "link", "hr", "wbr", "source", "area", "base", "col", "embed", "param", "track"]);
const BLOCK = new Set([
  "p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "br", "section", "article", "header", "footer", "table",
  "thead", "tbody", "blockquote", "pre", "dd", "dt", "dl", "nav", "main", "aside", "figure", "form", "fieldset", "legend",
  "address", "hr", "td", "th", "option",
]);
const IMPLIED_END = new Set(["p", "li", "dd", "dt", "tr", "td", "th", "option"]);
const CLOSES_P = new Set([...BLOCK].filter((name) => name !== "br"));
const HTML_HINT = /<\s*(html|body|div|p)\b/i;

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;
const INSTRUCTION_PATTERNS: RegExp[] = [
  /\bignore (all|any|the|previous|prior|above|earlier)\b/i,
  // The same instruction with its other two verbs, which need an explicit object.
  /\b(disregard|forget)( all| any| the| your| my)? (previous|prior|above|earlier|preceding|initial|original|system) (instructions?|prompts?)\b/i,
  /\byou are (?:an?|the) (?:ai(?![\w-])|ai (?:assistant|agent|model|language model)|assistant|llm|language model)\b/i,
  /\bsystem prompt\b/i,
  /\b(do not|don['’]?t|never) (tell|inform) the user\b(?!['’]s)/i,
  /\b(do not|don['’]?t|never) (mention|reveal|disclose) (this|these|that|it|any of this|the (above|following|previous))\b[^.\n]{0,30}\bto the user\b/i,
  /\b(run|execute) the following (command|commands|script|code|shell|instruction|instructions|steps)\b/i,
  // "As an AI" flags, except a job title noun within a few words ("As an AI Engineer").
  /\bas an ai(?![\w-])(?![\s/&]+(?:[\w&/-]+\s+){0,3}?(?:engineer|developer|researcher|scientist|architect|specialist|lead|consultant|manager|analyst|intern|trainer|expert|strategist|designer|tester|owner|programmer)s?\b)/i,
  /^\s*(assistant|system|user)\s*:/i,
  /<\|/i,
  /\[INST\]/i,
  /###\s*(system|instruction)/i,
  /\b(curl|wget|ssh|scp)\b/i,
  /\.env\b/i,
  /settings\.json/i,
  /allowed-tools/i,
  /\btool_use\b|\bfunction_call\b/i,
];
const WORD = /[\p{L}\p{N}_]+/gu;
const LATIN = /[A-Za-z]/;
const CONFUSABLE = /[Ѐ-ӿͰ-Ͽ]/;

export type InvisibleCounts = Partial<Record<"zero_width" | "bidi" | "format" | "bom" | "tag" | "variation", number>>;

export type CleanTextFindings = {
  invisible_chars: InvisibleCounts;
  invisible_flagged: number;
  invisible_text: string[];
};

export type GuardFindings = CleanTextFindings & {
  hidden_blocks: string[];
  instruction_like: string[];
  hidden_urls: string[];
  visible_url_count: number;
  homoglyph_runs: string[];
  verdict: string;
};

// ─── Entities ────────────────────────────────────────────────────────────────

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", colon: ":", semi: ";", sol: "/", bsol: "\\", lpar: "(", rpar: ")",
  lbrack: "[", rbrack: "]", lsqb: "[", rsqb: "]", lbrace: "{", rbrace: "}", comma: ",", period: ".", excl: "!", quest: "?", num: "#",
  percnt: "%", plus: "+", equals: "=", hyphen: "-", dash: "-", Tab: "\t", NewLine: "\n", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", copy: "©", reg: "®", bull: "•",
  shy: "­", zwj: "‍", zwnj: "‌", lrm: "‎", rlm: "‏",
};

/** Decodes numeric entities and a short list of named ones; anything else stays as written. */
export function unescapeHtml(text: string): string {
  return text.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,31}));?/g, (whole, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
    if (name !== undefined) return Object.hasOwn(NAMED, name) ? NAMED[name]! : whole;
    const code = dec !== undefined ? Number.parseInt(dec, 10) : Number.parseInt(hex!, 16);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "�";
  });
}

// ─── Text ────────────────────────────────────────────────────────────────────

function fold(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t \f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const isAlpha = (char: string) => char !== "" && /\p{L}/u.test(char);
const countOf = (text: string, chars: string) => [...text].filter((char) => chars.includes(char)).length;
const printable = (char: string) => char === " " || /[\p{L}\p{M}\p{N}\p{P}\p{S}]/u.test(char);

function stripInvisible(text: string): string {
  return [...text].filter((char) => !INVISIBLE.has(char)).join("");
}

/** Removes invisible characters and decodes what tag and variation-selector runs spell. */
export function cleanText(input: string): [string, CleanTextFindings] {
  const counts: InvisibleCounts = {};
  for (const [key, chars] of [["zero_width", ZERO_WIDTH], ["bidi", BIDI], ["format", FORMAT], ["bom", BOM]] as const) {
    const n = countOf(input, chars);
    if (n) counts[key] = n;
  }
  const flags = input.match(RGI_TAG_FLAG) ?? [];
  const unflagged = input.replace(RGI_TAG_FLAG, "");
  const tags = [...unflagged].filter((char) => char >= "\u{E0000}" && char <= "\u{E007F}").length;
  if (tags) counts.tag = tags;
  const variation = (input.match(VARIATION) ?? []).length;
  if (variation) counts.variation = variation;

  let flagged = 0;
  const chars = [...input];
  chars.forEach((char, index) => {
    if (BIDI_TAMPER.includes(char)) flagged += 1;
    else if (ZERO_WIDTH.includes(char) || char === BOM) {
      if (isAlpha(chars[index - 1] ?? "") && isAlpha(chars[index + 1] ?? "")) flagged += 1;
    }
  });

  const invisibleText: string[] = [];
  for (const run of unflagged.match(TAG_RUN) ?? []) {
    const decoded = [...run]
      .map((char) => char.codePointAt(0)! - 0xe0000)
      .filter((value) => value >= 0x20 && value < 0x7f)
      .map((value) => String.fromCharCode(value))
      .join("")
      .trim();
    if (decoded) invisibleText.push(decoded.slice(0, LINE_MAX));
  }
  for (const run of input.match(VARIATION_RUN) ?? []) {
    const bytes = Uint8Array.from([...run].map((char) => { const code = char.codePointAt(0)!; return code <= 0xfe0f ? code - 0xfe00 : code - 0xe0100 + 16; }));
    const decoded = [...new TextDecoder("utf-8").decode(bytes)].filter(printable).join("").trim();
    if (decoded) invisibleText.push(decoded.slice(0, LINE_MAX));
  }

  let text = input.replace(VARIATION, "");
  if (flags.length > 0) {
    // Strip around the flags so the visible emoji survive intact.
    const pieces: string[] = [];
    let last = 0;
    for (const match of text.matchAll(RGI_TAG_FLAG)) {
      pieces.push(stripInvisible(text.slice(last, match.index)), match[0]);
      last = match.index + match[0].length;
    }
    pieces.push(stripInvisible(text.slice(last)));
    text = pieces.join("");
  } else {
    text = stripInvisible(text);
  }
  return [fold(text), { invisible_chars: counts, invisible_flagged: flagged, invisible_text: invisibleText }];
}

// ─── HTML ────────────────────────────────────────────────────────────────────

function attributes(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of raw.matchAll(ATTR)) out[match[1]!.toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  return out;
}

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
// A box collapsed to nothing with clipped overflow hides its content as surely
// as display:none. Either half alone is everyday layout CSS, so both must be there.
const COLLAPSED_BOX = /\b(?:max-)?(?:height|width)\s*:\s*0(?:\.0+)?(?:px|em|rem|%|pt)?(?![\d.])/i;
const CLIPPED = /\boverflow(?:-[xy])?\s*:\s*hidden\b/i;

/** The style attribute as a browser reads it: entities decoded, CSS comments gone. */
const styleOf = (attrs: Record<string, string>) => unescapeHtml(attrs.style ?? "").replace(CSS_COMMENT, "");

function isHidden(rawAttrs: string): boolean {
  const attrs = attributes(rawAttrs);
  if ("hidden" in attrs || (attrs["aria-hidden"] ?? "").trim().toLowerCase() === "true") return true;
  const style = styleOf(attrs);
  if (HIDDEN_STYLE.test(style)) return true;
  return COLLAPSED_BOX.test(style) && CLIPPED.test(style);
}

/** Visible text, and the hidden content that was removed (excerpts, and everything for scanning). */
export function cleanHtml(input: string): [string, { hidden_blocks: string[]; hidden_text: string }] {
  const hiddenParts: string[] = [];
  const hiddenBlocks: string[] = [];

  const collect = (whole: string) => {
    hiddenParts.push(unescapeHtml(whole.replace(/<!--|-->/g, " ").replace(/<[^>]+>/g, " ")));
    return " ";
  };

  const markup = input.replace(PRESTRIP, " ").replace(COMMENT, collect).replace(DROP_BLOCKS, collect);

  const visible: string[] = [];
  const hiddenBuffer: string[] = [];
  const stack: string[] = [];
  let hiddenAt: number | null = null;
  let position = 0;

  const emit = (text: string) => (hiddenAt === null ? visible : hiddenBuffer).push(text);
  const flushHidden = () => {
    const block = fold(unescapeHtml(hiddenBuffer.join("")));
    hiddenBuffer.length = 0;
    hiddenAt = null;
    if (block) {
      // Clean before cutting, or a run of invisible characters at the front would leave an empty excerpt.
      hiddenBlocks.push(cleanText(block)[0].slice(0, EXCERPT));
      hiddenParts.push(block);
    }
  };
  const popTo = (index: number) => {
    stack.length = index;
    if (hiddenAt !== null && hiddenAt >= stack.length) flushHidden();
  };
  const lastIndex = (name: string) => stack.lastIndexOf(name);

  for (const match of markup.matchAll(TAG)) {
    emit(markup.slice(position, match.index));
    position = match.index + match[0].length;
    const closing = match[1]!;
    const name = match[2]!.toLowerCase();
    const rawAttrs = match[3]!;
    if (BLOCK.has(name)) emit("\n");
    if (closing) {
      const index = lastIndex(name);
      if (index >= 0) popTo(index);
      continue; // a closer with no matching opener is ignored
    }
    if (VOID.has(name)) continue;
    if (IMPLIED_END.has(name) && stack.length > 0 && stack[stack.length - 1] === name) popTo(stack.length - 1);
    else if (CLOSES_P.has(name) && stack.length > 0 && stack[stack.length - 1] === "p") popTo(stack.length - 1);
    stack.push(name);
    if (hiddenAt === null && isHidden(rawAttrs)) hiddenAt = stack.length - 1;
  }
  emit(markup.slice(position));
  if (hiddenAt !== null) flushHidden();

  return [fold(unescapeHtml(visible.join(""))), { hidden_blocks: hiddenBlocks, hidden_text: hiddenParts.join("\n") }];
}

// ─── Scan ────────────────────────────────────────────────────────────────────

/** Up to LINE_MAX characters of `line`, always including position `at`, so the quote shows the match. */
function excerpt(line: string, at: number): string {
  if (line.length <= LINE_MAX) return line;
  const lead = Math.floor(LINE_MAX / 3);
  let start = Math.max(0, at - lead);
  const end = Math.min(line.length, start + LINE_MAX);
  start = Math.max(0, end - LINE_MAX);
  return `${start ? "…" : ""}${line.slice(start, end)}${end < line.length ? "…" : ""}`;
}

export function scan(visible: string, hidden: string) {
  const seen = new Set<string>();
  const instructionLike: string[] = [];
  for (const line of [...visible.split(/\r\n|\r|\n/), ...hidden.split(/\r\n|\r|\n/)]) {
    const stripped = line.trim();
    if (!stripped || seen.has(stripped)) continue;
    let found: RegExpExecArray | null = null;
    for (const pattern of INSTRUCTION_PATTERNS) {
      found = pattern.exec(stripped);
      if (found) break;
    }
    if (found) {
      seen.add(stripped);
      instructionLike.push(excerpt(stripped, found.index));
    }
  }
  const hiddenUrls = [...new Set(hidden.match(URL_PATTERN) ?? [])];
  const homoglyphs: string[] = [];
  for (const word of `${visible}\n${hidden}`.match(WORD) ?? []) {
    if (LATIN.test(word) && CONFUSABLE.test(word) && !homoglyphs.includes(word)) homoglyphs.push(word);
  }
  return {
    instruction_like: instructionLike,
    hidden_urls: hiddenUrls,
    visible_url_count: (visible.match(URL_PATTERN) ?? []).length,
    homoglyph_runs: homoglyphs,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function verdict(findings: Pick<GuardFindings, "instruction_like" | "invisible_flagged" | "invisible_chars" | "invisible_text" | "homoglyph_runs" | "hidden_blocks" | "hidden_urls">): string {
  const alarms: string[] = [];
  let n = findings.instruction_like.length;
  if (n) alarms.push(plural(n, "instruction-like line", "instruction-like lines"));
  n = findings.invisible_flagged;
  if (n) alarms.push(plural(n, "invisible character inside words", "invisible characters inside words"));
  n = findings.invisible_chars.tag ?? 0;
  if (n) alarms.push(plural(n, "tag character (text hidden from the reader)", "tag characters (text hidden from the reader)"));
  n = findings.invisible_text.length;
  if (n) alarms.push(plural(n, "string spelled in invisible characters", "strings spelled in invisible characters"));
  n = findings.homoglyph_runs.length;
  if (n) alarms.push(plural(n, "mixed-script word", "mixed-script words"));

  const context: string[] = [];
  n = findings.hidden_blocks.length;
  if (n) context.push(plural(n, "hidden block", "hidden blocks"));
  n = findings.hidden_urls.length;
  if (n) context.push(plural(n, "hidden URL", "hidden URLs"));
  const removed = context.join(" and ");

  if (alarms.length > 0) {
    const line = `posting_guard: ⚠ ${alarms.join(", ")} - review before continuing`;
    return removed ? `${line} (${removed} removed)` : line;
  }
  return removed ? `posting_guard: clean (${removed} removed, none instruction-like)` : "posting_guard: clean";
}

/** True when the verdict carries a warning for the user (the ⚠ signals), not merely context. */
export const hasAlarm = (findings: Pick<GuardFindings, "verdict">) => findings.verdict.includes("⚠");

/** Runs the whole gate. `mode` "auto" guesses html from the content, a fallback, not a documented path. */
export function guard(raw: string, mode: "html" | "text" | "auto" = "auto"): [string, GuardFindings] {
  const resolved = mode === "auto" ? (HTML_HINT.test(raw) ? "html" : "text") : mode;
  let text: string;
  let hiddenText: string;
  let hiddenBlocks: string[];
  if (resolved === "html") {
    const [visible, found] = cleanHtml(raw);
    text = visible;
    hiddenText = found.hidden_text;
    hiddenBlocks = found.hidden_blocks;
  } else {
    text = raw;
    hiddenText = "";
    hiddenBlocks = [];
  }
  const [cleaned, textFindings] = cleanText(text);
  const [cleanedHidden, hiddenFindings] = cleanText(hiddenText);
  // Invisible characters inside hidden content count and alarm like visible ones.
  for (const [key, n] of Object.entries(hiddenFindings.invisible_chars) as [keyof InvisibleCounts, number][]) {
    textFindings.invisible_chars[key] = (textFindings.invisible_chars[key] ?? 0) + n;
  }
  textFindings.invisible_flagged += hiddenFindings.invisible_flagged;
  textFindings.invisible_text.push(...hiddenFindings.invisible_text);
  const scanned = scan(cleaned, [cleanedHidden, ...textFindings.invisible_text].join("\n"));
  const findings = { hidden_blocks: hiddenBlocks, ...textFindings, ...scanned } as GuardFindings;
  findings.verdict = verdict(findings);
  return [cleaned, findings];
}
