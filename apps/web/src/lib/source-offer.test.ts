import { describe, expect, it } from "vitest";

import { REPOSITORY_URL } from "./releases";
import { sourceUrlFor } from "./source-offer";

// Audit C-02: the AGPL needs users of a network service to be able to get its source. The link
// is to the exact commit the running build was made from, when that is known.

describe("sourceUrlFor", () => {
  it("links to the exact commit the build was made from", () => {
    expect(sourceUrlFor("0123456789abcdef0123456789abcdef01234567")).toBe(`${REPOSITORY_URL}/tree/0123456789abcdef0123456789abcdef01234567`);
    expect(sourceUrlFor("abc1234")).toBe(`${REPOSITORY_URL}/tree/abc1234`);
  });

  it("falls back to the repository when the commit is unknown or not a commit id", () => {
    for (const bad of [undefined, "", "main", "abc", "not-a-sha", "0123456789abcdef0123456789abcdef012345678", "../../etc/passwd", "abc1234; rm -rf /"]) {
      expect(sourceUrlFor(bad), String(bad)).toBe(REPOSITORY_URL);
    }
  });
});
