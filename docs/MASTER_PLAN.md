# CareerPilot - Master Plan

Status: draft v1, for review. Working name "CareerPilot" (the repo name). The earlier research documents in `research/` call the same product "Rho"; they remain the detailed reference for schema, API and ADRs. This plan sets the product direction and the build order on top of them. Do not use the name "career-ops" for anything we ship (see `research/LICENSE_AND_ATTRIBUTION_AUDIT.md`).

## 1. What we are building

One product that merges three open-source projects:

- `dossier` (AGPL-3.0): web app with profile, postings, tailored resumes and letters, application tracker, dashboard, Gmail and Calendar, MCP connector.
- `career-ops` (MIT): job discovery across about 126 sources, deep evaluation reports, liveness checks, follow-up cadence, interview and outreach prompts, analytics.
- `ai-job-search` (MIT): prompt-injection guard, deterministic scoring, dedup keys, robots-aware fetching, drafter and reviewer pattern.

The product is dashboard-first. Today two of the three projects are command-line tools where the user cannot see what is happening. CareerPilot keeps all of their abilities but makes every action visible in one dashboard, whether the user clicked a button, ran a CLI command, or told Claude Code or Codex to do it.

Safety rules carried over from all three projects and kept as hard rules in code:

1. Never submit or send anything on the user's behalf without a click.
2. No invented facts in generated documents. Every claim traces to the user's profile or the posting.
3. Text from the web or email is data, never instructions.
4. Code decides scores, ids, recipients and status. The model only extracts and judges.
5. The user brings their own model and keys. No telemetry by default.

## 2. Product shape: one engine, four front doors

```
 Dashboard (browser)   CLI (`pilot`)   Claude Code / Codex skills   MCP clients
        \                  |                    |                      /
         +-----------------+--------------------+---------------------+
                                     |
                          One service layer + REST API
                                     |
                +--------------------+--------------------+
                |                                         |
            PostgreSQL                          Worker (queue, schedules,
        (single source of truth)                  Chromium, AI, sources)
                                     |
                              Activity Ledger
```

- Every front door calls the same services. There is no second code path.
- Every action writes an event to the Activity Ledger (section 3). The dashboard reads it live.
- The CLI is a thin client over the REST API. It replaces career-ops's roughly 166 scripts and ai-job-search's Python tools for day-to-day use.
- Claude Code and Codex users get generated skills and slash commands (exported from our prompt registry) that call the CLI or MCP tools. The existing markdown modes become an export format, not the runtime.
- MCP exposes a curated tool set: read data, save drafts, start searches. No delete tool and no send tool, by design.

## 3. The Activity Ledger (the core new idea)

An append-only event table that records everything the system and its agents do. It is what makes "people can see what is happening" true. Each event has: time, actor (user, scheduler, CLI, Claude Code, Codex, MCP client name), action, target (posting, application, document), source or platform, model used, token cost, outcome, and a link to the details.

What it powers:

- A live "Activity" feed and a "Runs" view: a running scan or evaluation shows progress, the current step, the sources hit, and what it found or skipped and why.
- Every number the user asked for: applications started and sent, by platform and source; how many times each resume or letter was regenerated or edited; which template and theme each document used; response rates by platform and by template.
- Audit trail for security: which agent token did what.
- Cost tracking: tokens and money per task, per model, per day.

Implementation notes: events are written inside the same database transaction as the change they describe. The worker streams run progress over server-sent events. Dossier already has `StatusEvent`, `DocumentVersion` and `Job` tables; the ledger generalizes them rather than replacing them.

## 4. Dashboard design

Sections (navigation):

| Section | What the user sees |
|---|---|
| Today | Due follow-ups, new matches worth a look, upcoming interviews, running jobs, quiet-day nudges |
| Activity | Live feed of everything done by the user and by agents, filterable by actor, platform, application |
| Discover | Tracked companies, saved searches, source health, review queue, scan history |
| Postings | Pasted or found postings with guard verdict, liveness, score, and evidence behind the score |
| Applications | Board and table; status history with undo; per-application timeline, documents, emails, notes, contacts |
| Documents | Resumes and letters with version history, diff between versions, template and theme picker, fact-check flags |
| Inbox | Gmail sync, reply classification, proposed status changes, reply drafts, interview scheduling |
| Insights | Funnel, applications per week, by platform, by source, by template, by resume version; rejection latency; salary observations; cost |
| Prep | Story bank, interview plans, mock interviews, company research |
| Settings | Profile and search preferences, AI providers and models, integrations, agent tokens, backups, export |

