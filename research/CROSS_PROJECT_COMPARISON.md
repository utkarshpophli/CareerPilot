# CROSS_PROJECT_COMPARISON - ai-job-search vs career-ops vs dossier (Phase 4)

Date: 2026-11-01. Read-only analysis of `C:\Projects\project_rho\{ai-job-search,career-ops,dossier}`. Inputs: the three `research/PROJECT_*.md` docs plus direct re-verification of manifests, LICENSE files, and selected source (paths cited). Nothing installed, built, or executed.

**Labels.** FACT = verified in a file (path given). ASSUMPTION = inference, not proven. RECOMMENDATION = my advice. Status words: IMPLEMENTED / PARTIAL / PLANNED.
**Abbreviations.** AJS = ai-job-search, CO = career-ops, DO = dossier.

## 0. Where docs and source disagreed (source wins)

| # | Topic | Project doc said | Source says | Impact |
|---|---|---|---|---|
| 1 | `@paper-design/shaders-react` licence (CO web) | "uncertain, may be non-MIT" | FACT `career-ops/web/package-lock.json` line 1034: `"license": "Apache-2.0"` (v0.0.80) | Permissive; no blocker for MIT/Apache reuse |
| 2 | CO web dependency licences | "from memory, ASSUMPTION" | FACT lockfile carries `license` fields: 170 MIT, 42 Apache-2.0, 12 MPL-2.0, 10 LGPL-3.0-or-later (+4 combined), 5 ISC, 2 0BSD, 1 each Python-2.0 / CC-BY-4.0 / BSD-3-Clause | Transitive LGPL/MPL present in CO web (likely native-image/CSS tooling; ASSUMPTION which packages) |
| 3 | Dossier themes | README "twelve", DEVELOPMENT.md "six" | FACT `src/lib/themes.ts` has 12 `id: "` literals (consistent with README); DEVELOPMENT.md stale | Doc drift only |
| 4 | Dossier "forks credited" | PROJECT_DOSSIER says credited in comments | FACT confirmed: `src/lib/agent/{run,draft}.ts`, `src/lib/ai/tasks/score-posting.ts` ("avinashbatchala's fork of Dossier"); `src/lib/connector/{oauth,tools}.ts` ("Anirudh Sharma's fork of Dossier") | Provenance chain exists but fork licences are not in-repo |
| 5 | AJS "posting guard" | doc warns of terminology trap | FACT confirmed: `tools/posting_guard.py` is an *inbound* sanitiser/scanner; nothing "guards posting/submitting" outbound | Do not conflate with CO `submit-guard.mjs` (outbound) |
| 6 | CO inbound prompt-injection defence | doc: prompt-level | FACT: `validate-untrusted-content-coverage.mjs` only checks the marker phrase "Untrusted External Content" is present in mode files; I found no deterministic HTML/invisible-char sanitiser in CO root `.mjs` (grep hits are incidental) | CO is weaker than AJS on inbound sanitisation (ASSUMPTION: not exhaustively searched) |
| 7 | Name collision | n/a | FACT: AJS `jobbank-search` = jobbank.dk (Denmark); CO `providers/jobbankca.mjs` = Job Bank Canada | Different sources; do not merge |
| 8 | CO has no MCP server | n/a | FACT: no `@modelcontextprotocol` dep in root/web `package.json`; MCP appears only as optional agent-side tools (Canva MCP in AGENTS.md) and a registry entry `plugins-registry/workspace-mcp.json` | MCP-server capability exists only in DO |

## 1. Snapshot

| Attribute | AJS | CO | DO |
|---|---|---|---|
| Identity | "job application workspace" fork template for Claude Code | local-first "AI job search" toolkit, ~166 root scripts + prompt modes + Go TUI + alpha web | self-hosted single-user job-search web app (`dossier.aien.me`) |
| Licence (FACT, LICENSE + manifests) | MIT, (c) 2026 Mads Lorentzen | MIT, (c) 2026 Santiago Fernandez de Valderrama; `package.json` `"license":"MIT"` | AGPL-3.0-only (`package.json`); LICENSE is verbatim FSF text, no named holder |
| Version | n/a (SemVer via release tags; CHANGELOG frozen 1.7.4) | root 1.38.0 (`VERSION`), web 0.16.0 | 1.11.0 (`package.json`) |
| Runtime | Python 3.10+ stdlib + Bun (TS CLIs) + Claude Code | Node `^22.13 \|\| >=23.4`, Go TUI, Playwright | Node 24, Next.js 16.4.3, PostgreSQL 18 |
| Persistence | flat files (JSON/CSV/MD) | flat files (MD/TSV/YAML) + derived SQLite | PostgreSQL via Prisma 7 (30 models, 34 migrations) |
| "Logic lives in" | markdown specs (`.claude/commands`, skills) | markdown modes (`modes/*.md`) + scripts | TypeScript code + inline versioned prompts |
| Users | 1 person, interactive Claude Code | 1 person, any AI CLI | 1 person per install (no user table) |
| Auto-submit? | never (FACT `apply.md` Step 6) | never (FACT `AGENTS.md`, `submit-guard.mjs`) | never (only user-clicked Gmail send; FACT PROJECT_DOSSIER 13) |
| Test style | 67 `unittest` files + 71 `bun test` files; spec-wording tests | ~1,004 root suites + 242 web + 65 Go; custom `test-all.mjs` | 220 vitest files + 25 Playwright specs + axe; coverage ratchet |

