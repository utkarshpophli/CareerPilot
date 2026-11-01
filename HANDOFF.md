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

Done and committed on local `main` (nothing is pushed; `origin` is behind): Sprints 1 and 2 (Runs, REST write API, MCP connector, `pilot` CLI, audits and about 25 security fixes, licence and source notice, CI), and the start of M1 (commit `893ef40`).

Verified: about 2,000 app tests and 24 CLI tests pass; typecheck, lint, production build clean; the dashboard, Runs page and sign-in were exercised live in a browser.

**Not verified / known open:**

1. **E2E on Windows, 2026-11-02: 141 passed, 6 failed (of 147).** Two are explained and fixed, four are not.
   - Fixed (test problems, no product bug): `calendar.spec.ts:25` (the `sql` helper read UTC timestamps in the machine's zone) and `dashboard.spec.ts:55` (assumed the local date equals the UTC date). The helper now reads UTC and the browser and app server are pinned to UTC. Reproduced on Linux with `TZ=Asia/Kolkata`; on Linux with that zone the suite is now 152 of 152.
   - **Not explained: `email.spec.ts` lines 18, 44, 54, 64** (time out waiting for `getByRole('group', { name: 'Subject' })`). They pass 4 of 4 on Linux alone, in the full suite, and with the machine in UTC+5:30, so it is not the time zone or the spec order, and nothing on the path is platform-specific. To diagnose it I need, from your Windows machine, `apps/web/test-results/email-*/error-context.md` (the page snapshot) for one failing spec, or the output of `corepack yarn playwright test email` there. Unverified guesses to check first: the Chromium or PDF step on Windows, and line endings from `autocrlf` in the checkout.
2. CI has never run: nothing is pushed. The `e2e` job and the Linux commands of every job were run by hand on Linux (all green, see `ROADMAP.md` 1.4 and 1.6), and the `docker` job now also smoke-tests the image. **The image has still never been built**: the cloud sandbox could not pull the base image (Docker Hub 429, mirror 403). The `windows` job could not be run at all.
3. The stray `career-ops/examples/...` folder is not in the cloud checkout (it was untracked on your machine) and nothing in the repository refers to it. Delete it on your machine.
4. Owner to-dos (cannot be done by an agent): enable branch protection and secret scanning on GitHub; make the repository public before any shared use; push `main`.

## Next steps, in order

1. Finish M1: push a branch and watch CI (`check`, `cli`, `windows`, `audit`, `docker` with the new smoke test, `e2e`); diagnose the four Windows email failures (see above).
2. Finish M2: the Connect screen at `/connect`, the OpenCode export target and MCP last-seen are built and verified with the real OpenCode (see `ROADMAP.md` M2). Still to do: complete Claude Code's sign-in by hand (`/mcp`), and run a real task through each tool (`run start/step/finish`, `apps add`).
3. M3: dashboard cards. Then M4a to M4d. Keep going down `ROADMAP.md`.

Update the status words and tick tasks in `ROADMAP.md` in the same commit as the code.

## How to work in this repo (read before running anything)

- Windows dev machine, but CI is Linux and Windows. Do not write Unix-only commands into scripts or tests.
- Run everything from `apps/web`. `yarn` may not be on PATH: use `corepack yarn ...`. Node 24 (`.nvmrc`), Yarn 4.
- Postgres: the dev database `dossier` runs on port **55432** in the owner's setup (port 5432 is often taken). Put `DATABASE_URL` in the environment. Missing `DATABASE_URL` shows up as a vitest "No test files found" or a `code.charCodeAt` error.
- Tests: `corepack yarn vitest run --project node --project dom` needs no database; the `db` project needs one. E2E: `corepack yarn build` then `corepack yarn test:e2e`. The e2e suite uses its own database named `<your database>_e2e`, a fake AI, fake job sources and a fake Google, and refuses any other database name.
- CLI tests: `node --test` in `apps/cli`.
- Windows traps: PowerShell 5.1 strips quotes from native arguments and `Set-Content` mangles UTF-8 (use the editor tools, not `-replace`); `execFileSync("yarn")` fails (use `process.execPath`); `process.exit()` right after `fetch` can crash with a libuv assertion (set `process.exitCode`); Playwright loads TypeScript as CommonJS (no `import.meta`).
- Do not stage tool-generated files: `apps/web/.claude-flow`, `apps/web/AGENTS.md` changes, snapshot files with only line-ending changes, `apps/web/test-results`.
- Security rules for any change: untrusted text goes through the posting guard; fetching uses the shared SSRF-safe fetch; write paths are rate limited and written to the Activity Ledger; secrets never reach logs, run steps or exports. Every security fix keeps a test that fails without it.
- Commits: conventional (`feat:`, `fix:`, `docs:`, ...), small, plan documents updated in the same commit.
