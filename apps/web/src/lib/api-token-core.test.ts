import { describe, expect, it } from "vitest";

import { bearerToken, cleanTokenName, generateToken, hashToken } from "./api-token-core";

describe("generateToken", () => {
  it("makes distinct, prefixed tokens whose hash matches", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.token).toMatch(/^cp_[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(hashToken(a.token));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.token.startsWith(a.prefix)).toBe(true);
    expect(a.hash).not.toContain(a.token);
  });
});

describe("bearerToken", () => {
  it("reads our own tokens from an Authorization header", () => {
    expect(bearerToken("Bearer cp_abc")).toBe("cp_abc");
    expect(bearerToken("bearer   cp_abc")).toBe("cp_abc");
  });

  it("ignores anything else", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Basic cp_abc")).toBeNull();
    expect(bearerToken("Bearer other_token")).toBeNull();
    expect(bearerToken("Bearer cp_a b")).toBeNull();
    expect(bearerToken(`Bearer cp_${"x".repeat(300)}`)).toBeNull();
  });
});

describe("cleanTokenName", () => {
  it("keeps a short readable line", () => {
    expect(cleanTokenName("  claude-code @ laptop  ")).toBe("claude-code @ laptop");
    expect(cleanTokenName("a\nb‮<script>")).toBe("abscript");
    expect(cleanTokenName("x".repeat(100))).toHaveLength(60);
  });
});