Insights the user explicitly asked for, with their data source:

| Question | Source |
|---|---|
| How many applications, and how many sent vs drafted | `Application` + status ledger |
| Which platforms and boards they apply through | `Application.source` / posting origin, normalized |
| How many times a resume was changed | `DocumentVersion` count and edit events |
| Which template the resume uses | document `template` and `theme` fields, recorded per version |
| What is the agent doing right now | Activity Ledger + job runs |
| What works | response and interview rate grouped by platform, template, resume version, score band |

## 5. Merge map: what each project contributes, and duplicates resolved

Principle: where two projects do the same thing, keep the stronger one and drop the other. Detailed per-feature tiers are in `research/UNIFIED_PRODUCT_VISION.md` section 5 and `research/FEATURE_INVENTORY.md`.

| Capability | dossier | career-ops | ai-job-search | Decision |
|---|---|---|---|---|
| Profile and facts | structured tables, resume import | master profile, fact file | profile markdown | dossier's tables; fold in career-ops fact gate |
| Posting intake | fetch + JSON-LD, SSRF lookup | provider framework, IP guard | fetch + robots check + posting guard | career-ops provider contract; ai-job-search guard and robots; one SSRF guard |
| Prompt-injection defence | untrusted marker, no tools | prompt rule only | real sanitizer + scanner + CI | ai-job-search guard ported to TypeScript, used everywhere |
| Dedup and job identity | basic | deepest (url, company+role, fingerprint, reposts) | canonical key | career-ops stack unified with ai-job-search key into one service |
| Sources | 4 | about 126 | about 8 portal CLIs | start with Greenhouse, Lever, Ashby, FreeHire plus aggregators, add about 25 popular ones; drop LinkedIn scraping and the `local-parser` provider |
| Liveness | none | strong | none | career-ops, ported |
| Scoring | model-assisted match, code decides coverage | pure model judgment | deterministic weights, bands, vetoes | ai-job-search weights and vetoes; career-ops A-G report as structured output; dossier match as input |
| Resume tailoring | unit model, fact guard, undo | CV generation + fact check | drafter and reviewer | dossier unit model; career-ops hard fact gate; ai-job-search reviewer pass |
| PDF | Chromium, page-limit trim | Chromium, ATS text normalization | LaTeX | Chromium; combine page-limit and ATS normalization; LaTeX is an optional later worker |
| Tracker | status machine with undo | markdown table + ledger | CSV | dossier's DB machine; career-ops states and ledger semantics |
| Follow-ups | none | cadence and urgency | none | career-ops cadence, in-app |
| Email and calendar | Gmail, Calendar | reply watch, paste | none | dossier's Google modules; keep manual paste for non-Google users |
| Interview and outreach | none | interview, story bank, outreach | interview command | career-ops prompts and story bank |
| Analytics | basic funnel | pattern analysis | upskill | merge into Insights, add the new dimensions in section 4 |
| Agent access | MCP + OAuth | none | Claude Code only | dossier connector pattern plus CLI plus generated skills |
| Scheduling | in-process timers | cron-like scripts | none | queue in PostgreSQL, separate worker |

## 6. Architecture summary

Detailed in `research/UNIFIED_ARCHITECTURE.md`; the choices that matter here:

- TypeScript end to end: Next.js (UI and API routes), a Node worker, a CLI, an MCP server, all sharing framework-free `core` services.
- PostgreSQL as the only database and the canonical store. Files are import and export only.
- Queue and schedules in PostgreSQL (pg-boss or equivalent), run by a separate worker process, so the web app can restart without losing a scan.
- `owner_id` on every user-owned table and a `Principal` passed into every service from day one. We ship single-user, but multi-user is no longer a rewrite.
- `AiProvider` interface with Anthropic, OpenAI-compatible (covers OpenRouter, LM Studio, vLLM), Ollama, and a Mock provider used by tests.
- Contract-first: zod schemas in a `contracts` package generate UI actions, REST, MCP and CLI inputs.

