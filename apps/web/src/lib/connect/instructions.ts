// What the Connect screen tells a person to copy, per tool. Pure: addresses
// and tokens in, text out, so every command is tested without a browser. It runs
// in the browser too, so it must not import anything that only runs on the server.
//
// The commands and the config shape were checked against the real tools, not
// guessed. Re-check them on each release and update CHECKED.

/** The versions the commands below were run against, and when. */
export const CHECKED = {
  claudeCode: { version: "2.1.316", note: "`claude mcp add --transport http <name> <url>`" },
  openCode: { version: "1.19.4", note: "`opencode mcp add <name> --url <url>`, `opencode mcp auth`, and the opencode.json shape (its own validator accepted it and rejected a wrong one)" },
  on: "2026-11-02",
} as const;

/** The MCP connector's address. Kept equal to `mcpUrl` in lib/connector/oauth.ts (a test checks), which cannot be imported here. */
const mcpUrl = (origin: string) => `${origin}/api/mcp`;

/** The name the server is added under in each tool. */
export const CONNECTOR_NAME = "careerpilot";

/** Where OpenCode sends the browser back to after sign-in. Read from OpenCode's own code (default `callbackPort` 19876); it must be on the connector's allow-list. */
export const OPENCODE_REDIRECT_URI = "http://127.0.0.1:19876/mcp/oauth/callback";

/** Where OpenCode reads its config schema from. */
export const OPENCODE_SCHEMA_URL = "https://opencode.ai/config.json";

/** Where the exported OpenCode instructions are written, relative to the project. */
export const OPENCODE_INSTRUCTIONS_PATH = ".opencode/careerpilot.md";

/** The origin of a web address, and nothing else, so a path or a quote in it can never reach a shell command. */
export function safeOrigin(address: string): string {
  const url = URL.canParse(address) ? new URL(address) : null;
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) throw new Error("The server's address must be a web address starting with https:// or http://.");
  return url.origin;
}

export type ClaudeCodeInstructions = { add: string; signIn: string; skills: string };

export function claudeCodeInstructions(origin: string): ClaudeCodeInstructions {
  return {
    add: `claude mcp add --transport http ${CONNECTOR_NAME} ${mcpUrl(safeOrigin(origin))}`,
    signIn: "/mcp",
    skills: "node apps/cli/pilot.mjs skills export --target claude-code",
  };
}

export type OpenCodeInstructions = { add: string; auth: string; config: string; redirectUri: string; skills: string };

export function openCodeInstructions(origin: string): OpenCodeInstructions {
  const url = mcpUrl(safeOrigin(origin));
  const config = { $schema: OPENCODE_SCHEMA_URL, mcp: { [CONNECTOR_NAME]: { type: "remote", url } }, instructions: [OPENCODE_INSTRUCTIONS_PATH] };
  return {
    add: `opencode mcp add ${CONNECTOR_NAME} --url ${url}`,
    auth: `opencode mcp auth ${CONNECTOR_NAME}`,
    config: `${JSON.stringify(config, null, 2)}\n`,
    redirectUri: OPENCODE_REDIRECT_URI,
    skills: "node apps/cli/pilot.mjs skills export --target opencode",
  };
}

/** API tokens are `cp_` and URL-safe base64; anything else could end a quoted string early. */
const TOKEN_SHAPE = /^cp_[A-Za-z0-9_-]{1,200}$/;

/** The two environment variables the `pilot` command line and scripts read, for POSIX shells and PowerShell. */
export function cliEnvironment(origin: string, token?: string): { posix: string; powershell: string } {
  const url = safeOrigin(origin);
  if (token !== undefined && !TOKEN_SHAPE.test(token)) throw new Error("That does not look like a CareerPilot token.");
  const shown = token ?? "<your token>";
  return {
    posix: `export CAREERPILOT_URL='${url}'\nexport CAREERPILOT_TOKEN='${shown}'`,
    powershell: `$env:CAREERPILOT_URL = "${url}"\n$env:CAREERPILOT_TOKEN = "${shown}"`,
  };
}
