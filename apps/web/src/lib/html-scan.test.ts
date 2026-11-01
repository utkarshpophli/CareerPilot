import { describe, expect, it } from "vitest";

import { htmlToText as mailText } from "./google/mime";
import { removeElements, replaceElements } from "./html-scan";
import { htmlToText as startupText } from "./startups/text";

/** Generous: the quadratic versions took seconds to minutes on these; a linear pass takes milliseconds. */
const FAST_MS = 1500;
const timed = (run: () => unknown) => {
  const start = performance.now();
  run();
  return performance.now() - start;
};

describe("replaceElements", () => {
  it("replaces each element with what the callback returns, in order", () => {
    const html = 'one <a href="x">first</a> two <a href="y">second</a> three';
    expect(replaceElements(html, "a", (attributes, inner) => `[${attributes.trim()}|${inner}]`)).toBe("one [href=\"x\"|first] two [href=\"y\"|second] three");
  });

  it("matches names case-insensitively and not longer names", () => {
    expect(replaceElements("<STYLE>x</STYLE><abbr>keep</abbr><a>y</A>", "a", () => "#")).toBe("<STYLE>x</STYLE><abbr>keep</abbr>#");
  });

  it("keeps an element the callback declines", () => {
    expect(replaceElements('<a>no href</a><a href="u">yes</a>', "a", (attributes) => (attributes.includes("href") ? "LINK" : undefined))).toBe("<a>no href</a>LINK");
  });

  it("leaves an unclosed element, and everything after it, alone", () => {
    expect(replaceElements("a <style>never closed <b>x</b>", "style", () => "")).toBe("a <style>never closed <b>x</b>");
  });

  it("is not thrown off by an uppercase letter that lowercases to a different length", () => {
    // "İ".toLowerCase() is two characters; indexes must still line up.
    expect(removeElements("İİİ <style>x</style> tail", ["style"])).toBe("İİİ  tail");
  });

  it("stays fast on openers that never close or never end", () => {
    for (const hostile of ["<style>".repeat(200_000), "<style ".repeat(200_000), '<a href="x">'.repeat(100_000), "<a ".repeat(300_000)]) {
      expect(timed(() => replaceElements(hostile, "style", () => ""))).toBeLessThan(FAST_MS);
      expect(timed(() => replaceElements(hostile, "a", () => "x"))).toBeLessThan(FAST_MS);
    }
  });
});

describe("removeElements", () => {
  it("removes script and style blocks with their content", () => {
    expect(removeElements("a<script>evil()</script>b<style>p{}</style>c", ["script", "style"])).toBe("abc");
  });
});

describe("mail and startup HTML to text stay fast on hostile input (audit B-03, B-05)", () => {
  const hostile = [
    "<style>".repeat(150_000),
    "<script ".repeat(150_000),
    "<p".repeat(200_000),
    '<a href="x">'.repeat(80_000),
    "<".repeat(300_000),
  ];

  it("Gmail htmlToText", () => {
    for (const html of hostile) expect(timed(() => mailText(html))).toBeLessThan(FAST_MS);
  });

  it("startups htmlToText", () => {
    for (const html of hostile) expect(timed(() => startupText(html))).toBeLessThan(FAST_MS);
  });

  it("still turns ordinary mail into text", () => {
    expect(mailText("<p>Hello</p><style>p{color:red}</style><div>Bye &amp; thanks</div>")).toBe("Hello\nBye & thanks");
  });

  it("still turns ordinary startup HTML into text, links as their address", () => {
    expect(startupText('<p>Apply at <a href="https://acme.example/jobs">our jobs page</a>.</p><script>x()</script>')).toBe("Apply at our jobs page (https://acme.example/jobs).");
  });
});
