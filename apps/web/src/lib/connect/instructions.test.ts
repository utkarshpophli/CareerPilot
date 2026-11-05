import { describe, expect, it } from "vitest";

import { mcpUrl, redirectProblem } from "@/lib/connector/oauth";

import { CHECKED, claudeCodeInstructions, cliEnvironment, OPENCODE_REDIRECT_URI, openCodeInstructions, safeOrigin } from "./instructions";

describe("safeOrigin", () => {
  it("keeps only the origin of a web address", () => {
    expect(safeOrigin("https://cp.example.com/")).toBe("https://cp.example.com");
    expect(safeOrigin("https://cp.example.com/some/path?x=1#y")).toBe("https://cp.example.com");
    expect(safeOrigin("http://localhost:3100")).toBe("http://localhost:3100");
    expect(safeOrigin("http://[::1]:3100/")).toBe("http://[::1]:3100");
  });

  it("refuses anything that is not http(s), so nothing odd lands in a shell command", () => {
    for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "ftp://x", "not a url", ""]) {
      expect(() => safeOrigin(bad)).toThrow(/web address/);
    }
  });

  it("cannot be tricked into carrying shell syntax in the host", () => {
    const origin = safeOrigin("https://a.example/'; rm -rf ~ #");
    expect(origin).toBe("https://a.example");
    expect(origin).not.toMatch(/['";$`\\\s]/);
  });
});

describe("the connector address", () => {
  it("is the one the server itself uses", () => {
    expect(claudeCodeInstructions("https://cp.example.com").add.endsWith(mcpUrl("https://cp.example.com"))).toBe(true);
    expect(openCodeInstructions("https://cp.example.com").add.endsWith(mcpUrl("https://cp.example.com"))).toBe(true);
  });
});

describe("Claude Code", () => {
  it("adds the server over HTTP, then signs in with /mcp (checked against claude 2.1.316)", () => {
    const steps = claudeCodeInstructions("https://cp.example.com/");
    expect(steps.add).toBe("claude mcp add --transport http careerpilot https://cp.example.com/api/mcp");
    expect(steps.signIn).toBe("/mcp");
    expect(steps.skills).toBe("node apps/cli/pilot.mjs skills export --target claude-code");
  });
});

describe("OpenCode", () => {
  const steps = openCodeInstructions("https://cp.example.com");

  it("adds the server with its own command (checked against opencode 1.19.4)", () => {
    expect(steps.add).toBe("opencode mcp add careerpilot --url https://cp.example.com/api/mcp");
    expect(steps.auth).toBe("opencode mcp auth careerpilot");
    expect(steps.skills).toBe("node apps/cli/pilot.mjs skills export --target opencode");
  });

  it("gives an opencode.json in the shape OpenCode's schema defines", () => {
    const config = JSON.parse(steps.config) as Record<string, unknown>;
    expect(config).toEqual({
      $schema: "https://opencode.ai/config.json",
      mcp: { careerpilot: { type: "remote", url: "https://cp.example.com/api/mcp" } },
      instructions: [".opencode/careerpilot.md"],
    });
    expect(steps.config.endsWith("\n")).toBe(true);
  });

  it("names the OAuth callback OpenCode uses, and CareerPilot's connector accepts it", () => {
    expect(OPENCODE_REDIRECT_URI).toBe("http://127.0.0.1:19876/mcp/oauth/callback");
    expect(steps.redirectUri).toBe(OPENCODE_REDIRECT_URI);
    expect(redirectProblem(OPENCODE_REDIRECT_URI)).toBeNull();
  });
});

describe("cliEnvironment", () => {
  it("shows both shells with the server's address", () => {
    const env = cliEnvironment("https://cp.example.com/", "cp_abc123");
    expect(env.posix).toBe("export CAREERPILOT_URL='https://cp.example.com'\nexport CAREERPILOT_TOKEN='cp_abc123'");
    expect(env.powershell).toBe('$env:CAREERPILOT_URL = "https://cp.example.com"\n$env:CAREERPILOT_TOKEN = "cp_abc123"');
  });

  it("uses a placeholder, never an empty token, when none is shown", () => {
    expect(cliEnvironment("https://cp.example.com").posix).toContain("CAREERPILOT_TOKEN='<your token>'");
  });

  it("refuses a token with characters that would break out of the quotes", () => {
    expect(() => cliEnvironment("https://cp.example.com", "cp_a'; rm -rf ~; '")).toThrow(/token/);
    expect(() => cliEnvironment("https://cp.example.com", 'cp_a"; calc; "')).toThrow(/token/);
  });
});

describe("what was checked", () => {
  it("records the tool versions and the date the commands were verified, to re-verify on release", () => {
    expect(CHECKED.claudeCode.version).toBe("2.1.316");
    expect(CHECKED.openCode.version).toBe("1.19.4");
    expect(CHECKED.on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
