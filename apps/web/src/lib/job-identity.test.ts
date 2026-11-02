import { describe, expect, it } from "vitest";

import { canonicalKey, companyKey, contentFingerprint, normalizeUrl, relation, titleKey } from "./job-identity";

// Identity and dedup for postings (M4d.1). The rules come from career-ops (url-key.mjs, dedup-tracker.mjs)
// and ai-job-search (tools/job_key.py), both MIT: a key is a pure function of the posting, never truncated
// differently from one run to the next, and "no key" is never a value that can match another "no key".

describe("normalizeUrl", () => {
  it("makes the same posting the same key whatever tracking, order, case or slash it arrives with", () => {
    const a = normalizeUrl("http://www.Example.com/jobs/123/?utm_source=x&gh_src=abc&b=2&a=1#apply");
    const b = normalizeUrl("https://example.com/jobs/123?a=1&b=2");
    expect(a).toBe(b);
    expect(a).toBe("https://example.com/jobs/123?a=1&b=2");
  });

  it("keeps parameters that name the posting", () => {
    expect(normalizeUrl("https://boards.example.com/view?gh_jid=4012345&utm_campaign=z")).toBe("https://boards.example.com/view?gh_jid=4012345");
    expect(normalizeUrl("https://x.com/jobs?id=1")).not.toBe(normalizeUrl("https://x.com/jobs?id=2"));
  });

  it("gives no key for what is not a web address, and no key never equals another no key", () => {
    for (const bad of ["", "   ", "N/A", "TBD", "javascript:alert(1)", "mailto:a@b.c", "ftp://x.com/a", "not a url", undefined, null, 42]) {
      expect(normalizeUrl(bad as never), String(bad)).toBe("");
    }
    expect(relation({ url: "N/A", company: "", title: "" }, { url: "TBD", company: "", title: "" })).toBeNull();
  });

  it("does not treat a path that differs only in case as one posting where hosts do", () => {
    expect(normalizeUrl("https://EXAMPLE.com/Jobs/ABC")).toBe("https://example.com/Jobs/ABC");
  });
});

describe("companyKey and titleKey", () => {
  it("ignore legal suffixes, punctuation, case and accents", () => {
    for (const name of ["Acme Corp", "ACME, Inc.", "Acmé GmbH", "acme"]) expect(companyKey(name), name).toBe("acme");
    expect(companyKey("Müller & Söhne AG")).toBe("muller-sohne");
  });

  it("ignore gender markers and noise in titles, but keep what tells roles apart", () => {
    expect(titleKey("Senior Product Designer (m/f/d)")).toBe("senior-product-designer");
    expect(titleKey("Senior Product Designer (w/m/x)")).toBe("senior-product-designer");
    expect(titleKey("Senior Product Designer")).toBe("senior-product-designer");
    expect(titleKey("Product Designer")).not.toBe(titleKey("Senior Product Designer"));
    expect(titleKey("Backend Engineer (Payments)")).not.toBe(titleKey("Backend Engineer (Search)"));
  });

  it("never lets a name that folds to nothing collide with another", () => {
    const a = companyKey("Сбер");
    const b = companyKey("Яндекс");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^company-[0-9a-f]{6}$/);
    expect(companyKey("")).toBe("unknown-company");
    // A name that keeps only a fragment of itself ("Сбер AI" and "Яндекс AI" both fold to "ai") still differs.
    expect(companyKey("Сбер AI")).not.toBe(companyKey("Яндекс AI"));
  });
});

describe("canonicalKey", () => {
  it("is the same for the same company and role written differently", () => {
    expect(canonicalKey({ company: "Acme GmbH", title: "Product Designer (m/f/d)", url: "" })).toBe(canonicalKey({ company: "ACME", title: "product designer", url: "https://x.com/1" }));
  });

  it("is safe as a key and a folder name, and the same on every run for a long title", () => {
    const title = "Principal Staff Distinguished Senior Engineer of Everything Platform and Infrastructure Reliability / Operations, Americas";
    const key = canonicalKey({ company: "A/B,C", title, url: "" });
    expect(key).toMatch(/^[a-z0-9][a-z0-9-]*_[a-z0-9][a-z0-9-]*$/);
    expect(key).toBe(canonicalKey({ company: "A/B,C", title, url: "" }));
    // Two long titles cut at the same place still differ.
    expect(canonicalKey({ company: "Acme", title: `${title} Alpha`, url: "" })).not.toBe(canonicalKey({ company: "Acme", title: `${title} Beta`, url: "" }));
  });

  it("falls back to the posting's own numeric id for a title in a script it cannot fold", () => {
    const a = canonicalKey({ company: "Acme", title: "Программист 1С", url: "https://x.com/jobs/1234567" });
    const b = canonicalKey({ company: "Acme", title: "Аналитик 1С", url: "https://x.com/jobs/7654321" });
    expect(a).not.toBe(b);
  });
});

describe("contentFingerprint", () => {
  const base = { company: "Acme", title: "Designer", location: "Berlin", description: "We build maps. You design them.  Figma required." };

  it("ignores whitespace, case and markup differences in the description", () => {
    expect(contentFingerprint(base)).toBe(contentFingerprint({ ...base, description: "we BUILD maps. you design them. figma   required." }));
  });

  it("differs when the role, the place or the substance differs", () => {
    expect(contentFingerprint(base)).not.toBe(contentFingerprint({ ...base, location: "Paris" }));
    expect(contentFingerprint(base)).not.toBe(contentFingerprint({ ...base, description: "A completely different job at the same company." }));
  });

  it("has a fingerprint even without a description, from company, role and place", () => {
    expect(contentFingerprint({ ...base, description: "" })).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("relation", () => {
  const posting = { company: "Acme", title: "Designer", location: "Berlin", description: "Build maps.", url: "https://acme.example/jobs/1" };

  it("says how two postings are the same opening, strongest first", () => {
    expect(relation(posting, { ...posting, url: "http://www.acme.example/jobs/1/?utm_source=a" })).toBe("same-url");
    expect(relation(posting, { ...posting, url: "https://other.example/x/2" })).toBe("same-role");
    expect(relation(posting, { ...posting, company: "Other", title: "Cook", url: "https://other.example/x/2" })).toBeNull();
  });

  it("calls a different place or text at the same company and role a different opening, not a repost", () => {
    // One role at one company can be open in two cities at once.
    expect(relation({ ...posting, url: "https://a.example/1" }, { ...posting, location: "Paris", url: "https://a.example/2" })).toBeNull();
  });
});
