# Using CareerPilot from Claude Code, Codex and other agents

CareerPilot exposes its tools to AI assistants through the Model Context Protocol (MCP) at `/api/mcp`. Anything an assistant does there is recorded in the Activity Ledger under the assistant's name, so it shows up on the **Activity** page and is counted on **Insights**.

What the tools can do: search jobs, read your profile and applications, save applications and fit scores, and move applications along. By design there is no tool that sends email or deletes anything.

## Turn the connector on

In the app: Settings, then the connector section. The endpoint answers 404 while the connector is off. Sign-in uses OAuth, so you approve each client once in the browser.

## Connect a client

The address is your server's public address plus `/api/mcp`, for example `https://careerpilot.example.com/api/mcp`.

- Claude Code: `claude mcp add --transport http careerpilot https://careerpilot.example.com/api/mcp`, then run `/mcp` inside Claude Code and sign in when asked.
- Codex and other MCP clients that support remote (Streamable HTTP) servers with OAuth: add a server with that address in the client's MCP settings and complete the sign-in.

Client setup changes between versions; if a command above no longer matches, use the client's own MCP documentation with the address above.

## What you will see

- Activity page: each tool call (`Claude Code used search_jobs`), and the changes it caused, with the client's name.
- Posting checks: postings that arrive through an assistant go through the same hidden-text and prompt-injection check as pasted ones. Warnings appear in Activity as counts only.

## The `pilot` command line and REST API

For assistants that work through a shell (Claude Code, Codex and others), and for scripts. It needs Node 20 or later and no installation: run `apps/cli/pilot.mjs`.

1. Make a token: in the app, Settings, then **API tokens** (name it, choose read or write, copy the token once). Or on the server: `yarn create-token "claude-code on my laptop" write`. Only a hash is stored. Revoke a token in the same Settings page and it stops working at once. The name you give is what the Activity page shows for everything the token does.
2. Point the client at your server:

```bash
export CAREERPILOT_URL=https://careerpilot.example.com
export CAREERPILOT_TOKEN=cp_...
node apps/cli/pilot.mjs status
```

Commands: `status`, `apps [--status SENT]`, `activity [--actor MCP] [--limit N]`, `insights`, and `check <file|->`, which cleans a job posting of hidden text and flags lines that try to instruct an AI (needs a write token; exits 3 when it finds something). Add `--json` for machine-readable output. `pilot --help` has the rest.

The same data is available over HTTP at `/api/v1/status`, `/applications`, `/activity`, `/insights` and `POST /api/v1/postings/check`, with `Authorization: Bearer <token>`. Answers are `{"data": ...}` or `{"error": {"code", "message"}}`. The client refuses plain `http://` except for localhost, so a token never travels unprotected by accident.

Not built yet: rate limiting and write endpoints for applications.
