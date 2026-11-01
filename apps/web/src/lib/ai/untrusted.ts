// Untrusted text (postings, emails, resumes) goes to the model inside a tag
// such as <posting>...</posting>, and the system message says it is material to
// read, not instructions to follow. That only holds if the text cannot close the
// tag itself and continue with "SYSTEM: ..." outside it (audit B-07). Inside the
// text, those tags are turned into look-alikes with a typographic bracket: same
// length, still readable, no longer a tag.

const FENCE_TAG = /<(\/?)(posting|email|resume|earlier)\b/gi;

/** `text` with every fence tag defused, so it cannot end or fake the block it is placed in. */
export function neutralizeFences(text: string): string {
  return text.replace(FENCE_TAG, "‹$1$2");
}

/** A mail header (From, Subject) as one line with fence tags defused: a line break would start a fake field or block. */
export function headerValue(value: string): string {
  return neutralizeFences(value.replace(/\s+/g, " ").trim());
}
