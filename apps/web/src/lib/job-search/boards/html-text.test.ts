import { describe, expect, it } from "vitest";

import { decodeEntities, DESCRIPTION_CAP, htmlToText } from "./html-text";

describe("decodeEntities", () => {
  it("decodes named, decimal and hex references, and leaves unknown names alone", () => {
    expect(decodeEntities("D&eacute;veloppeur &amp; Fran&ccedil;ais &#252; &#xfc; &madeup;")).toBe("Développeur & Français ü ü &madeup;");
  });

  it("is case-sensitive for letters but not for the XML five", () => {
    expect(decodeEntities("&Eacute; &eacute; &AMP; &Nbsp;")).toBe("É é &  ");
  });

  it("never emits a code point that would break what stores it", () => {
    // NUL, a lone surrogate, a noncharacter and a number past Unicode stay as written.
    expect(decodeEntities("&#0; &#xD800; &#xFFFF; &#99999999;")).toBe("&#0; &#xD800; &#xFFFF; &#99999999;");
    expect(decodeEntities("a&#9;b")).toBe("a\tb");
  });

  it("does not let a decimal reference swallow hex-looking letters", () => {
    expect(decodeEntities("&#1a2;")).toBe("&#1a2;");
  });
});

describe("htmlToText", () => {
  it("turns double-encoded markup (what Greenhouse sends) into plain text", () => {
    expect(htmlToText("&lt;p&gt;Build &amp;amp; ship &lt;strong&gt;things&lt;/strong&gt;&lt;/p&gt;")).toBe("Build & ship things");
  });

  it("drops scripts and styles with their contents, and tags with quoted brackets in attributes", () => {
    expect(htmlToText('<style>p{color:red}</style><p title="a > b">Hello</p><script>alert(1)</script>')).toBe("Hello");
  });

  it("keeps a less-than that is prose, not a tag", () => {
    expect(htmlToText("teams of &lt;10 engineers, pay &gt;150k")).toBe("teams of <10 engineers, pay >150k");
  });

  it("leaves nothing that could be read as markup, even when escaping is nested", () => {
    const text = htmlToText("&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;ok &lt;img src=x onerror=alert(1)");
    expect(text).not.toMatch(/<\s*\/?(script|img)/i);
    expect(text).toContain("ok");
  });

  it("collapses whitespace and caps the length", () => {
    expect(htmlToText("<p>a</p>\n\n   <p>b</p>")).toBe("a b");
    expect(htmlToText("x".repeat(DESCRIPTION_CAP + 500))).toHaveLength(DESCRIPTION_CAP);
    expect(htmlToText("x".repeat(100), { cap: 10 })).toHaveLength(10);
  });

  it("says nothing for what is not text", () => {
    expect(htmlToText(undefined)).toBe("");
    expect(htmlToText(42)).toBe("");
    expect(htmlToText("")).toBe("");
  });
});
