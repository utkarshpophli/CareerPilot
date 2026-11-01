// Finding HTML elements in text we do not control (emails, scraped pages)
// without regular expressions that can take minutes. A lazy pattern such as
// /<style[\s\S]*?<\/style>/ rescans to the end of the text from every opener
// that has no closer, so 100,000 of them cost ten billion steps. These
// functions walk the text once.

/** Lower-cases ASCII letters only, so every index stays the same (toLowerCase can change a string's length). */
const asciiLower = (text: string) => text.replace(/[A-Z]/g, (letter) => String.fromCharCode(letter.charCodeAt(0) + 32));

/**
 * Replaces each `<name ...>inner</name>` with what `replace` returns for its
 * attributes and inner text; returning undefined keeps the element as it was.
 * An opener with no closer is left alone, and so is everything after it: if
 * one has no closer, no later one has either. Not for nested elements of the
 * same name (the first closer ends the element), like the patterns it replaces.
 */
export function replaceElements(html: string, name: string, replace: (attributes: string, inner: string) => string | undefined): string {
  const lower = asciiLower(html);
  const open = `<${name}`;
  const close = `</${name}`;
  let out = "";
  let position = 0;
  for (;;) {
    let start = lower.indexOf(open, position);
    // The name has to end there: <a, not <abbr.
    while (start !== -1 && !/[\s>/]/.test(lower[start + open.length] ?? "")) start = lower.indexOf(open, start + 1);
    if (start === -1) break;
    const tagEnd = lower.indexOf(">", start + open.length);
    if (tagEnd === -1) break;
    const closeAt = lower.indexOf(close, tagEnd + 1);
    if (closeAt === -1) break;
    const closeEnd = lower.indexOf(">", closeAt + close.length);
    if (closeEnd === -1) break;
    const replacement = replace(html.slice(start + open.length, tagEnd), html.slice(tagEnd + 1, closeAt));
    out += html.slice(position, start) + (replacement ?? html.slice(start, closeEnd + 1));
    position = closeEnd + 1;
  }
  return out + html.slice(position);
}

/** Removes whole elements, with their content, for each of `names`. */
export function removeElements(html: string, names: string[]): string {
  return names.reduce((text, name) => replaceElements(text, name, () => ""), html);
}
