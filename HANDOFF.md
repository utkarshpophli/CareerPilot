# Handoff: pick up CareerPilot here

Written 2026-11-02 for a fresh Claude Code session (cloud or local). Read this first, then `ROADMAP.md`, then `docs/APP_PLAN.md`.

## What the project is

CareerPilot: a self-hosted dashboard where a job seeker, or any coding agent (Claude Code and OpenCode first), runs the whole job search with every step visible. It is a merge of three repos, all inside this repository:

- `apps/web`: the base, a fork of dossier (Next.js 16, Prisma 7, PostgreSQL). **AGPL-3.0-only.**
- `upstream/career-ops` (MIT) and `upstream/ai-job-search` (MIT): read-only sources to port from. Keep their MIT notice and origin path at the top of every ported file. Never use the name "career-ops" in the product.
- `apps/cli`: the dependency-free `pilot` command line tool.

Layout of the thinking: `ROADMAP.md` (all stages, tasks, risks, open decisions), `docs/APP_PLAN.md` (application first, milestones M1 to M5), `docs/MASTER_PLAN.md` (product and merge map), `docs/security/SECURITY_PLAN.md` (worklist), `docs/AGENTS.md`, `docs/adr/`, `research/` (the original research on the three projects).

## Decisions already made (do not re-ask)

- Keep the dossier fork, AGPL-3.0-only. Copyright holder for our changes: Utkarsh Pophli. Name: CareerPilot.
- Local-only, open source, self-hosted. Defaults must be safe if exposed. No hosted service from us.
- Agent tools first: Claude Code and OpenCode. Both are installed on the owner's machine (OpenCode 1.19.4, Claude Code 2.1.316); test both for real, do not guess config formats.
- Agents may only set DRAFT, REJECTED and DECLINED. Progress statuses are the owner's; an assistant can only propose them (proposal queue, M4a).
- No sample data: no demo seed button or command for users. (The e2e suite seeds demo data as a test fixture only.)
- No telemetry. The usage ping is deleted. The update check is off by default and queries only `utkarshpophli/CareerPilot`.
- Env vars are `CAREERPILOT_*`; old `DOSSIER_*` are read as a fallback.
- Job search: the app runs searches itself with its own keys, porting all job-source resources of both upstream projects (sequenced inside M4). Skip LinkedIn scraping (terms of service) and career-ops's `local-parser` provider.
- Order of work: M1 first run, M2 Connect screen, M3 dashboard as front door, M4 assistants and the app do the work, M5 platform.
- New ideas all in v1: run replay, token and cost view, budget caps with fallback to a cheaper or local model, duplicate-application guard, platform scorecards.

## Where things stand

