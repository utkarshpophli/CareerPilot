# Application plan: make the app itself work, then connect everything to it

Written 2026-11-01, after Sprints 1 and 2. This plan starts from the application a person actually runs: sign in, see the dashboard, connect an assistant (Claude Code, OpenCode), and watch it work. Porting more features from career-ops and ai-job-search comes after this works end to end.

## 1. Where the application stands (from the code, not from the plans)

**What exists and runs** (all verified by tests; the dashboard, Runs page and CLI were also exercised live in a browser in Sprint 1):

- The dossier base: profile and base resume, Find jobs (4 sources), Startups, the job Agent, New application from a pasted posting or a link, tailored resume and cover letter with page-limit trim and PDF, application board and table with status history and undo, Inbox and calendar through Google, data export and import, backups.
- Added by us: Activity (the ledger), Insights (applications by platform and resume template, resume revisions, reply rates), Runs (live progress of agent work), a Running-now card on the dashboard, API tokens, `/api/v1` (read, track an application, move rejected/declined/draft, report runs), the `pilot` CLI, skill export for Claude Code, the MCP connector for Claude with limits, Security settings (sign out everywhere), and the security fixes from Sprint 2.

**What is not there yet, in order of how much it matters to you:**

1. **A first-run path.** Nothing guides a new person from "installed" to "an assistant is connected and I can see it working". Tokens are made in one Settings section, the connector in another, the CLI commands in docs. There is no OpenCode support at all (no export target, no tested setup).
2. **Agents can watch and record, but cannot yet do the job-search work through the API.** Through REST and the CLI an assistant can track an application and report a run. Searching, scoring, tailoring and drafting happen inside the app's own AI or through the Claude connector's tools, not through `pilot`. So "run it from Claude Code or OpenCode" is half true today.
3. **The dashboard shows the numbers on a separate Insights page.** The dashboard itself shows funnel, week chart, board counts, Running now and Recent activity. The things you asked to see at a glance (how many applications, which platforms, how often the resume changed, which template, which assistants are connected and active) are one click away, not on the front screen.
4. **Most of the career-ops and ai-job-search features are not ported** (about 126 job sources, liveness checks, deterministic scoring with reasons, follow-up cadence, interview prep and story bank). The dossier base covers some of the same ground with its own approach.
5. **Not verified:** the Playwright end-to-end suite has never run since our changes, and the root CI has no e2e job; the Docker image has not been built here; a clean install on a fresh machine has not been walked through from the README.

## 2. The goal of this phase

A person on Windows, macOS or Linux can: install CareerPilot in about ten minutes; sign in; connect Claude Code or OpenCode by copying two things from one screen; ask their assistant to find, score and track jobs; and watch every step on the dashboard, with their application counts, platforms, resume versions and templates visible on the front screen.

Done when a fresh checkout passes that walk-through on Windows and in Docker, and an end-to-end test covers it in CI.

## 3. Milestones, in order

### M1. A first run you can trust (about 1 week)

| Task | Why | Done when |
|---|---|---|
| Walk the README on a clean machine and a clean database (Windows with Docker Postgres, Linux in CI); fix every snag | The README has never been tested end to end | Install to dashboard in under 10 minutes, steps written down |
| Make the empty dashboard teach the first three steps (add your profile, find or paste a posting, connect an assistant) | No sample data by decision; an empty dashboard must still tell a new person what to do | A new person on an empty database sees the three steps with working links |
| Get the end-to-end suite running: make it work on Windows paths (it assumes `/tmp`), add an e2e job to root CI | The biggest unverified area | e2e green in CI and locally |
| Build the production image in CI and run a smoke test against it (health, sign in) | Never built here | CI builds it and signs in |

### M2. Connect an assistant, on one screen (about 1.5 weeks)

A new **Connect** screen (Settings, and linked from the dashboard):

- Step 1, make a token (password asked, as now), with the scope explained in plain words.
- Step 2, pick your tool: **Claude Code** (the `claude mcp add` command and `pilot skills export`), **OpenCode** (its MCP config and `AGENTS.md` instructions), **other** (generic export). Each shows copy-paste commands filled with this server's address and the new token.
- Step 3, **Test connection**: the screen waits for the first call from that token and shows it arriving (uses the token's last-used time and the ledger).
- A list of connected assistants: name, last seen, calls today, runs, with Revoke.

| Task | Notes |
|---|---|
| OpenCode export target and a tested setup guide | Verify its current config format and where it reads instructions from before writing it; do not guess. Test against a real OpenCode install |
| Test connection and last-seen | Small: `ApiToken.lastUsedAt` exists; MCP clients need the same |
| Claude Code walk-through test | Do it for real: connect, run a scan-shaped task, see it in Runs |

Done when someone who has never seen the project connects Claude Code and OpenCode in under five minutes each, and sees their first run.

### M3. The dashboard, as the front door (about 1 week)

Put the numbers you asked for on the dashboard itself, and keep Insights for the detail:

- **Applications**: total, drafted vs sent, this week, trend.
- **Where**: applications by platform and by source (top five), with a link to Insights.
- **Resume**: number of resume versions and revisions in total and per application, which template and theme each application used, and the template with the most replies.
- **Assistants**: who is connected, last seen, what is running now, and today's calls and runs.
- **Needs you**: drafts waiting for your review, applications that went quiet, proposals from assistants (once the proposal queue exists).

Done when the front screen answers "how many, where, how many resume versions, which template, what are my assistants doing" without clicking.

### M4. Assistants can do the work, not only record it (about 2 weeks)

Give REST, the CLI and MCP the same small set of operations over one service layer, each reporting as a run:

- `postings add / check` (exists), `postings score` (the app's scorer; reasons stored), `applications draft` (tailored resume and letter through the app's AI), `search` (the configured job sources), `scan` (a named saved search as a run).
- Statuses stay as decided: assistants propose progress statuses, you confirm (proposal queue, one click).
- Every operation attributed to the assistant, with cost shown once the cost view exists.

Done when "find jobs in Berlin, score them, draft the best two" from Claude Code or OpenCode produces a run you can watch and two drafts waiting for your review, with nothing sent.

### M5. Then the rest of the product (after the above)

The Sprint 3 items from `docs/MASTER_PLAN.md` section 14 (owner seams, worker and queue so long scans survive a restart, run replay and cost view, budget caps), then the features from the two MIT projects in the merge-map order: discovery sources and liveness, deterministic scoring with reasons, follow-up cadence, interview prep.

## 4. Decisions (owner, 2026-11-02)

1. **Order:** M1 to M4 as written.
2. **Who runs the searches:** the app. When an assistant asks for a scan, CareerPilot runs the search with its own job-source keys and reports back as a run. For now the job sources are **all the resources from ai-job-search and career-ops** (career-ops's provider modules and ai-job-search's portal search CLIs), ported into the app's source framework; this widens M4 and is sequenced inside it (see M4).
3. **No sample data.** There is no demo seed button or command in M1; the empty dashboard teaches the first steps instead.
4. **OpenCode is installed** on the owner's machine, so the OpenCode export is tested against the real thing, not documented blind.

## 5. Risks

- OpenCode's config and instruction format can change; the export must be checked against its current documentation each time.
- Running the end-to-end suite on Windows may need changes to how it starts the app and fake servers.
- Assistants calling `search` and `draft` spend job-source quota and AI money: M4 must ship with the connector's existing limits and, soon after, the budget caps.