## 7. How we build it: base-code strategy

This is the biggest open decision (research ADR-001). The product wants dossier's features, and dossier is AGPL.

- Path B, recommended if the goal is speed and full feature coverage: adopt AGPL-3.0 for CareerPilot and build on dossier's code. We keep its dashboard, schema, auth, document engine and Google modules, then add the ledger, worker, source framework, scoring, guards and CLI. The MIT code from career-ops and ai-job-search is ported in with its notices. Consequence: the whole product stays AGPL, and a closed commercial version is not possible later.
- Path A: write dossier's behaviors from scratch from the research documents (clean-room) and choose MIT or Apache-2.0. Roughly 20 to 30 percent more work on the core, but keeps every licensing option open.
- Either way: keep every MIT copyright notice, ship OFL texts for fonts, replace dossier's hard-coded telemetry host and repository URL, and keep a `THIRD_PARTY_NOTICES` file. This is engineering analysis, not legal advice; a lawyer should confirm before any public hosted launch.

Because the repository already contains all three projects as folders, Path B starts by promoting `dossier/` into the app skeleton under a new workspace layout and moving ported career-ops and ai-job-search modules into typed packages.

## 8. Phases

Each phase ends with something runnable. Sizes are rough and assume one to three people with AI-assisted coding.

| Phase | Goal | Main deliverables | Done when |
|---|---|---|---|
| 0. Foundation | Decisions made, repo ready | Licence and stack ADRs closed; workspace layout; CI (lint, typecheck, tests, dependency review); `THIRD_PARTY_NOTICES`; project renamed | CI green on an empty shell; ADRs signed off |
| 1. Skeleton | One app running end to end | Dossier base running in the new layout; PostgreSQL; worker process and queue; `owner_id` and `Principal`; Mock AI provider | Paste a posting, get a mock evaluation, create an application, export data |
| 2. Ledger and Activity | Visibility | Activity Ledger table and writers; Activity feed and Runs page; SSE progress; cost tracking | Any action from UI or API shows up live in Activity |
| 3. Safety core | Trusted pipeline | Ported posting guard, SSRF guard, robots check, identity and dedup service, outbound privacy guard, one fact gate | Ported tests pass; injection and fact-gate fixtures blocked |
| 4. Discovery and scoring | Find and judge jobs | Source adapter framework; first adapters (Greenhouse, Lever, Ashby, FreeHire) plus aggregators; filters; liveness; deterministic scoring with evidence; review queue; scheduled scans | Daily scan fills a review queue with deduped, live, scored postings |
| 5. Documents | Truthful tailored output | Unit model resume and letter; templates and themes recorded per version; version diff; ATS lint; PDF with page limit; refine chat | Tailored PDF passes the fact gate; template and version history visible |
| 6. Agent surfaces | Run it from anywhere | REST v1 and OpenAPI; `pilot` CLI; MCP server with OAuth; exported skills for Claude Code and Codex; agent tokens with scopes | A Claude Code session runs a scan and the dashboard shows it live |
| 7. Lifecycle | Close the loop | Follow-up cadence; Gmail and Calendar; reply classification with proposed status; contacts; interview records, story bank, prep | Reply arrives, status change is proposed, interview lands on the calendar |
| 8. Insights | Answer "what works" | Insights page with the section 4 metrics; weekly digest; pattern analytics | Charts for platform, template, resume version, score band |
| 9. Importers | Bring existing users over | Importers for career-ops data, ai-job-search workspace, dossier export | Real sample data imports with a preview report |
| 10. Hardening and release | Ship | Security review fixes, E2E and accessibility gates, backups, docs, Docker compose, release pipeline | Fresh install from compose works; security checklist passed |

Security review is scheduled after phase 1 for architecture and again in phase 10 for the finished product (see section 10).

## 9. New feature ideas (beyond the three projects)

Proposed, not committed. Pick which to pull into the roadmap.

