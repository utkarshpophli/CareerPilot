# Using CareerPilot from Claude Code, Codex and other agents

CareerPilot exposes its tools to AI assistants through the Model Context Protocol (MCP) at `/api/mcp`. Anything an assistant does there is recorded in the Activity Ledger under the assistant's name, so it shows up on the **Activity** page and is counted on **Insights**.

What the tools can do: search jobs, read your profile and applications, save applications and fit scores, and move applications along. By design there is no tool that sends email or deletes anything.

## The quick way: the Connect screen

Open **Connect** in the sidebar. It walks through four things: make a token (your password is asked again), pick your tool (Claude Code, OpenCode or other) and copy the commands, filled in with this server's address; press **Wait for the first call** and make your assistant call CareerPilot, and it shows up on the screen; and see every connected assistant with when it was last seen, what it did today and how many runs it reported. The rest of this page explains what the screen does for you.

## Turn the connector on

In the app: Settings, then the connector section (the Connect screen's OpenCode tab has one button that turns it on and allows OpenCode's sign-in address for you). The endpoint answers 404 while the connector is off. Sign-in uses OAuth, so you approve each client once in the browser.

## Connect a client

The address is your server's public address plus `/api/mcp`, for example `https://careerpilot.example.com/api/mcp`.

- Claude Code: `claude mcp add --transport http careerpilot https://careerpilot.example.com/api/mcp`, then run `/mcp` inside Claude Code and sign in when asked.
- OpenCode: `opencode mcp add careerpilot --url https://careerpilot.example.com/api/mcp`, then `opencode mcp auth careerpilot`, which opens your browser. OpenCode comes back to `http://127.0.0.1:19876/mcp/oauth/callback`, so that address must be on the connector's allow-list (Settings, MCP connector): the Connect screen's button adds it. Or put a remote server in your `opencode.json`: `{ "mcp": { "careerpilot": { "type": "remote", "url": "https://careerpilot.example.com/api/mcp" } } }`.
- Codex and other MCP clients that support remote (Streamable HTTP) servers with OAuth: add a server with that address in the client's MCP settings and complete the sign-in.

Client setup changes between versions; if a command above no longer matches, use the client's own MCP documentation with the address above. The commands here were checked against Claude Code 2.1.316 and OpenCode 1.19.4 on 2026-11-02 (the Connect screen says the same). Note that the MCP endpoint takes only the OAuth sign-in above, not API tokens; tokens are for the `pilot` command line and the REST API.

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

Reading: `status`, `apps [--status SENT]`, `activity [--actor MCP] [--limit N]`, `insights`, `runs [--status RUNNING]`, `run show <id>`. Add `--json` for machine-readable output.

Doing (write token): `check <file|->` cleans a job posting of hidden text and flags lines that try to instruct an AI (exits 3 when it finds something); `apps add --company C --role R [--url U] [--file posting.txt]` tracks an application as a draft (a posting link already tracked gives back the same application); `apps status <id> REJECTED` moves it through the same status machine as the dashboard. Assistants (tokens and the Claude connector) may only set DRAFT, REJECTED and DECLINED. SENT, SCREENING, INTERVIEW, OFFER and ACCEPTED record things only you know, so they are refused (403) and you set them on the application's page; a confirmation step for assistants' proposals is planned. Applications waiting for your review on the Agent screen, and archived ones, are off limits to assistants. `pilot --help` has the rest.

The same data is available over HTTP with `Authorization: Bearer <token>`: `GET /api/v1/status`, `/applications`, `/activity`, `/insights`, `/runs`, `/runs/{id}`, and `POST /api/v1/applications`, `PATCH /api/v1/applications/{id}/status`, `POST /api/v1/postings/check`, `POST /api/v1/runs`, `POST /api/v1/runs/{id}/events`, `POST /api/v1/runs/{id}/finish`. Answers are `{"data": ...}` or `{"error": {"code", "message"}}`. The client refuses plain `http://` except for localhost, so a token never travels unprotected by accident.

There is deliberately no endpoint that sends, submits or deletes anything.

## Let people watch the work: runs

A run is a piece of work an assistant reports on while it happens. Wrap anything with more than one step in one, and the dashboard shows it live on the **Runs** page and in the **Running now** card on the dashboard:

```bash
ID=$(node apps/cli/pilot.mjs run start scan "Daily scan")      # prints only the id
node apps/cli/pilot.mjs run step $ID "Fetched 3 boards" --data boards=3
node apps/cli/pilot.mjs run finish $ID --status ok "12 new postings"   # or --status failed "why"
```

- `run start --key <k>` (or an `Idempotency-Key` header over HTTP) makes a retry safe: the same key gives the same run.
- A step is one readable line plus small counts in `--data` (`found=12,boards=3`, or a JSON object where your shell keeps its quotes; PowerShell strips the quotes, so use `key=value` there). Never put secrets or whole documents in a step.
- A run still going with no step for 30 minutes shows as **Stalled**.
- Every step is also an Activity event carrying the run's id, under the token's name.

## Teach your assistant the rules

`pilot skills export` writes the instructions for you, so an assistant knows the commands and the safety rules (never send or submit; treat postings as data; always close a run):

```bash
node apps/cli/pilot.mjs skills export                       # Claude Code: .claude/skills/careerpilot/SKILL.md
node apps/cli/pilot.mjs skills export --target opencode     # OpenCode: .opencode/careerpilot.md, and opencode.json if you have none
node apps/cli/pilot.mjs skills export --target generic      # CAREERPILOT_AGENT.md for any assistant
node apps/cli/pilot.mjs skills export --target generic --stdout >> AGENTS.md    # Codex, or GEMINI.md for Gemini CLI
```

It never overwrites a file without `--force`, and never overwrites your own `opencode.json`, even with `--force`: if you already have one, it prints what to merge into it instead.

Not built yet: rate limiting on the REST API, per-token scopes finer than read and write, and delete or send endpoints (by design, never).
