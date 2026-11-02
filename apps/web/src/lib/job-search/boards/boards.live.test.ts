import { describe, expect, it } from "vitest";

import { boardAdapter, type BoardSource } from "./index";

// Checks against the real Greenhouse, Lever and Ashby, skipped unless asked
// for and never run in CI. Each reads one public board (name it with the
// matching variable, or the default is used) and checks that what comes back
// still has the shape the parser expects. It is the check that the fixtures
// still look like the real thing.
//
//   BOARDS_LIVE=greenhouse BOARDS_LIVE_GREENHOUSE=stripe node_modules/.bin/vitest run src/lib/job-search/boards/boards.live.test.ts
//   BOARDS_LIVE=lever,ashby BOARDS_LIVE_LEVER=… BOARDS_LIVE_ASHBY=… node_modules/.bin/vitest run …

const live = new Set((process.env.BOARDS_LIVE ?? "").split(",").map((name) => name.trim().toUpperCase()));

const DEFAULT_BOARD: Record<BoardSource, string> = { GREENHOUSE: "stripe", LEVER: "palantir", ASHBY: "openai" };

describe.each(["GREENHOUSE", "LEVER", "ASHBY"] as const)("%s (live)", (source) => {
  it.skipIf(!live.has(source))("reads a real board into postings with a title, a link and an id", async () => {
    const slug = process.env[`BOARDS_LIVE_${source}`] || DEFAULT_BOARD[source];
    const postings = await boardAdapter(source).fetchBoard({ slug }, slug);
    expect(postings.length).toBeGreaterThan(0);
    for (const posting of postings.slice(0, 20)) {
      expect(posting.title).not.toBe("");
      expect(posting.url).toMatch(/^https:\/\//);
      expect(posting.externalId.startsWith(`${slug}:`)).toBe(true);
    }
  }, 60_000);
});