## 2. Common tech / infrastructure (FACT unless noted)

| Shared element | AJS | CO | DO | Note |
|---|---|---|---|---|
| Human-in-the-loop, no auto-apply | yes | yes | yes | Strongest shared principle; also a CO manifesto "right 3" |
| GitHub Actions CI | yes (SHA-pinned, `permissions: contents: read`) | yes (26 workflows, CodeQL, SBOM) | yes (ci/release/pages; pinned by major) | |
| Conventional-commit style releases | commitizen (`.cz.toml`) | release-please | git tag -> release workflow | three different release tools |
| Playwright | no | root `playwright` 1.64.1 exact; web `playwright-core ^1.61.0` | `@playwright/test 1.64.1`, `playwright-core ^1.64.1` | CO root and DO pin the same minor |
| Tailwind 4 + React 19 + Next 16 | no | web: Next 16.4.1, React ^19.2.5, Tailwind ^4.2.2 | Next 16.4.3, React 19.3.1, Tailwind ^4 | same major versions, patch drift |
| TypeScript | CLIs `^5.4.0` | web 7.0.2 (lock) | `^5` | CO web is on TS 7; others TS 5 |
| `node-html-parser` | `^6.1.x` | no | `^9.0.5` | major drift if shared |
| Docker | none | dev sandbox (Playwright base) | production image + compose | |
| SIL OFL fonts bundled | Lato, Raleway (no licence text; see audit) | DM Sans, Space Grotesk (+ web Inter, Instrument Serif) with OFL.txt | 20 families with OFL.txt | |
| robots.txt awareness | `tools/robots_check.py` (RFC 9309, fail-closed) | per-provider policy notes in `docs/SUPPORTED_JOB_BOARDS.md` | `src/lib/startups/robots.ts` (RFC 9309, unreachable = deny) | two independent RFC 9309 implementations (AJS Python, DO TS) |
| SSRF/private-IP defence | not documented (ASSUMPTION: absent; bounds only) | `providers/_ip-guard.mjs` (DNS-time) | `src/lib/posting-fetch.ts` `guardedLookup` | independent reimplementations of the same idea |
| Prompt-injection posture | strongest (guard + read-only subagents + CI) | prompt rule + coverage check | untrusted marker + no tools + schema output | see section 7 |
| Local-model support | host-dependent (Claude Code) | Ollama, OpenAI-compatible, LM Studio, llama.cpp via runners | Ollama, LM Studio, OpenAI-compatible | |
| Cross-platform (Windows) care | UTF-8 forcing, Windows CI job | Windows/macOS/Linux CI, rename retry | Docker-centric | |
| Privacy-first / opt-in telemetry | none | none (FACT `LEGAL_DISCLAIMER.md` s2) | opt-in usage ping | |

## 3. Different tech choices and the trade-offs behind them

