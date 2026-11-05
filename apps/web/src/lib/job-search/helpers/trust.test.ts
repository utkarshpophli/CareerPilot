import { describe, expect, it } from "vitest";

import { classifyTrustLevel, companyMatchesHostname, matchesDomainList, trustCheck, validateUrl } from "./trust";

// Ported with its cases from career-ops (MIT): providers/_trust-validator.mjs. It flags, it never drops: a posting that
// looks odd is shown with the reason, not hidden.

describe("trustCheck", () => {
  it("rates an employer's own posting on a matching domain as high", () => {
    expect(trustCheck({ url: "https://careers.acme.com/jobs/1", company: "Acme" })).toEqual({ score: 100, flags: [], level: "high" });
  });

  it("flags a missing, malformed or non-web link, and stops there", () => {
    expect(trustCheck({ url: "", company: "Acme" })).toEqual({ score: 60, flags: ["missing_apply_url"], level: "medium" });
    expect(trustCheck({ company: "Acme" })).toMatchObject({ flags: ["missing_apply_url"] });
    for (const url of ["not a url", "javascript:alert(1)", "ftp://x.com/a", "mailto:a@b.c"]) expect(trustCheck({ url, company: "Acme" }), url).toEqual({ score: 50, flags: ["invalid_url"], level: "low" });
  });

  it("flags a link shortener, subdomains included", () => {
    expect(trustCheck({ url: "https://bit.ly/abc", company: "" })).toMatchObject({ flags: ["suspicious_domain"], score: 75 });
    expect(trustCheck({ url: "https://go.bit.ly/abc", company: "" })).toMatchObject({ flags: ["suspicious_domain"] });
    expect(trustCheck({ url: "https://forms.gle/x", company: "" }).flags).toContain("suspicious_domain");
  });

  it("flags a company that has nothing to do with the domain, but not on a known job platform", () => {
    expect(trustCheck({ url: "https://totally-other.example/job", company: "Acme Robotics" })).toMatchObject({ flags: ["company_domain_mismatch"], score: 85, level: "medium" });
    expect(trustCheck({ url: "https://job-boards.greenhouse.io/acme/jobs/1", company: "Acme Robotics" }).flags).toEqual([]);
    expect(trustCheck({ url: "https://jobs.lever.co/acme/1", company: "Zzz" }).flags).toEqual([]);
    expect(trustCheck({ url: "https://app.dover.com/x", company: "Acme", }).flags).toEqual(["company_domain_mismatch"]);
  });

  it("stacks flags, never goes below 0, and takes the owner's own lists", () => {
    const both = trustCheck({ url: "https://bit.ly/x", company: "Acme" });
    expect(both.flags).toEqual(["suspicious_domain", "company_domain_mismatch"]);
    expect(both.score).toBe(60);
    expect(trustCheck({ url: "https://corp.example/job", company: "Acme" }, { suspiciousDomains: ["corp.example"], atsAllowlist: ["corp.example"] }).flags).toEqual(["suspicious_domain"]);
  });
});

describe("companyMatchesHostname", () => {
  it("folds accents so a name matches its own domain", () => {
    expect(companyMatchesHostname("Société Générale", "careers.societegenerale.com")).toBe(true);
    expect(companyMatchesHostname("Müller & Söhne", "mueller-soehne.de")).toBe(false); // ü is not ue: only the base letter is kept
    expect(companyMatchesHostname("Müller", "muller.de")).toBe(true);
  });

  it("matches on the whole name or on any word of three or more letters", () => {
    expect(companyMatchesHostname("Acme Robotics", "robotics.example")).toBe(true);
    expect(companyMatchesHostname("Go AI", "unrelated.example")).toBe(false);
    // Punctuation is deleted, not turned into a separator: "Smith&Jones" must not become the word "smith", which would match smithfield.com and hide a mismatch.
    expect(companyMatchesHostname("Smith&Jones", "smithfield.com")).toBe(false);
    expect(companyMatchesHostname("Smith&Jones", "smithjones.com")).toBe(true);
  });

  it("cannot judge a name with no Latin letters, so it does not flag it", () => {
    expect(companyMatchesHostname("Сбер", "sber.example")).toBe(true);
    expect(companyMatchesHostname("", "x.example")).toBe(true);
    expect(companyMatchesHostname("Acme", "")).toBe(true);
  });
});

describe("small pieces", () => {
  it("classifies the level at 90 and 60", () => {
    expect([100, 90, 89, 60, 59, 0].map(classifyTrustLevel)).toEqual(["high", "high", "medium", "medium", "low", "low"]);
  });

  it("checks that a link is a web address", () => {
    expect(validateUrl("https://a.example")).toEqual({ valid: true });
    expect(validateUrl("javascript:alert(1)")).toEqual({ valid: false, flag: "invalid_url" });
  });

  it("matches a host to a list by exact name or as a subdomain, not as a suffix of another name", () => {
    expect(matchesDomainList("go.bit.ly", ["bit.ly"])).toBe(true);
    expect(matchesDomainList("bit.ly", ["bit.ly"])).toBe(true);
    expect(matchesDomainList("orbit.ly", ["bit.ly"])).toBe(false);
  });
});
