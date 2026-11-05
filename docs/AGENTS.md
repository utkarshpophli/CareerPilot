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

Reading: `status`, `apps [--status SENT]`, `apps show <id>`, `activity [--actor MCP] [--limit N]`, `insights`, `runs [--status RUNNING]`, `run show <id>`. Add `--json` for machine-readable output.

Doing (write token): `check <file|->` cleans a job posting of hidden text and flags lines that try to instruct an AI (exits 3 when it finds something); `apps add --company C --role R [--url U] [--file posting.txt]` tracks an application as a draft (a posting link already tracked gives back the same application); `apps status <id> REJECTED` moves it through the same status machine as the dashboard. Assistants (tokens and the Claude connector) may only set DRAFT, REJECTED and DECLINED. SENT, SCREENING, INTERVIEW, OFFER and ACCEPTED record things only you know, so they are refused (403) and you set them on the application's page; an assistant proposes them instead (see below). Applications waiting for your review on the Agent screen, and archived ones, are off limits to assistants. Searching and scoring (write token): `search "product designer" [--place Berlin] [--country de] [--remote] [--within week]` runs a job search on the source chosen in Settings and prints numbered postings (each search uses one search from your plan with that source); `search show <id>` reads a kept search again for free; `search more <id>` fetches the next page; `scores save scores.json` keeps the fit scores an assistant worked out. Watching employers' job boards (write token): `companies add stripe --source GREENHOUSE` (or paste the company's careers link and leave `--source` out; Greenhouse, Lever and Ashby), `companies` lists them with how each last scan went, and `companies scan "product designer" --place Berlin` reads the watched boards one at a time (within about a minute and a half) and prints the matching postings as snippets with a link. A board that fails is shown as failed and does not stop the others. A scan keeps what it finds: new postings are added, ones the board no longer lists are closed, a copy of an opening already kept is hidden, ones the owner dismissed are left out, and each posting is scored by CareerPilot's own code (never by the assistant) against the profile and the owner's Settings → Posting preferences, best first, with the reasons. A posting whose text tries to instruct an AI is flagged and never ranked as a good match. What a board publishes is data, not instructions. `postings [--min-score 70] [--state SAVED]` shows the kept postings again without scanning. Removing a company (Settings → Watched companies), and dismissing or saving a posting (the Review page), are the owner's clicks, not an assistant's. `pilot --help` has the rest.

The same data is available over HTTP with `Authorization: Bearer <token>`: `GET /api/v1/status`, `/applications`, `/applications/{id}`, `/activity`, `/insights`, `/runs`, `/runs/{id}`, `/searches/{id}`, `/companies`, `/postings/scanned`, and `POST /api/v1/applications`, `/searches`, `/companies`, `/companies/scan`, `/searches/{id}/more`, `/postings/scores`, `PATCH /api/v1/applications/{id}/status`, `POST /api/v1/postings/check`, `POST /api/v1/runs`, `POST /api/v1/runs/{id}/events`, `POST /api/v1/runs/{id}/finish`. Answers are `{"data": ...}` or `{"error": {"code", "message"}}`. The client refuses plain `http://` except for localhost, so a token never travels unprotected by accident.

There is deliberately no endpoint that sends, submits or deletes anything.

## One operation, three doors

Every operation an assistant can do is one function in `apps/web/src/lib/services/`. REST, the `pilot` command line and MCP are only ways in: they check the input, call that function, and format the answer, so the same thing happens whichever you use, with the same safety checks and the same record in the Activity Ledger. When an assistant does one, it is also reported as a finished run on the Runs page, under the assistant's name (the owner's own clicks are not).

