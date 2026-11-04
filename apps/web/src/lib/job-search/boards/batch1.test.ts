import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { htmlToText } from "./html-text";
import { parseRecruitee, recruitee } from "./recruitee";
import { parseTeamtailor, teamtailor } from "./teamtailor";
import { parseWorkable, workable } from "./workable";

// Real recordings (GitHub Actions, 2026-11-04) of three public tenants named in career-ops's own examples: Workable's
// Hugging Face, Recruitee's Channable and Teamtailor's Podimo, cut to three postings each. See docs/sources/.
const real = (name: string) => readFileSync(join(__dirname, "fixtures/real", name), "utf8").replace(/\r\n/g, "\n");
const realJson = (name: string) => JSON.parse(real(name)) as unknown;
const reply = (body: string) => new Response(body, { status: 200 });
const urls = (seen: string[]) => (async (url: URL | string) => (seen.push(String(url)), reply("{}"))) as unknown as typeof fetch;

describe("Workable against a real recording", () => {
  const postings = parseWorkable(realJson("workable-widget.json"), { slug: "huggingface" }, "Hugging Face");

  it("maps every posting: id under its board, https link, plain text, the date it states", () => {
    expect(postings).toHaveLength(3);
    expect(postings[0]).toMatchObject({
      source: "WORKABLE",
      externalId: "huggingface:81B46579FE",
      title: "Open-Source Machine Learning Engineer - EMEA Remote",
      company: "Hugging Face",
      url: "https://apply.workable.com/j/81B46579FE",
      remote: true,
      postedAt: "2026-05-29T00:00:00.000Z",
      salary: null,
    });
    for (const posting of postings) {
      expect(posting.description).not.toMatch(/<\/?[a-z][^>]*>/i);
      expect(posting.description.length).toBeGreaterThan(50);
    }
  });

  it("shows the place a posting states, and nothing for a location the employer marked hidden", () => {
    expect(postings[0].location).toBe("Paris, Île-de-France, France");
    expect(postings[2].location).toBe("");
  });

  it("fetches the one widget address on its fixed host, and takes a board from a slug or its address", async () => {
    const seen: string[] = [];
    await workable.fetchBoard({ slug: "huggingface" }, "Hugging Face", { fetchImpl: urls(seen) });
    expect(seen).toEqual(["https://apply.workable.com/api/v1/widget/accounts/huggingface?details=true"]);
    await expect(workable.fetchBoard({ slug: "a/../b" }, "x", { fetchImpl: urls(seen) })).rejects.toMatchObject({ problem: "bad-slug" });
    expect(workable.refFrom("huggingface")).toEqual({ slug: "huggingface" });
    expect(workable.refFrom("https://apply.workable.com/huggingface/")).toEqual({ slug: "huggingface" });
    expect(workable.refFrom("https://apply.workable.com/huggingface/j/81B46579FE/")).toEqual({ slug: "huggingface" });
    expect(workable.refFrom("https://apply.workable.com/api/v1/widget/accounts/huggingface")).toEqual({ slug: "huggingface" });
    expect(workable.refFrom("https://apply.workable.com/j/81B46579FE")).toBeNull();
    expect(workable.refFrom("https://evil.example/apply.workable.com/huggingface")).toBeNull();
  });

  it("reads an answer that is not a board as an empty board", () => {
    expect(parseWorkable({ error: "x" }, { slug: "a" }, "A")).toEqual([]);
    expect(parseWorkable({ jobs: [{ title: "No link" }] }, { slug: "a" }, "A")).toEqual([]);
  });
});

