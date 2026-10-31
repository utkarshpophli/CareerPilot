import { describe, expect, it } from "vitest";

import { platformFromUrl, platformOfApplication } from "./platform";

describe("platformFromUrl", () => {
  it.each([
    ["https://boards.greenhouse.io/acme/jobs/123", "greenhouse"],
    ["https://job-boards.greenhouse.io/acme/jobs/123", "greenhouse"],
    ["https://jobs.lever.co/acme/abc", "lever"],
    ["https://jobs.ashbyhq.com/acme/abc", "ashby"],
    ["https://acme.wd5.myworkdayjobs.com/en-US/careers/job/x", "workday"],
    ["https://www.linkedin.com/jobs/view/123", "linkedin"],
    ["https://uk.indeed.com/viewjob?jk=1", "indeed"],
    ["https://www.indeed.co.uk/viewjob?jk=1", "indeed"],
    ["https://de.glassdoor.com/job/1", "glassdoor"],
    ["https://news.ycombinator.com/item?id=1", "hackernews"],
  ])("recognises %s as %s", (url, name) => {
    expect(platformFromUrl(url)).toBe(name);
  });

  it("falls back to the registrable domain for company sites", () => {
    expect(platformFromUrl("https://careers.acme.com/jobs/1")).toBe("acme.com");
    expect(platformFromUrl("https://www.acme.com/jobs/1")).toBe("acme.com");
    expect(platformFromUrl("https://jobs.acme.co.uk/1")).toBe("acme.co.uk");
    expect(platformFromUrl("https://acme.io")).toBe("acme.io");
  });

  it("is empty for nothing usable", () => {
    expect(platformFromUrl("")).toBe("");
    expect(platformFromUrl("not a url")).toBe("");
    expect(platformFromUrl("mailto:jobs@acme.com")).toBe("");
    expect(platformFromUrl("javascript:alert(1)")).toBe("");
  });

  it("does not take a look-alike host for a known site", () => {
    expect(platformFromUrl("https://notlever.co/x")).toBe("notlever.co");
    expect(platformFromUrl("https://greenhouse.io.evil.com/x")).toBe("evil.com");
  });
});

describe("platformOfApplication", () => {
  it("prefers the posting's address, then the aggregator, then nothing", () => {
    expect(platformOfApplication({ postingUrl: "https://jobs.lever.co/a/b", postingSource: "ADZUNA" })).toBe("lever");
    expect(platformOfApplication({ postingUrl: "", postingSource: "ADZUNA" })).toBe("adzuna");
    expect(platformOfApplication({ postingUrl: "" })).toBe("");
  });
});