1. Resume A/B tracking: tag each application with resume version and template, then show which gets more replies.
2. Platform scorecards: per job board, applications, replies, interviews, time to first response.
3. Run replay: open any past agent run and see each step, source, prompt version and decision.
4. Application readiness checklist: knock-out questions (visa, salary, location) surfaced before the user applies.
5. Duplicate-application guard: warn when the same company and role was applied to before, or inside the cooldown window.
6. Weekly goals and streaks: target number of quality applications per week.
7. Browser extension to capture a posting from any page into the dashboard.
8. Notifications by email or push for due follow-ups, replies, new strong matches.
9. Shareable read-only progress page for a mentor or coach.
10. Budget caps: monthly AI spend limit with warnings, and automatic fallback to a cheaper or local model.

## 10. Security plan (next step after this plan is approved)

Starting points already identified in the research:

- Threat model v0 (`research/UNIFIED_ARCHITECTURE.md` section 9): hostile job postings and emails, SSRF through fetchers, stolen agent tokens, leaked API keys, CV and email PII.
- Known risks in the sources to fix or drop: career-ops batch workers run with permission checks disabled, the `local-parser` provider executes configured commands, career-ops web relies on loopback binding with no auth, dossier has one shared password and no tenant column, LinkedIn scraping conflicts with terms of service.
- Controls to build: layered prompt-injection guard, AI tasks with no tools when reading untrusted text, SSRF-safe fetch, encrypted secrets with key versions, scoped and revocable agent tokens, no send or delete in MCP, rate limits and login throttling, CSP, dependency and license scanning, audit log, backup and restore tests.
- Deliverables: a written threat model, a security requirements checklist per phase, and a pre-release review.

## 11. Decisions needed from you

1. Licence and base-code path (section 7): Path B (adopt AGPL, build on dossier) or Path A (clean-room, choose a permissive licence)?
2. Users: single-user self-hosted first with multi-user seams (recommended), or hosted multi-user from the start?
3. Stack: TypeScript, Next.js and PostgreSQL as recommended?
4. Which section 9 ideas, if any, to pull into the first release?
5. Name: keep "CareerPilot"?

Until these are answered the plan assumes the recommended answers: Path B, single-user with seams, TypeScript/Next/PostgreSQL, name CareerPilot.

## 12. Build status

Updated 2026-11-01. "Done" means on the working branch with passing tests (about 1,900 unit and database tests, 8 CLI tests, the full browser suite of about 145 specs, lint and typecheck clean). The app was also run for real: production build, PostgreSQL with demo data, logged in through a browser, status changed in the UI and checked in Activity, and the CLI used against the live server.

| Phase | Status | Notes |
|---|---|---|
| 0. Foundation | Done | Layout (`apps/web`, `upstream/`), AGPL licence, notices, CI, ADR 0001. Workspace root deferred to the first shared package. |
| 1. Skeleton | Partly | Dossier base runs on Node 24 and PostgreSQL with all baseline tests green. Still to do: `owner_id` and `Principal` seams, separate worker process. |
| 2. Ledger and Activity | Done (first version) | `ActivityEvent` table; writers for application creation, status changes and undo, document versions, job queued and finished, MCP tool calls, scheduled and manual agent scans, posting checks; Activity page with filters and paging. Not yet: live progress streaming, cost per event, data export/import of events. |
| 3. Safety core | Started | Posting guard ported from ai-job-search with a golden-corpus parity test against the Python original, wired into pasted, agent and connector postings. Not yet: SSRF guard unification, identity and dedup service, outbound privacy guard, merged fact gate. |
| 4. Discovery and scoring | Not started | |
| 5. Documents | Not started | Templates are already recorded per document; Insights groups by them. |
| 6. Agent surfaces | Mostly | MCP connector attributed in the ledger; REST `/api/v1` (status, applications, activity, insights, posting check) with hashed, revocable, read/write tokens; dependency-free `pilot` CLI (`apps/cli`). Not yet: token management in Settings, rate limiting, write endpoints, exported skills. |
| 7. Lifecycle | Not started | Gmail and Calendar come with the dossier base. |
| 8. Insights | Done (first version) | Applications by platform and resume template, resume revisions, weekly activity, reply rates. |
| 9. Importers | Not started | |
| 10. Hardening | Not started | |

Privacy changes already made: the usage ping no longer points at the original dossier server and stays off unless an operator sets `CAREERPILOT_USAGE_PING_HOST`. The update check still asks GitHub about releases of this repository once a day on production servers; making it opt-in is on the Phase 10 list.