| Decision | AJS | CO | DO | Trade-off |
|---|---|---|---|---|
| Where does product logic live? | markdown specs executed by Claude Code; Python only where determinism is needed | markdown "modes" + ~166 zero-token scripts + direct-HTTP LLM runners | typed TS modules; prompts as inline version-stamped strings | Specs: zero build, editable by the end user, portable across agent hosts, but behaviour is non-deterministic and only wording is testable. Code: testable and enforceable, but needs deploy and is harder for end users to customise. CO hedges by splitting deterministic work (scripts) from judgment (modes). |
| Persistence | gitignored JSON/CSV, atomic replace, no locking | "files are canonical"; markdown table tracker, TSV ledgers, dir-locks, derived SQLite (explicitly never primary: `ARCHITECTURE.md`) | Postgres, FK cascades, `FOR UPDATE` in status changes | Files: inspectable, diffable, local, no ops, but concurrency/migrations are hand-rolled (CO needs 17 integrity checks). DB: integrity and queries for free, but operational burden (backups, migrations, Docker) and single-user-by-schema. |
| Tracker format | CSV (14 columns) | markdown table `# \| Date \| Company \| Role \| Score \| Status \| PDF \| Report \| Notes` (+Via, URL migrations) | `Application` table | CSV is trivially parseable; markdown is human-friendly but structurally fragile; SQL is robust but opaque to casual edit. |
| Scoring philosophy | code-computed weighted score from LLM sub-scores (`Fraction`, half-up, bands) | holistic 1-5 LLM judgment, "no arithmetic formula" | LLM 0-100 with rubric clamped in code, OR Jev typed questions with code weights | Code-weighted = reproducible and auditable; holistic = captures nuance but not reproducible across models. |
| LLM access | host's own tools (Claude Code) | any CLI + 4 direct-HTTP runners + batch bash | SDKs (Anthropic/OpenAI/Ollama/Mistral) behind one interface, MCP server | AJS is cheapest to build but host-locked; DO owns the call path (can validate/retry/learn quirks); CO maximises host choice at the price of prompt portability. |
| PDF engine | LaTeX (lualatex/xelatex) + Poppler verification | Playwright HTML->PDF (+ optional LaTeX) | Playwright/Chromium prints the app's own `/print` pages | LaTeX = best typography, heavy toolchain; Chromium = reuse HTML/CSS, large runtime image (DO image ~1.7 GB per README). |
| Scraper strategy | per-portal Bun CLI with uniform JSON contract; LLM drives | 126 in-process provider modules `{id, detect, fetch}` | 4 typed adapters with zod-forgiving parsing, keyed APIs mostly | CO optimises breadth (and maintenance treadmill); DO optimises contractual/keyed sources; AJS optimises "cheap to add one" via `/add-portal`. |
| Dependency discipline | stdlib-only Python; Bun CLIs; no lockfiles (FACT `.gitignore:2`) | 5 root deps; no root lockfile (FACT) | yarn 4 with `yarn.lock`, ~40 deps | Minimal deps help auditing; lockfile absence (AJS, CO root) hurts reproducibility. |
| Background work | none (interactive) / OS scheduler optional | OS-scheduler runner (web alpha), bash batch | in-process queue + 5 timers in the Next server | In-process is simple but forces single-instance (DO FACT); OS scheduler keeps the app stateless. |
| Config/secrets | env vars for portal tokens; Claude Code settings | `.env` + YAML; plugin lock | DB `Setting` rows, AES-256-GCM, HKDF per-purpose keys | `.env` is simplest; encrypted-in-DB supports UI-entered keys but ties you to `DOSSIER_SECRET`. |
| Language/runtime mix | Python + TS(Bun) | JS ESM + Go + TS(web) | TS only | Polyglot repos lower reuse (each module drags its toolchain). |

### 3.1 Architectural paradigm ADR (the three-way choice)