describe("Recruitee against a real recording", () => {
  const postings = parseRecruitee(realJson("recruitee-offers.json"), { slug: "channable" }, "Channable");

  it("maps every offer: id under its board, the careers link, plain text, pay only from a real figure with its interval", () => {
    expect(postings).toHaveLength(3);
    expect(postings[0]).toMatchObject({
      source: "RECRUITEE",
      externalId: "channable:2814054",
      title: "Technical Writer, Customer Education",
      company: "Channable",
      location: "Utrecht, Utrecht, Netherlands",
      url: "https://jobs.channable.com/o/technical-writer-customer-education",
      remote: false,
      postedAt: "2026-11-03T20:08:14.000Z",
      salary: { min: 2976 * 12, max: 4252 * 12, currency: "EUR" },
    });
    expect(postings[1].salary).toEqual({ min: 100000, max: 120000, currency: "EUR" });
    // The text of an offer is its description and then its requirements, both as plain text.
    const offers = (realJson("recruitee-offers.json") as { offers: { description: string; requirements: string }[] }).offers;
    postings.forEach((posting, index) => {
      expect(posting.description).not.toMatch(/<\/?[a-z][^>]*>/i);
      expect(posting.description.startsWith(htmlToText(offers[index].description).slice(0, 40))).toBe(true);
      expect(posting.description).toContain(htmlToText(offers[index].requirements).slice(0, 40));
    });
  });

  it("builds the host from the tenant name only when it is one plain label, and takes a tenant from its address", async () => {
    const seen: string[] = [];
    await recruitee.fetchBoard({ slug: "channable" }, "Channable", { fetchImpl: urls(seen) });
    expect(seen).toEqual(["https://channable.recruitee.com/api/offers/"]);
    for (const bad of ["a.b", "Evil.test", "a/b", "-x", "a@b"]) await expect(recruitee.fetchBoard({ slug: bad }, "x", { fetchImpl: urls(seen) })).rejects.toMatchObject({ problem: "bad-slug" });
    expect(seen).toHaveLength(1);
    expect(recruitee.refFrom("channable")).toEqual({ slug: "channable" });
    expect(recruitee.refFrom("https://channable.recruitee.com/o/some-role")).toEqual({ slug: "channable" });
    expect(recruitee.refFrom("https://recruitee.com/terms")).toBeNull();
    expect(recruitee.refFrom("https://channable.recruitee.com.evil.test/")).toBeNull();
    expect(recruitee.refFrom("https://evil.test/channable.recruitee.com")).toBeNull();
  });

  it("leaves pay out when it has no interval it can read, or a minimum above the maximum", () => {
    const offer = (salary: unknown) => ({ offers: [{ id: 1, title: "T", careers_url: "https://x.recruitee.com/o/t", description: "d", salary }] });
    for (const salary of [{ min: "1", max: "2", period: "fortnight", currency: "EUR" }, { min: "9", max: "2", period: "year", currency: "EUR" }, { min: "x", max: "2", period: "year", currency: "EUR" }, { min: "1", max: "2", period: "year" }, null]) {
      expect(parseRecruitee(offer(salary), { slug: "x" }, "X")[0].salary, JSON.stringify(salary)).toBeNull();
    }
  });
});

describe("Teamtailor against a real recording", () => {
  const postings = parseTeamtailor(real("teamtailor-feed.xml"), { slug: "podimo" }, "Podimo");

  it("maps every item: the guid as id under its board, the link as given, plain text, the department's work model", () => {
    expect(postings).toHaveLength(3);
    expect(postings[0]).toMatchObject({
      source: "TEAMTAILOR",
      externalId: "podimo:edd96bd8-1400-446f-b650-c55c8a9a1ecd",
      title: "Creator Manager [Podads]",
      company: "Podimo",
      location: "Oslo, Norway",
      url: "https://careers.podimo.com/jobs/8608989-creator-manager-podads",
      remote: false,
      postedAt: "2026-10-23T12:11:53.000Z",
      salary: null,
    });
    // "hybrid" is neither remote nor on site: the feed's word is not turned into a yes or a no.
    expect(postings[2]).toMatchObject({ title: "Senior Backend Engineer, Membership (Payments)", remote: null, location: "Vilnius, Lithuania" });
    for (const posting of postings) {
      expect(posting.description).not.toMatch(/<\/?[a-z][^>]*>/i);
      expect(posting.description).not.toContain("&lt;");
    }
  });

  it("reads the feed as text from the tenant's own host only", async () => {
    const seen: string[] = [];
    await teamtailor.fetchBoard({ slug: "podimo" }, "Podimo", { fetchImpl: urls(seen) });
    expect(seen).toEqual(["https://podimo.teamtailor.com/jobs.rss"]);
    await expect(teamtailor.fetchBoard({ slug: "a.b" }, "x", { fetchImpl: urls(seen) })).rejects.toMatchObject({ problem: "bad-slug" });
    expect(teamtailor.refFrom("podimo")).toEqual({ slug: "podimo" });
    expect(teamtailor.refFrom("https://podimo.teamtailor.com/jobs")).toEqual({ slug: "podimo" });
    expect(teamtailor.refFrom("https://careers.podimo.com/jobs")).toBeNull();
    expect(teamtailor.refFrom("https://podimo.teamtailor.com.evil.test/jobs")).toBeNull();
  });

  it("does not follow markup in the feed: entities stay text, scripts and CDATA do not run into fields", () => {
    const feed = `<rss><channel><item><title>A &amp; B</title><description>&lt;script&gt;alert(1)&lt;/script&gt;&lt;p&gt;Hi&lt;/p&gt;</description><link>javascript:alert(1)</link><guid>g1</guid></item>
      <item><title><![CDATA[Real <b>job</b>]]></title><description>x</description><link>https://x.teamtailor.com/jobs/1</link><guid>g2</guid></item></channel></rss>`;
    const parsed = parseTeamtailor(feed, { slug: "x" }, "X");
    // The first has no usable link; the second keeps its CDATA title as text.
    expect(parsed.map((p) => p.externalId)).toEqual(["x:g2"]);
    expect(parsed[0].title).toBe("Real job");
    expect(parseTeamtailor("not xml at all", { slug: "x" }, "X")).toEqual([]);
  });
});