Work happens on the `DEV` branch only; the owner merges `DEV` into `main`. Never commit to or push `main`, and open no pull requests to it. (The existing pull request #8 from `DEV` is what runs CI.)

**Done and pushed to `DEV` (see `ROADMAP.md` for the status of every row):** Sprints 1 and 2; M1 (first run; the Windows email failures were a test problem and are fixed, see below); M2 (Connect screen, OpenCode); M3 (dashboard cards); M4a (service layer, operation-to-door table with a parity test, proposal queue, assistant work reported as runs); M4b so far (ADR 0003, Greenhouse/Lever/Ashby adapters, tracked companies and board scans from REST, CLI and MCP); M4d so far (identity and dedup, kept and closed postings, the posting guard at ingestion, deterministic scoring with reasons, a read door for kept postings).

**CI (GitHub Actions, PR #8):** run 18 and run 19 on `DEV`: **all six jobs pass** (`check`, `e2e`, `windows`, `audit`, `docker`, `pilot` CLI). The production image is built and started for real in the `docker` job (health check and a browser sign-in). Read a run with the GitHub MCP tools (`actions_list`, `get_job_logs`); the sandbox cannot reach Docker Hub, job-board APIs or most other hosts, so anything that needs the internet is run in CI (see `.github/workflows/record-board-fixtures.yml`, which runs only while `.github/record-board-fixtures` is in the PR).

**Not verified / known open:**

1. **`email.spec.ts` on Windows: explained and fixed.** The four failures were a test problem (Chromium on Windows returns the clipboard with CRLF; the other three specs depend on the email the first creates). The owner's Windows machine is the only place this shows, so re-run `email` there after any change to those specs.
2. Claude Code's OAuth sign-in has not been completed by hand (`/mcp`), and no real task has been run through each assistant (`run start/step/finish`, `apps add`, `companies scan`). OpenCode was verified live.
3. `jobs/runner.db.test.ts` "runs a job in the background" was flaky on the owner's Windows machine (failed about 1 run in 2 alone and once in the full suite). Cause found and fixed: the test waited for the database row to say DONE, then read `seen`, which the subscriber fills a moment later; it now waits for the last notification too (6 of 6 runs pass). Raising the wait ceiling, as done earlier, did not address it.
4. The Greenhouse real fixture is still to be saved from the CI recording; Lever and Ashby are saved under `boards/fixtures/real/`.
5. Built since: the Review page (`/review`), Settings → Posting preferences and Settings → Watched companies. The dashboard's Needs-you card counts new postings. Not built: saved searches per source.
6. Owner to-dos (cannot be done by an agent): enable branch protection and secret scanning on GitHub; make the repository public before any shared use; merge `DEV` into `main`.

## Next steps, in order

1. M4c: batch 1 is done (Workable, Recruitee, Teamtailor ported; SmartRecruiters dropped; Personio and BambooHR deferred). 115 providers remain in `docs/sources/career-ops-providers.md`. Method that works: add the vendors to `apps/web/scripts/probe-sources.mjs`, add the marker `.github/probe-sources` to the PR, read robots.txt and terms from the run log, write the verdict files, then record fixtures with `scripts/record-board-fixtures.mjs` (marker `.github/record-board-fixtures`) and write the adapter against them. Remove each marker afterwards.
2. M4b.4 and M4d.2 are done (Jobdanmark shipped; Jobindex and Jobbank not allowed; Jobnet deferred; the "Check if it's still open" button and the Needs-you count of closed drafts).
3. M5: AI cost: tokens are counted per call (Usage page), the owner enters prices and monthly caps in Settings → Budget, and `createProvider` enforces them (stop or switch to a cheaper model). No hosted-model prices are built in on purpose (see ROADMAP 5.4). The worker exists (ADR 0004) and runs the board scan, the liveness check and the daily proposal prune; `yarn worker` runs it in development (its bundle is in `.worker/`, ignored by lint and git). Next: the worker entrypoint and moving one job type onto it; token capture in the AI providers before the cost view; richer step data before run replay is more than a step list.
4. M6 to M10. Keep going down `ROADMAP.md`.

Update the status words and tick tasks in `ROADMAP.md` in the same commit as the code.

## How to work in this repo (read before running anything)

- Windows dev machine, but CI is Linux and Windows. Do not write Unix-only commands into scripts or tests.
- Run everything from `apps/web`. `yarn` may not be on PATH: use `corepack yarn ...`. Node 24 (`.nvmrc`), Yarn 4. In the cloud sandbox corepack cannot download Yarn: put `/opt/node24/bin` on `PATH` and call `node_modules/.bin/vitest`, `tsc`, `eslint` and `playwright` directly (with `node_modules/.bin` on `PATH` too, for `tsx`); start Postgres with `pg_ctlcluster 16 main start` when it is down.
- Postgres: the dev database `dossier` runs on port **55432** in the owner's setup (port 5432 is often taken). Put `DATABASE_URL` in the environment. Missing `DATABASE_URL` shows up as a vitest "No test files found" or a `code.charCodeAt` error.
- Tests: `corepack yarn vitest run --project node --project dom` needs no database; the `db` project needs one. E2E: `corepack yarn build` then `corepack yarn test:e2e`. The e2e suite uses its own database named `<your database>_e2e`, a fake AI, fake job sources and a fake Google, and refuses any other database name.
- CLI tests: `node --test` in `apps/cli`.
- Windows traps: PowerShell 5.1 strips quotes from native arguments and `Set-Content` mangles UTF-8 (use the editor tools, not `-replace`); `execFileSync("yarn")` fails (use `process.execPath`); `process.exit()` right after `fetch` can crash with a libuv assertion (set `process.exitCode`); Playwright loads TypeScript as CommonJS (no `import.meta`).
- Do not stage tool-generated files: `apps/web/.claude-flow`, `apps/web/AGENTS.md` changes, snapshot files with only line-ending changes, `apps/web/test-results`.
- Security rules for any change: untrusted text goes through the posting guard; fetching uses the shared SSRF-safe fetch; write paths are rate limited and written to the Activity Ledger; secrets never reach logs, run steps or exports. Every security fix keeps a test that fails without it.
- Commits: conventional (`feat:`, `fix:`, `docs:`, ...), small, plan documents updated in the same commit.