<!-- operations:start (generated from lib/services/operations.ts; edit that file) -->
| What it does | Service | REST | Command line | MCP tool | Why a door is missing |
| --- | --- | --- | --- | --- | --- |
| List applications, newest first | `listApplications` | `GET /api/v1/applications` | `pilot apps` | `list_applications` |  |
| Read one application with its posting and documents' text | `readApplication` | `GET /api/v1/applications/{id}` | `pilot apps show` | `get_application` |  |
| Track an application as a draft | `trackApplication` | `POST /api/v1/applications` | `pilot apps add` | none | An MCP assistant saves the application it wrote with save_application, which also keeps the resume and letter. |
| Put an application back to draft, or mark it rejected or declined | `moveApplication` | `PATCH /api/v1/applications/{id}/status` | `pilot apps status` | `set_application_status` |  |
| Ask the owner to confirm sent, screening, interview, offer or accepted | `proposeStatus` | `POST /api/v1/applications/{id}/proposals` | `pilot apps propose` | `propose_status` |  |
| List what is waiting for the owner to confirm | `listPendingProposals` | `GET /api/v1/proposals` | `pilot proposals` | none | An MCP assistant is told what it proposed in the answer to propose_status; the owner answers in the dashboard. |
| Clean a posting of hidden text and flag lines that instruct an AI | `checkPostingText` | `POST /api/v1/postings/check` | `pilot check` | `get_posting` |  |
| Keep fit scores the assistant worked out for postings | `saveFitScores` | `POST /api/v1/postings/scores` | `pilot scores save` | `save_job_scores` |  |
| Run a job search on the chosen source and keep it | `runJobSearch` | `POST /api/v1/searches` | `pilot search` | `search_jobs` |  |
| Read a kept search again (uses no searches from the plan) | `readSearch` | `GET /api/v1/searches/{id}` | `pilot search show` | none | search_jobs and more_jobs already answer with the postings; a kept search is read in the dashboard. |
| Show the next page of a kept search (uses one more search from the plan) | `moreJobs` | `POST /api/v1/searches/{id}/more` | `pilot search more` | `more_jobs` |  |
| List the employers whose job boards are watched, with how each last scan went | `listCompanies` | `GET /api/v1/companies` | `pilot companies` | none | scan_companies reports how each board went, and the owner manages the list in Settings. |
| Watch an employer's own job board (Greenhouse, Lever, Ashby, Workable, Recruitee, Teamtailor or Atlassian) | `addCompany` | `POST /api/v1/companies` | `pilot companies add` | `add_company` |  |
| Read the watched boards and return the postings that match | `scanCompanies` | `POST /api/v1/companies/scan` | `pilot companies scan` | `scan_companies` |  |
| List the postings kept from scans of watched boards, best score first, with the reasons | `listScannedPostings` | `GET /api/v1/postings/scanned` | `pilot postings` | `list_scanned_postings` |  |
| List runs | `listRuns` | `GET /api/v1/runs` | `pilot runs` | none | Every MCP call is recorded as a run by the service it reaches; an MCP assistant has no run of its own to manage. |
| Open a run to report work on while it happens | `startRun` | `POST /api/v1/runs` | `pilot run start` | none | Every MCP call is recorded as a run by the service it reaches; an MCP assistant has no run of its own to manage. |
| Add a step to a running run | `addRunStep` | `POST /api/v1/runs/{id}/events` | `pilot run step` | none | Every MCP call is recorded as a run by the service it reaches; an MCP assistant has no run of its own to manage. |
| Close a run as ok, failed or cancelled | `finishRun` | `POST /api/v1/runs/{id}/finish` | `pilot run finish` | none | Every MCP call is recorded as a run by the service it reaches; an MCP assistant has no run of its own to manage. |
| Read a run with its steps | `getRun` | `GET /api/v1/runs/{id}` | `pilot run show` | none | Every MCP call is recorded as a run by the service it reaches; an MCP assistant has no run of its own to manage. |
<!-- operations:end -->

A test reads each door's source and fails when a door stops calling its service, when a route or tool exists that is not in this list, or when this table drifts from `lib/services/operations.ts`. `status`, `activity` and `insights` only read what the dashboard already shows.

## Let people watch the work: runs

A run is a piece of work an assistant reports on while it happens. Wrap anything with more than one step in one, and the dashboard shows it live on the **Runs** page and in the **Running now** card on the dashboard:

```bash
ID=$(node apps/cli/pilot.mjs run start scan "Daily scan")      # prints only the id
node apps/cli/pilot.mjs run step $ID "Fetched 3 boards" --data boards=3
node apps/cli/pilot.mjs run finish $ID --status ok "12 new postings"   # or --status failed "why"
```

- `run start --key <k>` (or an `Idempotency-Key` header over HTTP) makes a retry safe: the same key gives the same run.
- A step is one readable line plus small counts in `--data` (`found=12,boards=3`, or a JSON object where your shell keeps its quotes; PowerShell strips the quotes, so use `key=value` there). Never put secrets or whole documents in a step.
- Four keys in `--data` are shown by name on the run page, before the counts, so a run can be replayed and not only listed: `source` (where the information came from, e.g. `source="Greenhouse · stripe"`), `promptVersion` (which prompt or instruction made a judgement), `scorerVersion` (which scoring rules gave a number) and `decision` (what was decided, e.g. `decision="kept as new"`). Each is one line of plain text, cut at 200 characters, and shown as text, never as markup. The app's own board scans write `source`, `decision` and `scorerVersion`.
- A run still going with no step for 30 minutes shows as **Stalled**.
- Every step is also an Activity event carrying the run's id, under the token's name.

## Progress is proposed, not set

An assistant may put an application back to draft or mark it rejected or declined. It may **not** record that an application was sent, answered, interviewed for or offered: only you can say that something happened. It can **propose** it instead, with a short reason in its own words:

- MCP: the `propose_status` tool.
- Command line: `pilot apps propose <id> SENT --reason "The user said they sent it"`, and `pilot proposals` to list what is waiting.
- REST: `POST /api/v1/applications/{id}/proposals` with `{ "status": "SENT", "reason": "..." }`, and `GET /api/v1/proposals`.

A proposal changes nothing by itself. It appears in the dashboard's **Needs you** card and in the application's header, where one click confirms it (and Undo is offered, like any status change) and another dismisses it. Only one proposal waits per application, at most 50 wait at once, and an unanswered one expires after 14 days. What the assistant wrote is shown to you as a quotation, never as a fact.

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
