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

## Not built yet

A command-line client (`pilot`) and per-agent API tokens are planned (see `MASTER_PLAN.md`, phase 6). Until then MCP is the way in for assistants.