| Dimension | Markdown specs for an AI CLI (AJS; most of CO) | Next.js + Prisma app (DO) | Flat-file scripts (CO scripts; AJS tools) |
|---|---|---|---|
| Time to a new workflow | minutes (edit a .md) | hours-days (schema, action, UI, tests) | hours (new script) |
| Determinism | low; CI can only pin wording (AJS `test_*_command` guard tests) | high; zod boundaries, DB constraints | high where script is pure |
| Safety control | permission allowlists + prompt rules; fail-open if model disobeys | code paths; model has no tools (DO) | code paths |
| Multi-user / hosted | no (state on the user's disk, host session) | single-user as built; multi-user needs tenant column on ~30 tables (FACT absent) | no |
| UX | terminal/chat | full GUI with a11y tests | terminal |
| Cost model | user's CLI subscription/API | user's API key or local model | zero-token for deterministic parts |
| Portability of logic into a new product | prompts portable; orchestration not | UI/schema coupled to Next/Prisma; `src/lib` partly framework-light (FACT PROJECT_DOSSIER 20) | highest for pure functions (CO `classifyLiveness`, AJS `job_key.py`) |
| Failure mode | silent regression in LLM behaviour | upgrade risk (Prisma 7, Next 16 are new) | scripts bit-rot with site changes |
| RECOMMENDATION | keep specs for judgment/prose only | use as the system of record if a product is built | lift pure functions as libraries, wrap in service |

## 4. Overlapping data models

| Concept | AJS | CO | DO | Mapping notes |
|---|---|---|---|---|
| Posting / job | `seen_jobs.json` entry: `title, company, url, first_seen, posted_date, deadline, fit, status, portal, source, location, rank_*` keyed `<company-slug>_<title-slug>` | `Job {title,url,company,location,description?,postedAt?,salary?,externalId?}` in memory; persisted as `pipeline.md` rows + `scan-history.tsv` | `Posting {source, externalId, title, company, place, remote, salary, postedAt, url, via, description, complete, savedAt, dismissedAt, applicationId}` unique `(source, externalId)` | Common core: title/company/url/location/salary/postedAt/description/externalId. `deadline` only AJS (and DO `Application.deadline`). `complete` flag (DO) = "description is full text". |
| Application / tracker row | CSV `date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source,deadline` | `# \| Date \| Company \| Role \| Score \| Status \| PDF \| Report \| Notes` (+Via, URL) | `Application` (~30 fields incl. `extracted`, `match`, `status`, `furthestStage`, `sentAt`, `nextInterviewAt`, `tone`, `language`) | Join key problem: AJS = company+role pair; CO = report number `#`; DO = cuid. |
| Status vocabulary | `drafted, applied, interview, offer, hired, rejected, no_response, offer_declined, withdrawn` | `evaluated, applied, responded, assessment, interview, offer, rejected, discarded, SKIP, hired` (FACT `templates/states.yml`) | `DRAFT, SENT, SCREENING, INTERVIEW, OFFER, ACCEPTED, REJECTED, DECLINED` | See mapping table below. |
| Score | `rank_score` 0-100 int + band + `fit_rating` bare number in CSV | 1-5 float in tracker + report Machine Summary | `agentScore`, `PostingScore.score` 0-100 + reasons[<=4] + redFlags[<=3] | Different scales (0-100 vs 1-5); CO adds `confidence` tier. |
| Dedup identity | `job_key`, URL, norm(company,title) | URL norm, company+role key, requisition ID, listing fingerprint, JD fingerprint | `(source, externalId)`, `AgentCandidate.dedupeKey` (sha256 of link or company\|title\|place) | See section 7. |
| Profile / CV | markdown `01..09` + `cv/main_example.tex` | `cv.md`, `config/profile.yml`, `modes/_profile.md`, `data/career-profile.yml` | tables: `ProfileField`, `Skill`, `Language`, `Experience`, `Project`, `Education`, `Publication`, `Reference`, `Fact` | Only DO has a normalised, queryable profile. |
| Generated documents | LaTeX files + PDF; archive folder per application | `reports/NNN-*.md`, `output/*.pdf`, `pdf-index.tsv` | `Document {kind, units JSON}`, `DocumentVersion` (cause enum) | DO stores *units* (id, label, text, unverified) - finest granularity, enables per-unit regen/undo. |
| Status history | none | `data/status-log.tsv` append-only | `StatusEvent {from,to,at,previousFurthestStage,previousSentAt}` | Both keep a ledger; DO's carries undo data. |
| Email | `gmail_sync/state.json` processed ids | `reply-candidates.json`, `reply-proposals/*.json` | `EmailMessage` (thread, direction, kind, suggestedStatus, replyDraft) | |
| Calendar/interview | none | `data/active-interviews.md` (from `.ics`) | `Application.nextInterviewAt/interviewEventId/interviewCalendarId` | |
| Company research | `company_research/<company>.json` 30-day TTL | `company-history.mjs`, evaluation facts cache (24 h) | `Startup` rows (YC/HN) | |
| Contacts | tracker `contact_person` | `contacts.tsv` | `Startup.emails`, `Reference` | |
| Job-run state | `scrape_state` history, `fetch_attempts` | `scan-runs.tsv`, `portal-health.tsv`, `batch-state.tsv` | `Job` (type, status, step, input, result) + `agentRuns` setting | |

### 4.1 Status mapping (RECOMMENDATION - lossy, review before use)

| Canonical (proposed) | AJS | CO | DO |
|---|---|---|---|
| draft / evaluated | `drafted` | `evaluated` | `DRAFT` |
| applied / sent | `applied` | `applied` | `SENT` |
| responded / screening | (none; `interview` closest) | `responded` | `SCREENING` |
| assessment | (none) | `assessment` | (none) |
| interview | `interview` | `interview` | `INTERVIEW` |
| offer | `offer` | `offer` | `OFFER` |
| accepted / hired | `hired` | `hired` | `ACCEPTED` |
| declined by candidate | `offer_declined`, `withdrawn` | `discarded`/`SKIP` (partial) | `DECLINED` |
| rejected | `rejected` | `rejected` | `REJECTED` |
| silence | `no_response` | (none; cadence `cold`) | (none) |

FACT differences that break naive mapping: DO allows any-to-any transitions and tracks `furthestStage` separately (`status.ts`); CO ranks statuses (`STATUS_RANK`) for merge; AJS treats Final = hired/rejected/no_response/offer_declined/withdrawn.

## 5. Conflicting authentication / authorization approaches

| Aspect | AJS | CO | DO | Conflict / integration consequence |
|---|---|---|---|---|
| App login | none (no app) | none; web UI relies on loopback bind + `proxy.ts` Fetch-Metadata/Host guard (FACT `web/src/proxy.ts`) | single shared password, argon2id in env, JWE cookie 24 h/30 d, DB login throttle | Cannot share a session; CO web must never be exposed beyond loopback; DO needs a TLS reverse proxy. |
| Authorisation model | Claude Code allow/ask/deny rules + per-agent `tools:` allowlist | per-worker `--allowedTools/--disallowedTools` (web), `--dangerously-skip-permissions` in `batch/batch-runner.sh:1509` (FACT per doc) | session check wrapper on every action/route, audited by `session-audit.test.ts` | Opposite philosophies: permission-rules around an LLM vs code-only paths with no LLM tools. |
| Secrets at rest | `.env` (gitignored); `Read(.env)` denied | `.env`; plugin `plugins.lock` integrity + consent | AES-256-GCM in DB, HKDF per purpose, key from `DOSSIER_SECRET` | Merging stores requires a decision on who holds the master key. |
| Google/Gmail | delegated to claude.ai Gmail MCP (user's OAuth managed by host) | `plugins/gmail` own OAuth refresh token via `.env`, read-only label ingest | own Google OAuth client entered in Settings; scopes by feature; refresh token encrypted | Three incompatible Gmail integration styles; pick one OAuth owner per product. |
| Agent/MCP auth | consumes Gmail/Notion MCP (host OAuth) | none (no server) | MCP resource server with built-in OAuth 2.1 AS (DCR, PKCE S256, signed stateless tokens, revocable by password/secret change) | Only DO exposes tokens; fits claude.ai connector flow. |
| Multi-user | no | no ("web has no auth layer, no multi-user" FACT PROJECT_CAREER_OPS 19) | no (no user table) | Any multi-tenant product needs new auth; none of the three provides it. |
| CSRF/origin | n/a | origin guard (F1 Sec-Fetch-Site, DNS-rebinding host filter) | Next action Origin check + `isSameOrigin()` + CSP nonce | Same class of protections, independently implemented. |

## 6. Overlapping functionality matrix

Legend: I = IMPLEMENTED, P = PARTIAL, - = not present (searched). One-line verdict last.

| Function | AJS | CO | DO | Verdict |
|---|---|---|---|---|
| Job search / scraping | I: 2 enabled portal CLIs (LinkedIn guest, FreeHire) + 4 Danish (disabled) + WebSearch fallback | I: 126 providers, reverse-ATS sweep, HN, regional/gov | I: JSearch, Adzuna, Arbeitsagentur (unofficial), FreeHire, startups (YC/HN) | Breadth CO >> DO > AJS. Overlaps: FreeHire (AJS+DO), Arbeitsagentur (CO+DO), HN (CO+DO). |
| Ranking / scoring | I: weighted 4-dim code aggregation | I: holistic 1-5 report | I: AI 0-100, Jev, startup regex, requirement match | Three incompatible scales; do not average. |
| Resume/CV generation | I: LaTeX moderncv | I: HTML->PDF templates, LaTeX path | I: unit-based, themed, Chromium PDF | DO has finest-grain editing; CO has strongest verification; AJS has best layout checks. |
| Cover letter | I: `cover.cls` | I: `generate-cover-letter.mjs` | I: structured paragraphs + code-added frame | all three |
| Application tracking | P: CSV edited by LLM (no writer script) | I: markdown + ledger + SQLite index | I: Postgres + undo | CO and DO robust; AJS weakest (FACT doc 19). |
| Dedup | I: `job_key` + selection dedup | I: deepest (7+ layers) | I: DB constraints + dedupeKey | CO deepest. |
| Interview prep | I: `/interview` pack + mock | I: plan/practice/debrief, red-flag, STAR bank | - (calendar scheduling only) | AJS+CO overlap; DO gap. |
| Follow-up | I: `/outcome followup` (10 d default, stale sweep 60 d) | I: `followup-cadence.mjs` (7 d, max 2) | - (no reminders; FACT PROJECT_DOSSIER 19) | AJS+CO overlap; DO gap. |
| Inbox / email | I: `/gmail-sync` via Gmail MCP | P: Gmail plugin (read-only label), reply-watch (paste) | I: Gmail send + sync + classify + draft | DO strongest. |
| Calendar | - | P: `.ics` parsing, active-interviews | I: Google Calendar two-way sync, free slots | DO only real sync. |
| MCP / agent integration | client of Gmail/Notion MCP | skill router for 10 CLIs; no MCP server | MCP server + OAuth AS; Claude hand-off | DO = server; AJS = client; CO = multi-host prompts. |
| Posting safety / prompt injection | I: guard + read-only agents + allowlist + CI | P: rules + coverage check; privacy guard on egress | P: untrusted marker, no tools, fact guard | AJS most thorough inbound; CO most thorough outbound (PII). |
| Notion | I: `/notion-sync` (MCP) | I: `plugins/notion` | - | AJS/CO overlap. |
| Salary | I: union-index lookup | I: salary-gap, negotiation ROI, tax tables | P: salary string only | AJS/CO differ in data source. |
| Reporting/analytics | I: `/html-report` (LLM-generated) | I: funnel/velocity/patterns/digest | I: dashboard funnel/activity | |

### 6.1 Provider-level overlap

| Source | AJS | CO | DO | Note |
|---|---|---|---|---|
| FreeHire.me | `freehire-search` CLI (JSON, no key, `FREEHIRE_API_URL`) | no provider found | `freehire.ts` adapter (`DOSSIER_FREEHIRE_URL`) | Same upstream API, two clients (Bun/TS vs Next/TS). README (AJS) says backend is MIT and self-hostable (claim by README, not verified). |
| Bundesagentur (DE) | no | `providers/arbeitsagentur.mjs` | `arbeitsagentur.ts` (static public key; DO states it is unofficial/against terms) | Shared legal exposure. |
| Hacker News "Who is hiring" | no | `scan-hn.mjs`, `providers/hackernews.mjs` | `startups/*` | |
| LinkedIn guest | search+detail CLI (personal use only) | liveness only; LinkedIn JD guard | no | CO deliberately avoids search scraping. |
| Danish portals | 4 CLIs | no (VDAB, Arbeitsagentur etc. instead) | no | |
| JSearch / Adzuna | no | no | yes (keyed) | Only DO. |
| Job Bank Canada | no (jobbank.dk is different) | yes | no | name trap. |

## 7. Ranking, dedup, safety: how each is solved

| Concern | AJS | CO | DO | Trade-off |
|---|---|---|---|---|
| Score formula | `WEIGHTS technical .30 experience .25 behavioral .15 career .30`; bands Strong>=75 ... Poor | none (holistic); 5 dims; confidence tier from evidence status | rubric 85-100/70-84/50-69/<50; Jev `JEV_WEIGHTS` | Reproducibility vs nuance. |
| Hard filters | Eligibility Gate, Language Gate, location veto | dealbreaker gate, blacklist, culture-screen cap (<=2/5) | `sourceCovers(country)`; no hard gates | |
| Dedup keys | slug + sha1 suffix when capped / lossy | URL, company+role, req-ID, language, fingerprint, cross-listing, cooldown, blacklist | `(source, externalId)`, sha256 dedupeKey | Different normalisations coexist even inside AJS (FACT doc 10.5). |
| Expired handling | `expired` vs `unreachable` (3 attempts + 48 h) | `uncertain` never expires; 404/410 expire; `skipped_expired` | none | CO/AJS both encode "false expired is worse than a miss". |
| Injection defence | deterministic text sanitiser + 17 patterns + mixed-script detection (advisory) + CI guards | prompt rule everywhere + coverage check; egress PII guard | `UNTRUSTED_POSTING` constant; wrapped `<posting>` 20k cap; no tools; JSON schema; fact guard | AJS's sanitiser is the only code-level inbound defence. |
| Fabrication defence | grounding audit (spec) + reviewer subagent | `verify-cv-facts.mjs` hard gate, "reformulate never fabricate" | `fact-guard.ts` heuristic + `unverified` flags + strict mode | CO hard-fails; DO flags for human; AJS relies on LLM. |

## 8. Frontend-architecture differences

| Aspect | AJS | CO | DO |
|---|---|---|---|
| UI | none; LLM-generated offline HTML dashboard (`/html-report`, no generator script) | Go Bubble Tea TUI (4 views) + Next.js "alpha" (51 API routes, ~120 components) | Next.js App Router, 113 of 170 non-test `.tsx` are client components |
| State | files | server-rendered from disk; NDJSON streams; no DB | Server Actions (144) + `revalidatePath`; SSE job feed; no global store |
| Rendering | n/a | `force-dynamic` | all pages dynamic (CSP nonce per request) |
| Design system | none | Tailwind 4, CVA, `@paper-design/shaders-react` (Apache-2.0) | Radix + Tailwind 4 + own `ui/*`; dnd-kit |
| Testability convention | n/a | rule-bearing logic in plain `.mjs` for `node --test` | `*.test.tsx` (jsdom) + Playwright + axe WCAG 2.2 AA |
| Auth | n/a | none | session + proxy |
| i18n | n/a | 15 mode locales, 18 READMEs; web UI language not verified | UI English only; documents multilingual incl. RTL/CJK (FACT) |
| Maturity | n/a | self-labelled alpha | production-grade |
| Reuse | HTML report prompt only | components tightly bound to file layout (FACT PROJECT_CAREER_OPS 22) | `components/ui/*` + document renderers reusable inside AGPL |

## 9. Reusable business logic (ranked by value / coupling)

| # | Asset | Repo / path | Why valuable | Coupling | Licence mode |
|---|---|---|---|---|---|
| 1 | Posting integrity guard | AJS `tools/posting_guard.py`, `page_decode.py` | Only deterministic inbound sanitiser | stdlib only | MIT |
| 2 | AI provider abstraction | DO `src/lib/ai/{provider,providers/*}` | schema retry, runtime quirk learning, local/hosted | Prisma enums | AGPL |
| 3 | Provider modules + IP/URL guards | CO `providers/*`, `_ip-guard.mjs`, `_safe-url.mjs`, `_http.mjs` | 126 sources, SSRF defence | node built-ins | MIT |
| 4 | Liveness classification | CO `liveness-core.mjs classifyLiveness` | multilingual expiry patterns, conservative | pure function | MIT |
| 5 | Multi-layer dedup | CO `url-key.mjs`, `listing-fingerprint.mjs`, `fingerprint-core.mjs`, scan.mjs exports | | extract from 5k-line `scan.mjs` | MIT |
| 6 | Canonical dedup key | AJS `tools/job_key.py` | single file, Unicode-safe | stdlib | MIT |
| 7 | Fact gate | CO `verify-cv-facts.mjs` | hard stop on invented numbers | files | MIT |
| 8 | Fact guard + unit model | DO `ai/fact-guard.ts`, `Unit` | per-unit "check this" | none (pure) | AGPL |
| 9 | Privacy guard for LLM egress | CO `lib/privacy-guard.mjs`, `llm-outbound.mjs`, `pii-interceptor.mjs` | fail-closed PII block | none | MIT |
| 10 | MCP server + OAuth AS | DO `src/lib/connector/*`, `app/api/mcp` | stateless DCR/PKCE | `jose`, MCP SDK | AGPL |
| 11 | Status machine + undo | DO `status.ts`, `status-changes.ts` | pure `advance`, transactional undo | Prisma | AGPL |
| 12 | Follow-up urgency | CO `followup-cadence.mjs computeUrgency` | pure | tracker files | MIT |
| 13 | Rank aggregation | AJS `rank_state.py overall_score/band` | Fraction-exact, vetoes | state-file coupling | MIT |
| 14 | Secrets envelope | DO `secrets.ts`, `keys.ts` | AES-GCM + HKDF purposes | node:crypto | AGPL |
| 15 | PDF verification | AJS `verify_pdf.py`, `verify_layout.py` | page count, ATS dates, holes/orphans | Poppler | MIT |
| 16 | Jurisdiction tables | CO `templates/jurisdiction-*.yml` | legal signal data (expire; re-verify) | none | MIT |
| 17 | Job-agent loop | DO `src/lib/agent/*` | quota-safe daily scan | job runner, Prisma | AGPL |
| 18 | Evaluation prompts | CO `modes/_shared.md`, `oferta.md` | proven rubric | persona-specific | MIT (text) |
| 19 | robots RFC 9309 | AJS `robots_check.py`; DO `startups/robots-rules.ts` | choose one language | | MIT / AGPL |
| 20 | Salary lookup | AJS `salary_lookup.py` | fuzzy match; Nordic constants | user data | MIT |

## 10. Dependency / integration risks

| Risk | Detail (FACT) | Consequence | Mitigation (RECOMMENDATION) |
|---|---|---|---|
| Licence mixing | DO AGPL-3.0-only; AJS/CO MIT | MIT can flow into AGPL, not vice-versa | decide product licence first (see audit) |
| Runtime fragmentation | Bun (AJS CLIs), Python 3.10+ (AJS tools), Node >=22.13 (CO), Node 24 (DO), Go 1.26 (CO TUI) | five toolchains | wrap as processes; avoid in-process mixing |
| Missing lockfiles | AJS: `bun.lock` gitignored, no Python manifest; CO: no root `package-lock.json` (`.gitignore:244`) | non-reproducible installs | pin and lock when vendoring |
| Version drift | Next 16.4.1 (CO web) vs 16.4.3 (DO); React 19.2.x vs 19.3.1; Playwright 1.61/1.62 (CO web) vs 1.64.1; zod 3 (AJS CLIs) vs 4 (DO); node-html-parser 6 vs 9; TypeScript 7.0.2 (CO web) vs 5 | duplicate or incompatible installs in a monorepo | align majors; keep CO web out of a shared workspace |
| New-major dependencies | Prisma 7, Vitest 5, Vite 8, Next 16, TS 7, Go 1.26-1.27 | upgrade churn | pin exact; track advisories |
| Unverified licences | AJS `@bunli/core 0.9.1`, `@bunli/utils 0.6.0` (no lockfile, not readable offline); DO deps (yarn.lock has no licence field); `@modelcontextprotocol/server` | unknown obligations | run licence scan before shipping |
| Transitive copyleft | CO web lock: 10 LGPL-3.0-or-later + 12 MPL-2.0 | dynamic-link/notice obligations if redistributed | review which packages (likely optional native/CSS tools; ASSUMPTION) |
| Hard-coded endpoints | DO `releases.ts` (`AienTech/dossier`), `usage-ping.ts` (telemetry host), `arbeitsagentur.ts` (public key) | forks phone home / hit original repo | override constants |
| Unofficial APIs | DO Arbeitsagentur static key (self-declared unofficial); CO scrapes ~126 sites; AJS LinkedIn "personal use only" | ToS/legal exposure | allow-list sources; legal review |
| Name/namespace collisions | both AJS and CO use `.agents/skills/`, `AGENTS.md`, `CLAUDE.md`; both ship an "upskill"; tracker `job_search_tracker.csv` vs `data/applications.md` | clobbering if merged in one tree | keep separate roots |
| Host lock-in | AJS permission syntax is Claude Code; CO batch uses `claude -p --dangerously-skip-permissions` | portability, safety | isolate behind adapters |
| Single-instance state | DO queue/timers in memory | second replica double-runs timers | run one replica |
| Playwright footprint | Chromium needed by CO (PDF, liveness fallback) and DO (PDF) | big images | share one browser service |
| PDF toolchain | LaTeX + Poppler (AJS) vs Chromium (CO, DO) | two PDF pipelines | choose one |
| Trademark | CO name reserved | product naming limits | see audit |

## 11. Features that work together (composition patterns)

| Pattern | Mechanism | Status | Licence mode | Notes |
|---|---|---|---|---|
| CO scan -> DO application | CO `scan.mjs --json` receipt / `data/pipeline.md` -> import into DO via MCP `save_application`/UI | ASSUMPTION (no existing bridge) | (d) separate process; MIT output consumed by AGPL app | Treat CO as a data producer; map `Job` -> `Posting`. |
| AJS `posting_guard` in front of any LLM fetch | subprocess `python tools/posting_guard.py --text` | feasible (CLI contract documented) | (a) copy MIT or (d) call | Adds the missing code-level inbound defence to CO/DO. |
| CO `verify-cv-facts` as DO export gate | run on DO PDF text/markdown | ASSUMPTION | (d) | CO gate expects `cv.md` + `config/cv-facts.json`; adapter needed. |
| DO MCP as agent front door | Claude/other MCP clients call DO tools | IMPLEMENTED in DO | n/a | AJS Gmail/Notion MCP clients remain independent. |
| CO providers as DO adapters | wrap `providers/*.mjs` behind `JobSourceAdapter` | feasible | (a) copy MIT into AGPL app | MIT code remains MIT-notice-bearing inside AGPL whole. |
| AJS salary index + CO salary-gap | complementary data sources | feasible | (a) | |
| CO follow-up cadence + DO dashboard | compute urgency from `Application` events | feasible | (c) reimplement (or (a) MIT) | Fills DO's reminder gap. |
| CO interview-prep prompts + DO calendar | prompts keyed by `nextInterviewAt` | ASSUMPTION | (a)/(c) | |
| AJS `/add-portal` contract + CO `ADDING_A_PROVIDER.md` | two contract docs for new sources | | (c) | converge on one contract |

## 12. Features that must stay separate

| Item | Reason (FACT where cited) |
|---|---|
| DO code vs any proprietary component | AGPL s.5c: combined work must be AGPL; s.13 network clause on modified versions (LICENSE lines 196, 540) |
| CO web UI vs any network exposure | no authentication; security = loopback bind + origin guard (FACT) |
| CO batch runner permissions vs interactive path | `--dangerously-skip-permissions` for unattended workers |
| Markdown tracker (CO) vs Postgres tracker (DO) | "files are canonical" doctrine (CO) vs DB truth (DO); dual-writing causes drift |
| User-data stores (cv.md, tracker, `documents/`, DB) | PII; all three gitignore/segregate; CO CI `no-user-data.yml` |
| Unofficial/ToS-risky sources (Arbeitsagentur key, LinkedIn guest, scraped sites) | DO states Arbeitsagentur use is against terms; AJS LinkedIn CLI "personal use only"; CO LEGAL_DISCLAIMER shifts ToS risk to user |
| CO manifesto-bound "official surfaces" | licensed operators bound by nine rights (`TRADEMARK.md`, `CONTRIBUTING.md`) |
| Scoring scales | AJS 0-100 weighted vs CO 1-5 holistic vs DO 0-100 rubric: keep per-engine, never blend numbers |
| Telemetry/update endpoints | DO phones GitHub by default (update check) - disable/redirect in derivatives |
| Prompt text under different licences | CO/AJS prompts MIT; DO prompts AGPL |

## 13. Gaps nobody implements (cross-check)

Notifications/reminders (DO none; AJS/CO draft-only); multi-user/teams/tenancy; automatic ATS submission (deliberately absent everywhere); real currency conversion (AJS doc FACT: none); LinkedIn import (DO none; CO only joins a user-supplied `Connections.csv`); mobile/PWA; non-Google mail/calendar in a built-in way (CO plugin registry has outlook-interviews entry, third-party); hosted/shared service (CO PLANNED only, discussion #904); OpenAPI/public REST API (CO none, DO only MCP); a single cross-store canonical schema.

## 14. Summary recommendations

1. If the new product is closed or MIT: take ideas from DO, code from AJS/CO only; call DO (if at all) as an unmodified separate service.
2. If AGPL is acceptable: DO is the best chassis (typed, tested, DB-backed) and can absorb MIT modules from AJS/CO.
3. Always put AJS `posting_guard` and CO `privacy-guard` in the pipeline: they are the two most orthogonal safety assets.
4. Do not merge tracker formats; define one canonical status enum (4.1) and adapt at the edges.
5. Obtain a licence scan and legal review before shipping (see `LICENSE_AND_ATTRIBUTION_AUDIT.md`).
