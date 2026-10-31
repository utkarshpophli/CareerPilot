# UNIFIED_PRODUCT_VISION - "Rho" (working title)

Scope: product vision for one product that merges `ai-job-search` (MIT), `career-ops` (MIT) and `dossier` (AGPL-3.0-only). Source of truth for facts: `PROJECT_AI_JOB_SEARCH.md`, `PROJECT_CAREER_OPS.md`, `PROJECT_DOSSIER.md` (all in this folder), spot-verified against source for the claims that drive design (listed in section 9).
Companion docs: `UNIFIED_ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `API_DESIGN.md`, `IMPLEMENTATION_ROADMAP.md`, `TECHNICAL_DECISIONS.md`. Written concurrently by another agent (referenced by name only; not read or written here): `CROSS_PROJECT_COMPARISON.md`, `FEATURE_INVENTORY.md`, `LICENSE_AND_ATTRIBUTION_AUDIT.md`.

Labels: **[F]** FACT (verified in source; repo-relative path), **[A]** ASSUMPTION, **[R]** RECOMMENDATION. "Rho" is only a placeholder name (`career-ops` is a reserved trademark: `career-ops/TRADEMARK.md` per `PROJECT_CAREER_OPS.md` s21; do not reuse its name).

---

## 1. What the three sources are (one paragraph each)

| Repo | Shape | What it is best at | What it lacks |
|---|---|---|---|
| `ai-job-search` (MIT) | Markdown specs executed by Claude Code + small stdlib Python tools + Bun portal CLIs; flat files [F `PROJECT_AI_JOB_SEARCH.md` s1,s4] | Injection hygiene (`tools/posting_guard.py`), deterministic scoring aggregation (`tools/rank_state.py`: `WEIGHTS`, `Fraction`, `BANDS`, vetoes, unreachable-retry), canonical dedup key (`tools/job_key.py`), robots-aware fetch, drafter-reviewer pattern | No UI, no DB, no auth; tracker CSV edited by the LLM; orchestration only works inside Claude Code |
| `career-ops` (MIT) | Markdown "modes" + ~166 Node scripts + 126 provider modules + optional Go TUI + alpha Next.js UI; "files are canonical" [F s1,s4] | Zero-token scanning across 126 sources, deepest dedup/liveness, A-G(H) evaluation reports, CV fact gate (`verify-cv-facts.mjs`), outbound-LLM privacy guard, follow-up cadence, analytics, interview/outreach prompts, never-auto-submit | No real backend, no auth (web UI relies on loopback bind), tracker is a markdown table with repair scripts, score is pure LLM judgment ("no arithmetic formula") |
| `dossier` (AGPL-3.0-only) | Next.js + Prisma/Postgres app, single user, 30 models [F `dossier/prisma/schema.prisma`: 30 `model`, no `userId`/tenant column - verified] | Product-grade UX and data model: profile -> posting -> tailored resume/letter with unit model, fact guard, undo/versions, status machine with undo, dashboard, Gmail/Calendar, MCP+OAuth connector, AI provider abstraction | Single-user/single-instance by construction (in-process queue + timers), 4 job sources only, English UI, no multi-user |

The merge thesis [R]: **dossier is the product skeleton, career-ops is the discovery/evaluation engine, ai-job-search is the safety and determinism toolkit.** Each fills the others' gaps, but the licence difference (AGPL vs MIT) decides how much of dossier can be *reused as code* vs *re-derived as ideas* (open decision ADR-001 in `TECHNICAL_DECISIONS.md`). This document is written so the vision holds under either answer; code-reuse notes are marked.

---

## 2. Product vision

**Vision statement.** A privacy-first, human-in-the-loop job-search workbench: it finds and verifies openings, tells you honestly how well each fits and why, drafts truthful tailored documents you can trace back to your own facts, and tracks the whole pipeline to outcome - and **never submits anything on your behalf**.

**Principles (each is a design constraint, each is traceable to a source):**

| # | Principle | Source evidence |
|---|---|---|
| P1 | Never auto-submit/auto-send. Humans click Apply/Send. | [F] `ai-job-search/.claude/commands/apply.md` Step 6; `career-ops/AGENTS.md` Ethical Use + `web/src/lib/apply/submit-guard.mjs`; `dossier` only `sendWithGmail`/`sendReplyEmail` call `sendMail` (`PROJECT_DOSSIER.md` s13); MCP has no send/delete tool |
| P2 | Zero invented facts: every claim in a generated document must trace to the user's profile/facts or the posting. | [F] `dossier/src/lib/ai/fact-guard.ts` (flags unbacked names/numbers/credentials); `career-ops/verify-cv-facts.mjs` (gate before PDF); `ai-job-search` Grounding Audit |
| P3 | Untrusted text is data, never instructions. Postings, emails, fetched pages pass a guard and are wrapped; LLM calls that read them have no tools. | [F] `ai-job-search/tools/posting_guard.py`; `dossier/src/lib/ai/tasks/prompt-parts.ts` `UNTRUSTED_POSTING`; `career-ops/modes/_shared.md` Untrusted External Content |
| P4 | Deterministic code around probabilistic AI: AI extracts/judges, code decides (weights, covered/gap, ids, recipients, dedup, status). | [F] `rank_state.overall_score`; `dossier match-requirements@1`, `tailor-resume.ts resumeUnits()`; `write-email.ts recipient()` |
| P5 | BYO model and keys; local models first-class; no vendor-hosted AI; no telemetry by default. | [F] `dossier/src/lib/ai/providers/*`; `career-ops/lib/privacy-guard.mjs`; `LEGAL_DISCLAIMER.md` |
| P6 | Honest about uncertainty: `unreachable` != `expired`; liveness `uncertain` never marks dead; confidence tiers on scores. | [F] `rank_state.py:77-80`; `career-ops/liveness-core.mjs classifyLiveness`; `modes/_shared.md` confidence tiers |
| P7 | Own your data: relational store with lossless export, importers for the three source formats. | [R] (career-ops doctrine "files are canonical" is deliberately NOT adopted - see ADR-013) |
| P8 | Quality over volume. Low fit => say so, discourage applying. | [F] `career-ops/AGENTS.md` Ethical Use; `MANIFESTO.md` |

---

## 3. Target users

| Persona | Need | Priority | Mode |
|---|---|---|---|
| **P-A Self-hosting technical job seeker** (today's dossier/career-ops user) | Own the data, plug in own LLM/key, Docker-compose install | Primary | Single-user self-hosted |
| **P-B Agent-driven power user** | Drive the workbench from Claude/Codex/CLI; MCP + API tokens | Primary (v1) | Same instance |
| **P-C Non-technical job seeker** | Hosted, zero-ops, guided onboarding | Conditional on ADR-002 (SaaS) | Multi-user hosted |
| **P-D Career coach / small team** managing several clients | Delegated workspaces | Later, speculative [A - no source supports it] | Multi-user + roles |

[A] Anti-persona: anyone wanting mass auto-apply; the product refuses by design (P1, and `career-ops/LEGAL_DISCLAIMER.md` bans it).

---

## 4. Core use cases

| UC | Flow | Primary sources |
|---|---|---|
| UC1 Onboard | Upload CV (PDF/DOCX/MD) -> AI proposes profile with "unverified" markers -> user reviews -> set targets, dealbreakers, languages, work authorization | dossier `import-profile` + `profile-import.ts`; career-ops `intake`/`master-profile`; ai-job-search `/setup` gates |
| UC2 Evaluate one posting | Paste URL/text -> guard -> extract -> match to profile -> score with dimensions/gates -> explain -> decide | dossier `read-posting` + match; career-ops `oferta`; ai-job-search `rank_state` |
| UC3 Tailor and export | Resume + cover letter in strict mode -> fact gate flags -> edit/regenerate/undo -> ATS-safe PDF within page limit | dossier tailor/cover/page-limit/versions; career-ops `generate-pdf` guards + `verify-cv-facts` |
| UC4 Discover at scale | Tracked companies + boards scanned on a schedule, deduped, liveness-verified, triaged by cheap score into a review queue | career-ops `scan.mjs` + providers; dossier job agent (run limits); ai-job-search `candidates` |
| UC5 Track pipeline | Board/table, status with undo, notes, contacts, follow-up due list, funnel | dossier status machine + dashboard; career-ops cadence |
| UC6 Communicate | Send application via Gmail on click, read replies, classify, suggest status, draft reply with free slots, schedule interview | dossier Google modules; career-ops `reply-watch` (proposals reviewed before status change) |
| UC7 Prepare interviews | Story bank, plan, mock, debrief, red-flag questions | career-ops `modes/interview/*`, `story-bank`; ai-job-search `/interview` |
| UC8 Learn from outcomes | Funnel, rejection latency, patterns, upskilling gaps, salary observations | career-ops `analyze-patterns`, `stats`; ai-job-search `/upskill` |
| UC9 Operate | Backup/restore, export, key rotation, health, update | dossier backups/export; career-ops doctor |
| UC10 Agent access | Claude (MCP) or CLI reads profile/postings/applications and saves drafts, still gated | dossier MCP connector (11 tools, no send/delete) |

---

## 5. Feature list

Tiers: **MVP** = smallest product that closes UC1-UC3, UC5 and a basic UC4 loop with all P1-P4 safety rails. **v1** = parity with dossier and the strongest career-ops capabilities. **Later** = valuable but not needed to be useful.
Reuse mode: **CODE** = copy/port MIT code (keep notices); **SPEC** = re-implement from behaviour described in `PROJECT_*.md` (no source copying); **REDESIGN** = take the idea, change the architecture; **DROP**.
"dossier" rows are **SPEC** by default because of AGPL; they become **CODE** only if ADR-001 chooses option B (adopt AGPL). `Why` explains the pick.

### 5.1 Platform and identity

| ID | Feature | Tier | Source | Mode | Why |
|---|---|---|---|---|---|
| A1 | Accounts + login (argon2id, session cookie, login throttle) | MVP | dossier (`auth/*`, `LoginThrottle`) | REDESIGN | dossier is one shared password in env [F]; need a `users` table for ADR-002 either way |
| A2 | Typed per-user settings + encrypted BYO secrets (AES-256-GCM, per-purpose HKDF keys) | MVP | dossier `settings.ts`, `secrets.ts`, `keys.ts` | REDESIGN | KV-with-zod is good; add `owner_id` and key versioning |
| A3 | Full JSON export/import (versioned) + backups | MVP | dossier `data-export.ts` (schema v7, [F]) | REDESIGN | lossless ownership (P7); also the vehicle for the importers |
| A4 | Health endpoint, structured logs that never print prompts/answers | MVP | dossier `api/health`, `log.ts` | SPEC | proven pattern |
| A5 | API tokens (scoped PAT) | v1 | new (dossier has OAuth only for MCP) | REDESIGN | CLI and integrations need non-browser auth |
| A6 | Audit log of security-relevant events | v1 | none (dossier lacks one [F s17]) | NEW | needed for multi-user |
| A7 | Optional TOTP / passkeys | Later | dossier recommendation only | NEW | |

### 5.2 Profile and facts

| ID | Feature | Tier | Source | Mode | Why |
|---|---|---|---|---|---|
| B1 | Profile CRUD: basics, experience, projects, education, skills (+groups), languages, publications, references | MVP | dossier profile tables | SPEC | richest structured model of the three; typed rows beat markdown |
| B2 | Facts ("facts about me", global or per-application) + forbidden phrases + credential list | MVP | dossier `Fact`; career-ops `config/cv-facts.json` | REDESIGN (merge) | one source of allowed claims feeding one gate |
| B3 | Resume import with unverified markers + preview/merge | MVP | dossier `profile-import*.ts`; career-ops `intake.mjs` | SPEC | highest onboarding value |
| B4 | Search profile: target roles/archetypes, location/remote, language gate, eligibility gate, dealbreakers, salary floor, re-apply cooldown, culture screen, follow-up cadence | MVP | career-ops `profile.yml`, `portals.yml` filters; ai-job-search `04-job-evaluation.md` gates; dossier agent settings | REDESIGN | all three keep these as prose/YAML; make them typed and code-enforced (gates are prose in ai-job-search [F s10.2]) |
| B5 | STAR story bank | v1 | career-ops `lib/story-bank.mjs`, `match-star.mjs` | CODE (port) | |
| B6 | Competency discovery from docs/GitHub (`expand`) | Later | ai-job-search `/expand`; career-ops `expand` | SPEC | |

### 5.3 Discovery

| ID | Feature | Tier | Source | Mode | Why |
|---|---|---|---|---|---|
| C1 | Paste text/URL; SSRF-guarded fetch; JSON-LD `JobPosting` first | MVP | dossier `posting-fetch.ts`; ai-job-search `fetch_page.py`/`robots_check.py` | CODE for robots (MIT) + SPEC for SSRF lookup guard (career-ops `_ip-guard.mjs` is MIT -> use that) | two MIT sources cover it, no AGPL needed |
| C2 | Posting guard: hidden-HTML/invisible-char strip, instruction-pattern scan, mixed-script flag, verdict persisted | MVP | ai-job-search `posting_guard.py`, `page_decode.py` | CODE (port Python->TS) | strongest injection hygiene [F]; has tests to port |
| C3 | Source-adapter framework: `{id, detect, fetch}` -> normalized `Job`; host allowlists; contract tests with fixtures | MVP | career-ops `providers/_types.js`, `_registry.mjs`, `_http.mjs`, `_ip-guard.mjs`, `_safe-url.mjs`; dossier `JobSourceAdapter` | CODE (port) | clean contract [F] |
| C4 | First adapters: Greenhouse, Lever, Ashby, FreeHire | MVP | career-ops `providers/*`; ai-job-search freehire CLI; dossier `freehire.ts` | CODE (port) | keyless, public JSON |
| C5 | Tracked-company scan + filters (title, location, age, salary) -> review queue | MVP | career-ops `scan.mjs` builders | REDESIGN | `scan.mjs` is 5,264 lines [F]; extract filters as pure functions |
| C6 | Dedup identity service: URL normalization, company+role key, canonical slug key | MVP | career-ops `url-key.mjs`, `companyRoleDedupKey`; ai-job-search `job_key.py` | CODE (port, unify) | three divergent normalisations exist [F s10.5 of ai-job-search] - collapse to one |
| C7 | Liveness (`active/expired/uncertain`), API-first | MVP | career-ops `liveness-core.mjs`, `liveness-api.mjs` | CODE (port) | pure `classifyLiveness` is reusable [F] |
| C8 | Browser-fallback liveness; trust/legitimacy flags | v1 | career-ops `liveness-browser.mjs`, `_trust-validator.mjs` | CODE | |
| C9 | More adapters (~25 popular ATS/boards) | v1 | career-ops providers | CODE | the other ~100 are a maintenance treadmill [A]: ship via community contract |
| C10 | Aggregator search UI (JSearch, Adzuna) with saved searches, 30-min cache, quota awareness | v1 | dossier `job-search/*` | SPEC | needs user API keys |
| C11 | Scheduled daily agent: run limits (3/24h), first-page-only, score newest N, review queue, optional auto-draft (default off) | v1 | dossier `agent/*` | SPEC | proven quota safety (`recordRunStart` before request) |
| C12 | Multi-layer dedup extras: listing fingerprint, requisition IDs, cross-listing, repost, cooldown, blacklist | v1 | career-ops dedup stack | CODE | |
| C13 | Startups (YC/HN) lead finder | Later | dossier `startups/*` | SPEC | niche; scraping policy burden |
| C14 | Reverse ATS sweep / VC seeds / rediscover-404 | Later | career-ops `scan-ats-full.mjs`, `seeds/` | CODE | fragile external dataset |
| C15 | Arbeitsagentur source | Later (opt-in) | dossier / career-ops | SPEC | uses a public key against the agency's terms [F `PROJECT_DOSSIER.md` s17] |
| **DROP** | LinkedIn guest-endpoint scraping as a default source | - | ai-job-search linkedin CLI | DROP default | regex parser self-described as brittle; ToS "personal use only" [F s12]. Allow user-pasted LinkedIn text only. |
| **DROP** | `local-parser` provider (runs arbitrary configured command) | - | career-ops | DROP | RCE vector in a service [F s17] |

### 5.4 Evaluation

| ID | Feature | Tier | Source | Mode | Why |
|---|---|---|---|---|---|
| D1 | Requirement extraction + match (model maps, code decides covered/partial/gap; years decided in code) | MVP | dossier `extract-posting@2`, `match-requirements@1` | SPEC | exemplary P4 |
| D2 | Unified `Evaluation`: dimension scores 0-100, weights in code, bands, vetoes (location/language/eligibility), evidence status -> confidence tier, legitimacy (High/Caution/Suspicious, does not affect score), reasons<=4, red flags<=3 | MVP | ai-job-search `rank_state.py` (weights/bands/vetoes) + career-ops `_shared.md` (evidence/confidence, legitimacy) + dossier `score-posting@2` (JSON shape) | REDESIGN | replaces three incompatible scorers; deterministic aggregation fixes career-ops' non-reproducible score [F s19] |
| D3 | Batch triage (cheap model, one compact brief) | v1 | career-ops `triage.md`, `rank-pipeline.mjs`; ai-job-search `/rank` (5 per agent) | REDESIGN | |
| D4 | Full report (A-G blocks) stored as structured JSON + rendered markdown; archived JD snapshot mandatory | v1 | career-ops `oferta.md` | REDESIGN | blocks as data, not prose-only |
| D5 | Company research cache (30-day TTL) | v1 | ai-job-search `company_research/*` | SPEC | |
| D6 | Jurisdiction signal checks (pay transparency, agency licensing, ...) | Later | career-ops `oferta-signals/`, `templates/jurisdiction-*.yml` | CODE (data needs legal re-verification; tables expire [F]) | |
| D7 | Salary observations and benchmark import | Later | career-ops `salary-observations.tsv`; ai-job-search `salary_lookup.py` | SPEC | ai-job-search tool is Denmark-specific and has no data shipped [F] |
| D8 | Prompt golden-set eval harness | v1 (dev tool) | career-ops `eval-golden.mjs`, `evals/` | CODE | prevents silent prompt regressions; career-ops' own is 10 cases and not in CI [F] |
| **DROP** | Jev/TypeSafe scorer | - | dossier | DROP | third-party vendor dependency, one more scorer to keep consistent |

### 5.5 Documents

| ID | Feature | Tier | Source | Mode | Why |
|---|---|---|---|---|---|
| E1 | Tailored resume as `Unit[]` (ids tied to profile entries; skills must match profile; publications/languages verbatim) | MVP | dossier `tailor-resume.ts` | SPEC | "trust nothing" assembly is the core anti-hallucination design |
| E2 | Cover letter (structured paragraphs; sender/date/signature added by code; tone sign-off) | MVP | dossier `write-cover-letter.ts`, `letter-frame.ts` | SPEC | |
| E3 | One fact gate for all generated text: heuristic flags per unit (dossier) + hard forbidden-phrase/quantified-claim gate before export (career-ops) | MVP | dossier `fact-guard.ts` + career-ops `verify-cv-facts.mjs` | REDESIGN (merge) | see UNIFIED_ARCHITECTURE s6.4 |
| E4 | Versions + undo; per-unit regenerate; manual edit autosave | MVP | dossier `DocumentVersion`, `regenerate-unit.ts` | SPEC | |
| E5 | PDF render via headless Chromium, page-limit trimming measured on real PDF, ATS text normalization | MVP | dossier `pdf/*`, `page-limit.ts`; career-ops `generate-pdf.mjs` (`normalizeTextForATS`) | CODE (career-ops, MIT) + SPEC | both use Playwright |
| E6 | 3 built-in ATS-safe templates | MVP | career-ops `templates/cv-template*.html`; dossier themes | CODE templates (MIT) | fonts need OFL notices [F]; `cv-template.tex` is "Based on: Gabriel Sison / sb2nov resume template, MIT" and the HTML "Jake" lineage is unverified (`LICENSE_AND_ATTRIBUTION_AUDIT.md`) - keep lineage lines or write own templates |
| E7 | Refine chat (edits only to existing units, stale-edit check, declined when facts missing) | v1 | dossier `refine-chat@7` | SPEC | |
| E8 | Application email draft (recipient only if literally in posting) | v1 | dossier `write-email.ts` | SPEC | |
| E9 | Theme builder + shareable theme files; document localisation (RTL/CJK) | v1 | dossier `themes.ts`, `document-labels.ts` | SPEC | |
| E10 | ATS lint + JD keyword coverage | v1 | career-ops `verify-ats.mjs`, `keyword-match.mjs` | CODE | |
| E11 | Form-answer drafts (Block H) with knock-out question pre-scan (visa/sponsorship/salary) | v1 | career-ops `modes/apply.md`, `application-answers.mjs` | REDESIGN | |
| E12 | LaTeX CV path | Later | ai-job-search, career-ops | CODE | heavy toolchain; optional worker image |
| **DROP** | `verify_layout.py`-style bbox heuristics | - | ai-job-search | DROP initially | page-count measurement (E5) covers MVP; port later if layouts regress |

### 5.6 Tracking and lifecycle

| ID | Feature | Tier | Source | Mode | Why |
|---|---|---|---|---|---|
| F1 | Application tracker: unified status enum, any->any transitions, `furthest_stage` funnel semantics, append-only status ledger with undo data, row-locked transitions | MVP | dossier `status.ts`/`status-changes.ts`; career-ops `states.yml` + `set-status.mjs` + `status-log.tsv`; ai-job-search vocab | REDESIGN (merge vocab, see DATABASE_DESIGN s4) | |
| F2 | Board + table, filters, notes, archive | MVP | dossier | SPEC | |
| F3 | Dashboard: funnel, weekly activity, "worth a look" | MVP | dossier `dashboard.ts` | SPEC | |
| F4 | Follow-up cadence + due list (in-app) | v1 | career-ops `followup-cadence.mjs` (`DEFAULT_CADENCE`, `computeUrgency`) | CODE (port) | |
| F5 | Contacts / outreach drafts / warm-intro join | v1 | career-ops `contacts.mjs`, `modes/contacto.md`, `linkedin-join.mjs` | CODE | PII handling needed |
| F6 | Interview records (rounds, dates, outcomes) | v1 | career-ops `active-interviews.md`; dossier `nextInterviewAt` | REDESIGN | |
| F7 | Pattern analytics, funnel velocity, rejection latency, weekly digest | Later | career-ops `analyze-patterns.mjs` etc. | CODE | |
| F8 | Outcome archive, offer prep, negotiation ROI | Later | career-ops | CODE | |
| F9 | Upskill gap heatmap | Later | ai-job-search `/upskill` | SPEC | |

### 5.7 Communications

| ID | Feature | Tier | Source | Mode | Why |
|---|---|---|---|---|---|
| G1 | Gmail send on user click with rendered PDFs attached | v1 | dossier `google/send.ts`, `mime.ts` | SPEC | |
| G2 | Inbox sync (history API), match mail->application (thread, domain, company), AI reply classification -> *proposed* status (never auto-applied except ACK/rejection handled flags) | v1 | dossier `google/sync.ts`, `matching.ts`, `classify-reply@2`; career-ops `reply-proposals` | REDESIGN | proposals-then-confirm is the safer common ground |
| G3 | Reply drafts from profile only, `[...]` for unknowns, free-slot proposals | v1 | dossier `draft-reply@3`, `slots.ts` | SPEC | |
| G4 | Google Calendar two-way interview sync | v1 | dossier `google/calendar.ts`, `availability.ts` | SPEC | |
| G5 | Manual reply paste (non-Google users) | v1 | career-ops `paste-reply.mjs` | CODE | |
| G6 | Notion/Obsidian/ICS export plugins | Later | ai-job-search `/notion-sync`; career-ops plugins | REDESIGN as export adapters | |

### 5.8 AI platform and agent surfaces

| ID | Feature | Tier | Source | Mode | Why |
|---|---|---|---|---|---|
| H1 | `AiProvider` interface: text + zod-validated JSON, timeout, cancel, error taxonomy, one repair retry, cut-off detection; adapters Anthropic, OpenAI-compatible (covers OpenRouter/LM Studio/vLLM/llama.cpp), Ollama, Mistral, Mock | MVP | dossier `ai/provider.ts` (verified: `BaseProvider.complete` with one corrective retry and `cutOff` -> `AiError("cut-off")`) | SPEC (interface) | "best reusable asset" [F]; AGPL -> reimplement; vendors' SDKs are permissive |
| H2 | Task framework: versioned prompt + input/output schema + deterministic post-processor; version string stored with every output | MVP | dossier `tasks/*` (`tailor-resume@6` ...) + ADR-005 | REDESIGN | |
| H3 | Outbound privacy guard: protected-values block/redact on every LLM payload, fail-closed | MVP | career-ops `privacy-guard.mjs`, `llm-outbound.mjs` | CODE (port) | |
| H4 | Spend tiers / model routing per task | v1 | career-ops `_shared.md` Spend Tier | REDESIGN | prompt-level there; real router here |
| H5 | Token/cost ledger | v1 | career-ops `utils/token-tracker.mjs` | CODE | |
| I1 | REST API v1 | MVP | new (dossier has Server Actions + 16 routes) | NEW | see `API_DESIGN.md` |
| I2 | MCP server + OAuth 2.1 (DCR, PKCE S256, revocable tokens, no delete/send tools) | v1 | dossier `connector/*` | SPEC | strongest "agent" story across the three |
| I3 | CLI (`rho`) over the same services | v1 | career-ops npm scripts; ai-job-search Python CLIs | REDESIGN | replaces 166 scripts with one thin client |
| I4 | Hand-off to Claude chat | Later | dossier `connector/handoff.ts` | SPEC | |
| I5 | Export of tasks as agent "skills"/markdown modes for use inside Claude Code | Later | ai-job-search, career-ops skills | REDESIGN | keeps the markdown ecosystem as an *output*, not the runtime (ADR-005) |
| I6 | Outbound webhooks | Later | none | NEW | |
| J1 | Visible-browser form prefill assistant with submit-event interlock | Later | career-ops `apply-scope.mjs`, `web/src/lib/apply/*` | REDESIGN | upstream notes the submit-event interlock is *not implemented* [F `submit-guard.mjs` header]; do not ship without it |

### 5.9 Ops

| ID | Feature | Tier | Source | Mode |
|---|---|---|---|---|
| K1 | Docker image(s) + compose (web, worker, db, optional ollama), migrations on boot, healthcheck | MVP | dossier `Dockerfile`, `compose.production.yml` | SPEC |
| K2 | CI: lint, typecheck, unit+DB+DOM, E2E with fakes, coverage ratchet, security-audit tests (every action/route guarded), image publish | MVP | dossier `ci.yml`, `session-audit.test.ts`; career-ops cross-platform matrix | SPEC |
| K3 | Nightly backup + retention | MVP | dossier `backup-schedule.ts` | REDESIGN (pg_dump aware) |
| K4 | Doctor/diagnostics page | v1 | career-ops `doctor.mjs` | REDESIGN |

---

## 6. Redesign (do not copy as-is)

| Item | Why not reuse | Replace with |
|---|---|---|
| Markdown tracker (`applications.md`) + 17 integrity checks + merge/dedup scripts | Acknowledged structural fragility at hundreds of rows [F `tracker.mjs` header]; directory locks | Relational `applications` + `status_events` ledger; markdown/CSV as export; scripts become one-shot importers |
| Three scorers (dossier 0-100 AI, ai-job-search 4-dim weighted, career-ops holistic 1-5) | Incomparable scales; one is non-reproducible | One `Evaluation` with dimension scores and code-owned aggregation (ADR-014) |
| In-process queue + `setTimeout` schedulers | Single-instance by construction [F `PROJECT_DOSSIER.md` s4,s19] | Postgres-backed queue + separate worker (ADR-008) |
| Single shared password | No users | Users + sessions + tokens (ADR-002, A1) |
| KV `ProfileField`/`Setting` tables | Fine for one user; untyped | Typed profile columns + `jsonb extra`; typed settings with zod, owner-scoped |
| Prompt-as-runtime ("modes" executed by an external CLI) | Non-deterministic, host-specific (`--dangerously-skip-permissions` in batch [F `batch-runner.sh:1509`]); untestable | Versioned task definitions executed by our worker (ADR-005) |
| ~166 flat scripts / `scan.mjs` 5,264 lines | Monoliths, import cycles [F] | Packages: `sources`, `identity`, `liveness`, `filters` as small pure modules |
| Report numbering via sentinel files | File-system workaround | Per-owner DB counter (`DATABASE_DESIGN.md` s3) |
| Plugin system with hash-pinned consent | Appropriate for local files; "a convenience, not a sandbox" [F `_engine.mjs`] | In-repo adapter registry; third-party code deferred |
| Gmail/Notion via LLM+MCP (ai-job-search) | Only works inside Claude Code; LLM edits CSV | In-app OAuth integrations (G1-G4), Notion as export adapter |

## 7. Drop list

Go TUI (`career-ops/dashboard`), `update-system.mjs`, `scaffolder/`, per-host plugin manifests (`.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`), `security_guards.py` / `lint_skills.py` (guard a Claude Code repo layout), `check_upstream_updates.py`/`upstream_triage.py`, `/html-report` (LLM-generated, no generator [F]), `batch-runner.sh`, `openrouter-runner.mjs` free-model rotation, usage ping and GitHub update check from dossier (hard-coded endpoints [F s19 #6]), Prisma Studio proxy, marketing `site/`, `SIGNATURES.md` (contains personal usernames), maintainer agents under `career-ops/.github/agents`, Danish-only constants in generic tools (`salary_lookup.py`).

## 8. Out of scope (hard)

Auto-apply, bulk messaging, scraping behind logins, bypassing bot protection, selling/sharing user data, AI-written claims without a source fact, hosted default LLM keys.

## 9. Claims verified against source for this document

| Claim | Check | Result |
|---|---|---|
| dossier has no user/tenant column; 30 models | grep of `dossier/prisma/schema.prisma` | 30 `model` blocks, no `userId`/`tenant`/`model User` |
| dossier AI interface: text/JSON, one repair retry, cut-off error | read `dossier/src/lib/ai/provider.ts` | confirmed (`complete`, `listModels`, `test`; corrective retry; `AiError.of("cut-off")`) |
| dossier fact guard is heuristic (not LLM) | read head of `fact-guard.ts` | confirmed: regexes for numbers/number-words/capitalised names/credential words vs `FactSources` |
| dossier job concurrency 1 local / 3 hosted; 11 MCP tools | grep `jobs/runner.ts`, `connector/tools.ts` | confirmed (`LOCAL_CONCURRENCY=1`, `HOSTED_CONCURRENCY=3`; 11 `registerTool`) |
| career-ops provider contract `{id, detect?, fetch}` -> `Job` | read `providers/_types.js`, `_registry.mjs` | confirmed; loader skips `_`-prefixed and malformed modules |
| career-ops states | read `templates/states.yml` | 10 states: evaluated, applied, responded, assessment, interview, offer, rejected, discarded, skip, hired (+multilingual aliases) |
| ai-job-search weights/bands | grep `tools/rank_state.py` | `WEIGHTS = technical .30, experience .25, behavioral .15, career .30`; `BANDS` 75/60/45/30 |
| licences | read `LICENSE`/`package.json` | ai-job-search MIT (Mads Lorentzen, 2026); career-ops MIT (Santiago Fernandez de Valderrama, 2026); dossier AGPL-3.0-only (`package.json`) |

Not verifiable here: any runtime behaviour, test pass state, coverage, dependency licences (no `node_modules`) - inherited caveat from the three analyses.

## 10. Success criteria for the product [R]

1. A new self-hosted user goes from `docker compose up` to a first evaluated posting and a fact-gated PDF in under 15 minutes (target, to be measured).
2. 0 code paths can transmit an application or email without an explicit user action (enforced by an automated audit test; see `UNIFIED_ARCHITECTURE.md` s6.2).
3. Every generated claim is either backed by a profile/fact/posting source or visibly flagged.
4. All three source formats import without manual file editing (`DATABASE_DESIGN.md` s7).
5. Coverage >= 80% overall and higher on `core`/`ai`/`guards` (see `IMPLEMENTATION_ROADMAP.md` s6).
