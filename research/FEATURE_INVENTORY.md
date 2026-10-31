# FEATURE_INVENTORY - consolidated, de-duplicated across ai-job-search, career-ops, dossier

Date: 2026-11-01. Built from the three feature tables in `research/PROJECT_AI_JOB_SEARCH.md` (36 rows), `PROJECT_CAREER_OPS.md` (59 rows), `PROJECT_DOSSIER.md` (48 rows) = 143 source rows, merged to the rows below; selected rows re-verified against source (noted FACT). Read-only; nothing run.

**Legend.** AJS = ai-job-search, CO = career-ops, DO = dossier. Paths are relative to each repo root. Status per repo: IMPLEMENTED / PARTIAL / PLANNED; "-" = not present (searched). "Indep." = reusable independently (Yes / Partly / No). "Mod." = needs modification before reuse. Licence column omitted for brevity: AJS and CO code is MIT, DO code is AGPL-3.0-only (see `LICENSE_AND_ATTRIBUTION_AUDIT.md`). Claims are FACT from the cited project docs/source unless tagged ASSUMPTION.

Columns: ID | Feature | Repos: status | What it does | How it works | Key files | APIs / DB | Deps | Indep. | Mod.

---

## A. Job discovery and sources

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| A1 | Provider plugin layer (multi-ATS/boards/gov feeds) | CO: IMPLEMENTED (126 modules) | Normalised `Job` from Greenhouse, Ashby, Lever, Workday, SmartRecruiters, ... plus RemoteOK, Arbeitsagentur, Job Bank CA, etc. | Default export `{id, detect(entry)?, fetch(entry, ctx)}`; loaded alphabetically; resolve explicit `provider:` > local-parser > first `detect()` | `providers/*.mjs`, `_registry.mjs`, `_types.js`, `ADDING_A_PROVIDER.md`, `docs/SUPPORTED_JOB_BOARDS.md` | public ATS JSON/XML/HTML; no DB | node fetch/undici | Yes (each module near-standalone) | Map `Job` to your schema; per-site ToS review |
| A2 | Zero-token portal scanner with filters | CO: IMPLEMENTED | Scan tracked companies/boards, filter (title, location, age, salary, content, visa, country, experience, tier), dedup, append to inbox | `scan.mjs main()`: parallel fetch (CONCURRENCY 10), compiled predicates from `portals.yml`, writes `data/pipeline.md` + `scan-history.tsv` | `scan.mjs` (5.3k lines), `title-keywords.mjs`, `jd-years.mjs`, `classify-tier.mjs` | `portals.yml`, `pipeline.md`, `scan-history.tsv`, `scan-runs.tsv` | js-yaml, dotenv, undici, playwright (verify) | Partly | Extract exports from monolith; swap file inbox for DB |
| A3 | LLM-orchestrated multi-portal scrape (`/scrape`) | AJS: IMPLEMENTED (spec-driven) | Discovers portal skills, runs CLIs in parallel, 14-day scope, dedup before detail, store, present | Markdown spec `job-scraper/SKILL.md` + `scrape_state.py candidates/store/history` | `.claude/skills/job-scraper/SKILL.md`, `tools/scrape_state.py` | `job_scraper/seen_jobs.json`, tracker CSV | Bun, Claude Code `Agent`/`WebSearch` | Low (needs Claude Code) | Fill `search-queries.md` placeholders |
| A4 | Portal CLI contract + per-portal CLIs | AJS: IMPLEMENTED | Uniform `search`/`detail` JSON contract for LinkedIn, FreeHire, 4 Danish portals | Bun TS CLIs; `{meta, results[]}`; errors JSON on stderr; unknown flags rejected | `.agents/skills/*-search/cli/src/{cli,helpers}.ts` | LinkedIn guest HTML, freehire.me, jobindex/jobnet/jobbank/jobdanmark | Bun; `@bunli/*`, zod, node-html-parser (Danish 4) | High (per CLI) | ToS review (LinkedIn "personal use only") |
| A5 | LinkedIn guest search/detail | AJS: IMPLEMENTED; CO: PARTIAL (guest liveness only) | Search + detail via `jobs-guest` endpoints | Regex card parsing, backoff on 429/5xx, `isActive` detection, `stripInvisible` | AJS `linkedin-search/cli/src/helpers.ts`; CO `liveness-api.mjs` | LinkedIn guest endpoints | none (AJS runtime) | High | Parser rot; ToS |
| A6 | FreeHire.me source | AJS: IMPLEMENTED (CLI); DO: IMPLEMENTED (adapter); CO: - | Keyless JSON catalogue search, full text | AJS `Retry-After`-aware retry, 30 s budget; DO offset paging, 10,000 ceiling, `DOSSIER_FREEHIRE_URL` | AJS `freehire-search/cli/src/*`; DO `src/lib/job-search/freehire.ts` | `freehire.me/api/v1/agent/jobs/search` | none / zod | High | Third-party API stability |
| A7 | JSearch + Adzuna keyed sources | DO: IMPLEMENTED | Keyed aggregators; Adzuna 19 countries; snippets completed by guarded fetch | `JobSourceAdapter.search/details/test`; zod-forgiving parse; `requestJson` 10 s/5 MB | `src/lib/job-search/{jsearch,adzuna,http,index}.ts` | OpenWeb Ninja/RapidAPI, Adzuna; `Setting.*KeyEnc` | zod | Yes (adapters) | Own API keys; Adzuna attribution rules |
| A8 | Bundesagentur fuer Arbeit source | CO: IMPLEMENTED; DO: IMPLEMENTED (unofficial) | German federal job board | DO uses a static public client key, needs per-install acknowledgement, can be env-disabled | CO `providers/arbeitsagentur.mjs`; DO `arbeitsagentur.ts`, `sources.ts` | `rest.arbeitsagentur.de` | zod / fetch | Yes | Legal/ToS review (DO self-declares unofficial) |
| A9 | HN "Who is hiring" + YC/startup sources | CO: IMPLEMENTED; DO: IMPLEMENTED | HN thread parsing; DO adds YC posts, robots-respecting email lookup, no-AI match, block list | CO `scan-hn.mjs`, `providers/{hackernews,startup-jobs}.mjs`; DO `src/lib/startups/*` | HN Firebase/Algolia; `Startup`, `StartupBlock` | node-html-parser (DO) | Partly | Scraping policy/user agent |
| A10 | Reverse-ATS sweep, VC seeds, ATS discovery | CO: IMPLEMENTED | Walk public ATS directories; seed from VC portfolios | `scan-ats-full.mjs`, `seeds/vc-portfolios.mjs`, `discover-ats.mjs` | those files | `data/dead-boards.tsv`; external dataset | fetch | Partly | Dataset dependency |
| A11 | Playwright-only scanners (Interamt, Dayforce) | CO: IMPLEMENTED | Browser scrape for no-API portals | `scan-interamt.mjs`, `scan-dayforce.mjs` | | `portals.yml dayforce_boards` | playwright | Yes | Region-specific |
| A12 | Autonomous job agent (daily scan->score->optional draft->review queue) | DO: IMPLEMENTED; CO: PARTIAL (scheduled scans, web alpha); AJS: - | Daily one-page scan, dedupe, score newest N, optional auto-draft, approve/dismiss | `agent/run.ts` records run start before the request (quota-safe); 15-min timer; `awaitingReview` hides drafts | DO `src/lib/agent/*`; CO `web/scripts/scheduled-jobs-runner.mjs`, `/api/scheduled-jobs*` | `AgentCandidate`, `Application.origin/awaitingReview`; `data/scheduled-jobs.json` | job runner, Prisma | Partly | Single-instance scheduler (DO) |
| A13 | Portal/source health checks | CO: IMPLEMENTED; AJS: PARTIAL (spec only) | Detect dead/degraded boards | CO `verify-portals`, `dead-boards`, `portal-health.tsv`; AJS Step 4.75 degraded-scan + yield history | CO `verify-portals.mjs`, `audit-portals.mjs`; AJS `scrape_state.py history` | TSVs / `seen_jobs.json` | none | Partly | AJS needs LLM executor |
| A14 | New-source generators/contracts | AJS: IMPLEMENTED (`/add-portal`); CO: IMPLEMENTED (docs + plugin template); DO: PARTIAL (CONTRIBUTING rules only) | Make adding a source cheap | AJS interview+recon+scaffold+live test; CO `ADDING_A_PROVIDER.md`, `plugins/_template` | AJS `commands/add-portal.md` | | Bun / node | Medium | Output user-specific |
| A15 | Opt-in plugin engine + community registry | CO: IMPLEMENTED (engine); PARTIAL (registry metadata only) | Keyed integrations (Apify, Gmail, Notion, H-1B) with host allowlists and hash pinning | manifest `{id, apiVersion, hooks, requiredEnv, allowedHosts}`; `plugins.lock` consent | `plugins/_engine.mjs`, `_lock.mjs`, `_net.mjs`, `plugins-registry/*.json` | `config/plugins.yml` | none | Yes | "convenience, not a sandbox" (FACT header) |

## B. Posting acquisition, safety, liveness

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| B1 | Inbound posting integrity guard | AJS: IMPLEMENTED; CO: PARTIAL (prompt rule + coverage check only; FACT no sanitiser found); DO: PARTIAL (marker + no tools) | Strip hidden HTML/invisible Unicode, scan instruction-like lines, hidden URLs, mixed-script words; advisory verdict | `clean_html` -> `clean_text` -> `scan` -> `verdict`; exit 0 unless unreadable | AJS `tools/posting_guard.py`, `page_decode.py`; CO `validate-untrusted-content-coverage.mjs`; DO `ai/tasks/prompt-parts.ts` (`UNTRUSTED_POSTING`) | stdin/file | stdlib | Yes (AJS) | English-only patterns |
| B2 | robots.txt-gated polite fetch | AJS: IMPLEMENTED; DO: IMPLEMENTED (startups) | RFC 9309 evaluation, fail-closed | AJS `fetch_page.py` per-hop gate, GET-only, 45 s/10 MB; DO `robots-rules.ts` 24 h cache | AJS `tools/{robots_check,fetch_page}.py`; DO `startups/robots*.ts` | | stdlib / none | Yes | AJS `Claude-User` UA rule |
| B3 | SSRF-safe fetch | CO: IMPLEMENTED; DO: IMPLEMENTED | Block RFC1918/loopback/link-local at DNS time; redirect/size/time caps | CO AsyncLocalStorage `dns.lookup` patch; DO custom `lookup` + `BlockList` | CO `providers/{_ip-guard,_safe-url,_http,_dns-cache}.mjs`; DO `src/lib/posting-fetch.ts` | | node built-ins | Yes | None |
| B4 | JD/page text extraction | DO: IMPLEMENTED (schema.org JobPosting JSON-LD first); CO: IMPLEMENTED; AJS: IMPLEMENTED (agent) | Get clean posting text from a URL | DO <200 chars = unreadable; CO `fetch-jd.mjs`, `browser-extract.mjs`, `jd-capture.mjs`; AJS `posting-fetcher` subagent escalation | listed | | node-html-parser / playwright | Yes | |
| B5 | Liveness / expired detection | CO: IMPLEMENTED; AJS: PARTIAL (LinkedIn `isActive`, deadline sweep, unreachable->expired rule) | Classify active/expired/uncertain; avoid false expiry | CO API-first then Playwright; multilingual hard-expiry patterns; AJS 3 attempts + 48 h | CO `check-liveness.mjs`, `liveness-{core,api,browser}.mjs`; AJS `rank_state.py` | `scan-history.tsv` / `seen_jobs.json` | playwright (fallback) | Yes (`classifyLiveness` pure) | Light |
| B6 | Legitimacy/trust flagging | CO: IMPLEMENTED; AJS: PARTIAL (host provenance, mass-posting consolidation as spec) | Flag suspicious postings without dropping | CO `_trust-validator.mjs` score/flags; report Block G; AJS six-ATS-apex host check | CO `providers/_trust-validator.mjs`; AJS `commands/apply.md` Step 1 | | none | Yes | AJS: implement as code |
| B7 | Repost / cross-listing / JD-similarity detection | CO: IMPLEMENTED | Detect same job reposted or cross-listed | listing + JD fingerprints | `detect-reposts.mjs`, `fingerprint-core.mjs`, `jd-similarity.mjs` | | none | Yes | |
| B8 | Rediscover moved 404 postings | CO: PARTIAL | Browser search for new URL | `searchForNewUrl` | `scan.mjs` | | playwright | Partly | Fragile |

## C. Scoring, ranking, evaluation

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| C1 | Holistic A-G(H) evaluation report | CO: IMPLEMENTED | 5 dimensions -> single 1-5 score + archetype + legitimacy + Machine Summary YAML + draft answers | Prompt modes executed by CLI or runner; no formula | `modes/{_shared,oferta,ofertas,auto-pipeline}.md` | `reports/NNN-*.md` | LLM | Yes (prompts) | Strip persona archetypes |
| C2 | Weighted triage ranking (code aggregation) | AJS: IMPLEMENTED | Parallel scorer subagents return 4 sub-scores; code computes exact weighted score, bands, vetoes, deadlines | `Fraction`, half-up, `WEIGHTS .30/.25/.15/.30` | `tools/rank_state.py`, `commands/rank.md`, `agents/posting-scorer.md` | `seen_jobs.json` | stdlib | Partly | Weights hardcoded |
| C3 | AI posting score 0-100 with reasons/red flags | DO: IMPLEMENTED | Schema-constrained JSON; code clamps; years precomputed | `score-posting@2`; persisted in `PostingScore` | `ai/tasks/score-posting.ts`, `scoring/index.ts` | `PostingScore` | AI provider | Yes | Provider wiring |
| C4 | Typed-question scorer (Jev / TypeSafe) | DO: IMPLEMENTED | Model answers typed questions; code applies weights and quotes posting lines | `JEV_WEIGHTS`, `posting-lines.ts` | `scoring/{jev,typesafe,posting-lines}.ts` | `api.typesafe.ai`, `typesafeKeyEnc` | zod | Yes if key | Third-party dependence |
| C5 | Requirement matching (covered/partial/gap) | DO: IMPLEMENTED; CO: PARTIAL (inside report); AJS: PARTIAL (keyword table in ATS check) | Model maps requirements to skills; code decides outcome; years handled in code | `match-requirements@1` | DO `ai/tasks/{extract-posting,match-requirements}.ts` | `Application.extracted/match` | AI | Yes | Profile shape |
| C6 | Hard gates (eligibility, language, location, dealbreaker, blacklist, culture cap) | AJS: IMPLEMENTED (prose + verdict enums in code); CO: IMPLEMENTED; DO: PARTIAL (country coverage only) | Veto before scoring | AJS `04-job-evaluation.md`; CO `_shared.md` gates | | | none | Prompt-portable | |
| C7 | Cheap triage / rank annotator | CO: IMPLEMENTED | Compact-brief pass; `rank: N/5 - reason` | `modes/triage.md`, `rank-pipeline.mjs` | | `pipeline.md` | agent CLI | Yes | |
| C8 | Spend tiers / model routing | CO: IMPLEMENTED (prompt-level) | economy/standard/premium per CLI | table in `_shared.md` | | `profile.yml` | | Concept | Real router needed |
| C9 | Non-AI startup scorer | DO: IMPLEMENTED | Regex skills, fields, location, freshness | `startups/match.ts` | | `Startup.score` | none | Yes | |
| C10 | Calibration / golden-set eval | CO: PARTIAL (10 synthetic cases, not in CI); AJS: PARTIAL (`/setup` calibrates from outcomes) | Measure agreement | `eval-golden.mjs`, `calibrate.mjs` | | | LLM | Yes | Real data |
| C11 | Deadline sweep / closing-soon / unreachable-retry | AJS: IMPLEMENTED; CO: IMPLEMENTED (`closing-soon.mjs`) | Expire passed deadlines; retry unreachable | AJS `sweep --write`, `UNREACHABLE_MAX_ATTEMPTS=3` | AJS `rank_state.py` | | stdlib | Yes | Strict ISO dates |
| C12 | Evaluation / research caches | CO: IMPLEMENTED (job-facts <24 h); AJS: IMPLEMENTED (company research 30-day TTL) | Avoid re-spending tokens | `evaluation-cache.mjs`; `company_research/*.json` | | | none | Pattern | |

## D. Dedup and identity

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| D1 | Canonical dedup key | AJS: IMPLEMENTED | `<company>_<title>` slug, SHA-1 suffix on truncation, non-Latin fallbacks, `--audit` | `make_key`, `is_canonical` | `tools/job_key.py` | `seen_jobs.json` keys | stdlib | Yes (single file) | Tune caps |
| D2 | Multi-layer dedup | CO: IMPLEMENTED | URL norm, company+role (corporate-form stripping, aliases), requisition ID, language variants, fingerprint, cooldown windows, blacklist, aggregator reposts | exported pure functions | `scan.mjs`, `url-key.mjs`, `listing-fingerprint.mjs`, `fingerprint-core.mjs` | `scan-history.tsv` | none | Yes | Extract from `scan.mjs` |
| D3 | DB-constraint dedup | DO: IMPLEMENTED | `(source, externalId)` unique; agent `dedupeKey` sha256; `applicationId @unique`; P2002 -> "already seen" | | `prisma/schema.prisma`, `agent/run.ts` | `Posting`, `AgentCandidate` | Prisma | Partly | |
| D4 | Tracker merge/dedup | CO: IMPLEMENTED; AJS: PARTIAL (pair excluded at selection) | Merge TSV additions with fuzzy role match; keep higher score, more advanced status | `merge-tracker.mjs`, `dedup-tracker.mjs`, `role-matcher.mjs` | | `applications.md` | none | Partly | Markdown-bound |
| D5 | Duplicate-application precheck | CO: IMPLEMENTED | Cross-channel and email-alias check before apply | `precheck-duplicate.mjs`, `modes/apply.md` | | | none | Yes | |

## E. Profile and CV intake

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| E1 | Structured profile store | DO: IMPLEMENTED; CO: IMPLEMENTED (md/yaml); AJS: IMPLEMENTED (md files `01..09`) | Single source of candidate truth | DO KV basics + 7 typed tables; CO `cv.md` + `profile.yml`; AJS markdown | DO `lib/{profile,profile-data}.ts`; CO `config/profile.yml`; AJS `.claude/skills/job-application-assistant/01-*.md` | `ProfileField`, `Skill`, `Experience`, ... | Prisma / none | Partly | User scoping (DO) |
| E2 | Resume import (PDF/DOCX/MD) | DO: IMPLEMENTED; CO: IMPLEMENTED (`intake.mjs`, web ingest); AJS: IMPLEMENTED (`/setup` paths) | Parse existing CV into profile with human review | DO: unpdf/mammoth -> `extract-profile@4` -> "unverified" markers -> preview -> merge/replace | DO `resume-text.ts`, `profile-import*.ts`; CO `intake.mjs`, `career-profile.mjs` | `Job` (DO) | unpdf, mammoth | Yes | |
| E3 | Voice / writing-style capture | AJS: IMPLEMENTED (`02`,`03`); CO: IMPLEMENTED (`voice-dna.template.md`, `writing-samples/`, story-bank) | Match user tone | prompt data | | | | Prompts | |
| E4 | Canonical facts list ("Facts about me") | DO: IMPLEMENTED (`Fact`); CO: IMPLEMENTED (`cv-facts.json`, article-digest); AJS: PARTIAL (grounding union) | Source for fact checks | | DO `fact-actions.ts`; CO `config/cv-facts.example.json` | `Fact` | | Yes | |
| E5 | Competency discovery from docs/GitHub | AJS: IMPLEMENTED (`/expand`); CO: IMPLEMENTED (`modes/expand.md`, `github-evidence.mjs`) | Additive skill finding | | | | | Prompts | |
| E6 | Onboarding / doctor | AJS: `/setup`; CO: `doctor.mjs`, `onboard-write.mjs`, `validate-profile.mjs`; DO: login + Settings | First-run setup | | | | | Partly | |

## F. Document generation

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| F1 | Tailored resume per posting | DO: IMPLEMENTED; CO: IMPLEMENTED; AJS: IMPLEMENTED | Rewrite summary/bullets/skills order for a posting without inventing | DO: model proposes, `resumeUnits()` drops unknown ids, skills must match profile; CO: modes `pdf.md` + fact gate; AJS: drafter-reviewer | DO `ai/tasks/tailor-resume.ts`; CO `generate-pdf.mjs`; AJS `commands/apply.md` | `Document.units` (DO) | AI | Partly | Document schema |
| F2 | Cover letter | DO, CO, AJS: IMPLEMENTED | Structured letter | DO model returns paragraphs only; frame (sender/date/sign-off) added in code; CO `generate-cover-letter.mjs`; AJS `cover.cls` + 1-page rule | DO `write-cover-letter.ts`, `letter-frame.ts` | | AI | Yes | |
| F3 | Application email | DO: IMPLEMENTED; CO: IMPLEMENTED (`modes/email.md`) | Recipient only if literal in posting | `write-email.ts` `recipient()` | | `Document` kind EMAIL | AI | Yes | |
| F4 | Application-form answers (Block H) | CO: IMPLEMENTED; AJS: IMPLEMENTED (`08-application-forms.md`); DO: - | Draft answers for ATS forms | `application-answers.mjs`, knock-out warnings | | reports | LLM | Prompts | |
| F5 | Refine chat with undo + version history | DO: IMPLEMENTED; CO: PARTIAL (CV Studio alpha) | Chat edits only existing units; optimistic stale-edit check; versions by cause | `refine-chat@7`, `DocumentVersion` | DO `ai/tasks/refine-chat.ts`, `jobs/refine.ts` | `ChatMessage.edits`, `DocumentVersion` | AI | Partly | Unit model |
| F6 | Per-unit regeneration | DO: IMPLEMENTED | Regenerate one unit with type-specific rules | `regenerate-unit@6` | | | AI | Yes | |
| F7 | Resume themes + builder + share files | DO: IMPLEMENTED (12 themes per README, FACT 12 ids in `themes.ts`); CO: IMPLEMENTED (8 HTML templates + `.tex`); AJS: IMPLEMENTED (moderncv + `cover.cls` + `/add-template`) | Visual variants | DO tokens (fonts, accent, layout, heading, header, sidebar, date, photo); CO `cv-template*.html` | DO `themes.ts`, `theme-file.ts`; CO `templates/cv-template*.html` | `Theme` (DO) | fonts | Yes | OFL notices |
| F8 | PDF rendering | DO: Chromium prints app `/print` pages with 60 s path-bound token; CO: Playwright HTML->PDF (+LaTeX); AJS: lualatex/xelatex | Produce PDFs | pooled Chromium (DO, max 2) | DO `lib/pdf/*`; CO `generate-pdf.mjs`; AJS `commands/apply.md` | | playwright-core / LaTeX | Yes | Chromium or TeX runtime |
| F9 | Page-limit control | DO: IMPLEMENTED (measures real PDF, trims oldest roles first, keeps `trimmed` for put-back); CO: IMPLEMENTED (`--max-pages`); AJS: IMPLEMENTED (`verify_pdf --pages`) | Respect 1-2 page limits | `page-limit.ts` | | `Document.trimmed` | | Yes | |
| F10 | Document localisation (RTL/CJK/dates) | DO: IMPLEMENTED; CO: IMPLEMENTED (15 mode locales, CJK/zh templates) | Script-aware fonts/labels | `document-labels.ts`; unicode-range fallback fonts | DO `document-language.ts`, `fonts/*` | | fonts | Partly | |
| F11 | Drafter-reviewer subagent pattern | AJS: IMPLEMENTED | Independent reviewer returns JSON edits + narrative | `application-reviewer` read-only agent | `.claude/agents/application-reviewer.md` | | Claude Code | Pattern | |

## G. Document verification

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| G1 | CV fact gate | CO: IMPLEMENTED (hard-fail); DO: IMPLEMENTED (heuristic flags); AJS: PARTIAL (grounding audit, LLM) | Block/flag invented claims | CO `assertFacts` vs `cv.md`+`article-digest.md`+`cv-facts.json`; DO flags capitalised words, acronyms, numbers, credentials -> `unverified` | CO `verify-cv-facts.mjs`; DO `ai/fact-guard.ts` | | none | Yes | Tune per language |
| G2 | ATS lint and keyword coverage | CO: IMPLEMENTED; AJS: IMPLEMENTED (`--ascii-dates`, keyword table) | Structure lints, JD-keyword % | | CO `verify-ats.mjs`, `keyword-match.mjs`; AJS `verify_pdf.py` | | none | Yes | |
| G3 | PDF layout verification | AJS: IMPLEMENTED; CO: IMPLEMENTED (visual regression, Docker) | Holes, orphans, footer collisions; screenshot diffs | `pdftotext -bbox`; Playwright snapshots | AJS `verify_layout.py`; CO `tests/cv-visual/` | | Poppler / Docker | Yes | Calibrated to moderncv |

## H. Application tracking

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| H1 | Tracker store | DO: IMPLEMENTED (Postgres); CO: IMPLEMENTED (markdown + TSV ledgers + derived SQLite); AJS: PARTIAL (CSV, LLM-edited, no writer script) | System of record for applications | CO dir-locks + atomic writes | CO `tracker*.mjs`, `merge-tracker.mjs`; AJS `rank_state.tracker_pairs` (read-only) | `Application`; `data/applications.md`; `job_search_tracker.csv` | Prisma / node:sqlite | Partly | |
| H2 | Status machine + undo | DO: IMPLEMENTED; CO: IMPLEMENTED (`states.yml`, `STATUS_RANK`) | Pure `advance`, `furthestStage`, transactional undo of latest event | `FOR UPDATE` row lock | DO `status*.ts`; CO `set-status.mjs`, `lib/status-hooks.mjs` | `StatusEvent`; `status-log.tsv` | Prisma / none | Yes | |
| H3 | Board/table UI with filters | DO: IMPLEMENTED; CO: IMPLEMENTED (TUI) + PARTIAL (web) | | dnd-kit board | DO `applications/*`; CO `dashboard/**` | | dnd-kit / Bubble Tea | Partly | |
| H4 | Notes per application | DO: IMPLEMENTED | | | | `Note` | | Yes | |
| H5 | Per-application archive (posting + docs + outcome) | AJS: IMPLEMENTED; CO: IMPLEMENTED (`jds/`, embedded JD in report); DO: IMPLEMENTED (`postingText`) | Preserve what was submitted | | AJS `documents/applications/<company>_<role>/`; CO `archive-posting.mjs` | | | Pattern | |
| H6 | Atomic report numbering | CO: IMPLEMENTED | O_EXCL sentinel claims across reports/tracker/ledgers | `reserve-report-num.mjs` | | | node fs | Yes | DB sequence in a service |
| H7 | Pipeline integrity verification | CO: IMPLEMENTED (17 checks) | | `verify-pipeline.mjs`, `fix-report-links.mjs` | | | none | Partly | |
| H8 | Export / import / backups | DO: IMPLEMENTED (versioned JSON v7, pre-import backup, nightly 03:00); CO: PARTIAL (docs + updater backup); AJS: - | | `data-export.ts`, `backups.ts` | | all user tables | Prisma | Partly | |
| H9 | Notion mirror/export | AJS: IMPLEMENTED (`/notion-sync` via MCP); CO: IMPLEMENTED (plugin) | One-way sync | | AJS `commands/notion-sync.md`; CO `plugins/notion` | Notion API/MCP | | Low / Yes | |

## I. Follow-up, outcomes, analytics

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| I1 | Follow-up cadence and drafting | CO: IMPLEMENTED (`DEFAULT_CADENCE` applied_first 7 d, max 2); AJS: IMPLEMENTED (`/outcome followup`, 10 d default, max 2, drafts only, stale sweep 60 d); DO: - | Decide who is overdue; draft nudges | CO `computeUrgency` -> overdue/waiting/urgent/cold | CO `followup-cadence.mjs`; AJS `commands/outcome.md` | `follow-ups.md` | none | Yes (CO) | |
| I2 | Outcome recording + offer tooling | AJS, CO: IMPLEMENTED | Archive artifacts, record result | | AJS `commands/outcome.md`; CO `outcome.mjs`, `modes/offer-prep.md` | | | Partly | |
| I3 | Funnel analytics / dashboards | DO: IMPLEMENTED; CO: IMPLEMENTED; AJS: IMPLEMENTED (LLM-generated HTML, no generator) | Funnel, velocity, patterns | DO `dashboard.ts` pure calc + SVG | DO `dashboard*.ts`; CO `stats.mjs`, `funnel-velocity.mjs`, `analyze-patterns.mjs`, `weekly-digest.mjs`; AJS `commands/html-report.md` | | | Yes (DO calc) | |
| I4 | Skill-gap / upskill planning | AJS: IMPLEMENTED (`/upskill`); CO: IMPLEMENTED (`jd-skill-gap.mjs`, `upskill.mjs`) | Heatmap from postings | | | | WebSearch | Partly | |

## J. Inbox / email / calendar

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| J1 | Gmail send with PDF attachments | DO: IMPLEMENTED | Send in user's name; store thread; DRAFT->SENT | MIME build | `google/{send,gmail,mime}.ts` | `GoogleAccount`, `EmailMessage` | Google API | Yes (mime) | Own OAuth client |
| J2 | Inbox sync, matching, classification | DO: IMPLEMENTED; AJS: IMPLEMENTED (spec, via Gmail MCP); CO: PARTIAL (Gmail plugin read-only label, `reply-watch`/`paste-reply`) | Match mail to application (thread, company domain, name); classify; suggest status | DO history API, 21-day fallback, `worthSuggesting` | DO `google/{sync,matching}.ts`, `classify-reply.ts`; AJS `commands/gmail-sync.md`; CO `plugins/gmail`, `reply-watch.mjs` | `EmailMessage`; `gmail_sync/state.json`; `reply-candidates.json` | Google/MCP, AI | Partly | |
| J3 | AI reply drafting + free slots | DO: IMPLEMENTED | Answer from profile only; unknowns `[...]` | | `draft-reply.ts`, `availability.ts` | `EmailMessage.replyDraft` | AI | Partly | |
| J4 | Google Calendar two-way interview sync | DO: IMPLEMENTED | create/move/delete events; pull external changes | extended property `dossierApplication` | `google/{calendar,availability,slots}.ts` | `Application.interviewEventId` | Google API | Yes | |
| J5 | `.ics` / invite parsing | CO: IMPLEMENTED | Interview .ics -> `active-interviews.md` row | `ics-interview.mjs`, `invite-match.mjs` | | `data/active-interviews.md` | none | Yes | |
| J6 | Google OAuth connector | DO: IMPLEMENTED | Auth-code flow, scoped groups, encrypted refresh token | | `google/oauth.ts`, `api/google/*` | `GoogleAccount` | jose | Yes | |

## K. Interview prep, outreach

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| K1 | Interview prep pack + mock + debrief | AJS: IMPLEMENTED (`/interview`); CO: IMPLEMENTED (`interview/{plan,practice,debrief}`, red-flag); DO: - | Stage-aware prep | prompts | AJS `commands/interview.md`, `07-interview-prep.md`; CO `modes/interview*` | `interview-prep/` | LLM | Yes (prompts) | |
| K2 | STAR story bank | CO: IMPLEMENTED | | `lib/story-bank.mjs`, `match-star.mjs` | | | none | Yes | |
| K3 | Contacts / outreach / LinkedIn Connections join | CO: IMPLEMENTED | phonebook, vCard, warm intros | `contacts.mjs`, `linkedin-join.mjs` | | `contacts.tsv` | none | Yes | PII |

## L. Compensation and legal context

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| L1 | Salary benchmark lookup | AJS: IMPLEMENTED (needs user data) | Fuzzy company match against union index data | `salary_lookup.py` score ladder; `convert_salary_excel.py` | | `salary_data.json` | openpyxl | Yes | Nordic constants; no data shipped; no currency conversion (FACT) |
| L2 | Salary gap, negotiation ROI, relocation tax | CO: IMPLEMENTED | Transparent bracket-only comparison | `salary-gap.mjs`, `negotiation-roi.mjs`, `templates/jurisdiction-relocation-tax.yml` | | `salary-observations.tsv` | none | Partly | Tables expire |
| L3 | Jurisdiction legal-signal tables | CO: IMPLEMENTED | 14 check areas (agency licensing, AI screening disclosure, ...) | YAML + prompts + freshness check | `templates/jurisdiction-*.yml`, `modes/oferta-signals/*`, `check-table-freshness.mjs` | | none | Yes (data) | Needs legal verification |
| L4 | Visa/sponsor checks | CO: IMPLEMENTED (advisory) | UK register, US H-1B index | `sponsor-check.mjs`, `plugins/h1b-sponsor` | | | fetch | Yes | Region-specific |

## M. AI / agent / MCP integration

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| M1 | AI provider abstraction | DO: IMPLEMENTED (Anthropic, OpenAI-compatible, Ollama, LM Studio, Mistral); CO: IMPLEMENTED (Gemini, Ollama, OpenAI-compatible, OpenRouter runners); AJS: - | One interface; schema retry; runtime quirk learning (DO) | `BaseProvider.complete` + one corrective retry | DO `src/lib/ai/{provider,providers/*}`; CO `gemini-eval.mjs`, `openai-eval.mjs`, `ollama-eval.mjs`, `openrouter-runner.mjs` | `Setting` keys | SDKs | Yes (DO best) | Prisma enum coupling (DO) |
| M2 | MCP server + OAuth 2.1 AS | DO: IMPLEMENTED (11 tools, DCR, PKCE S256, signed tokens); CO: -; AJS: - | Expose profile/jobs/applications to Claude and other MCP apps | stateless client ids; 404 when off | `api/mcp/route.ts`, `api/oauth/*`, `lib/connector/*` | `Setting.connector*`, `ClaudePaste` | `@modelcontextprotocol/server`, jose | Yes | Tool set tied to domain |
| M3 | MCP client usage | AJS: IMPLEMENTED (Gmail, Notion MCP) | | | `commands/{gmail-sync,notion-sync}.md` | | MCP servers | Low | |
| M4 | Hand-off to Claude chat | DO: IMPLEMENTED | `claude.ai/new?q=` | `connector/handoff.ts` | | | | Partly | |
| M5 | Multi-CLI skill router | CO: IMPLEMENTED (10 hosts, ~45 modes); AJS: PARTIAL (`AGENTS.md` pointer) | One prompt set for many agent CLIs | | CO `.agents/skills/career-ops/SKILL.md`; AJS `AGENTS.md` | | | Prompts | |
| M6 | Agent permission constraints | AJS: IMPLEMENTED (allowlist + read-only agents + CI guard); CO: IMPLEMENTED (web `claude-invocation.mjs`) / batch uses skip-permissions | | `security_guards.py` | | `.claude/settings.json` | stdlib | Yes for Claude Code repos | |
| M7 | Background job runner with SSE | DO: IMPLEMENTED (13 job types, cancel/retry/recover); CO: PARTIAL (NDJSON stream, batch) | | `jobs/runner.ts`, `use-job.ts` | | `Job` | Prisma | Yes | Distributed queue if scaled |
| M8 | Batch evaluation runner | CO: IMPLEMENTED | Resumable headless workers, adaptive rate-limit retry | `batch/batch-runner.sh` | | `batch-state.tsv` | bash, CLI | Partly | Re-implement in Node/queue |
| M9 | LLM egress privacy guard | CO: IMPLEMENTED | Fail-closed block/redact protected values and PII | `llm-outbound.mjs`, global fetch interceptor | `lib/{privacy-guard,llm-outbound,pii-interceptor}.mjs` | `config/privacy.yml` | none | Yes | Light |
| M10 | Context budgeting, token accounting | CO: IMPLEMENTED; AJS: IMPLEMENTED (design: tool-owned state) | | `context-budget.mjs`, `token-tracker.mjs` | | | | Yes | |

## N. Security and access

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| N1 | Single-password login + stateless session | DO: IMPLEMENTED | argon2id env hash; JWE cookie with password fingerprint | | `lib/auth/*`, `proxy.ts` | env | jose | Yes | multi-user store |
| N2 | Login throttling | DO: IMPLEMENTED | per-IP + global backoff in SQL | | `auth/{throttle,login-throttle}.ts` | `LoginThrottle` | Prisma | Yes | |
| N3 | Action/route guard + audit test | DO: IMPLEMENTED | Every action/route wrapped; test asserts it | | `action.ts`, `route.ts`, `session-audit.test.ts` | | Next, zod | Yes | |
| N4 | Encrypted secrets | DO: IMPLEMENTED (AES-256-GCM, HKDF purposes) | | `secrets.ts`, `keys.ts` | | `Setting` | node:crypto | Yes | |
| N5 | Web origin/host guard | CO: IMPLEMENTED | Fetch-Metadata + Host allowlist + loopback bind | `web/src/proxy.ts`, `origin-guard.mjs`, `bind-host.mjs` | | env | none | Yes | Not authn |
| N6 | CSP nonce + security headers | DO: IMPLEMENTED | | `lib/csp.ts`, `next.config.ts` | | | Next | Yes | |
| N7 | Repo-level security guards | AJS: IMPLEMENTED (allowlist exactness, gitignore parse, manifest lifecycle scripts) | | `tools/security_guards.py`, `lint_skills.py` | | | stdlib | Yes | |
| N8 | Data contract (user vs system layers) + CI | CO: IMPLEMENTED; AJS: IMPLEMENTED (gitignore + placeholder integrity) | Keep PII out of repo and updater | `DATA_CONTRACT.md`, `lib/update-manifest.mjs`, `no-user-data.yml` | | | | Pattern | |
| N9 | Apply sandbox and submit guard | CO: IMPLEMENTED (CLI) / PARTIAL (web alpha; submit-event interlock not done) | No submit action in planner; path scope | `apply-scope.mjs`, `web/src/lib/apply/submit-guard.mjs` | | | playwright | Partly | |
| N10 | Plugin integrity pinning | CO: IMPLEMENTED | | `plugins/_lock.mjs` | | `plugins.lock` | | Yes | |

## O. UI, scheduling, platform

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| O1 | Full signed-in web app (dashboard, profile, jobs, applications, inbox, settings) | DO: IMPLEMENTED | 144 Server Actions, 16 routes | | `src/app/(app)/*` | Postgres | Next 16 | No | AGPL |
| O2 | Local web UI (Next alpha) | CO: PARTIAL | 51 API routes shelling to core scripts | | `web/**` | files | Next 16 | No | Auth/DB needed |
| O3 | Go TUI | CO: IMPLEMENTED | | `dashboard/**` | | tracker files | Go, Bubble Tea | Yes | |
| O4 | Offline HTML report | AJS: IMPLEMENTED (spec) | | `commands/html-report.md` | | | | Low | Use a generator |
| O5 | Scheduling | DO: in-process timers (5); CO: OS scheduler install scripts (PARTIAL, web alpha); AJS: CI only | | `instrumentation.ts`; `install-scan-schedule.*` | | | | Partly | |
| O6 | Accessibility testing | DO: IMPLEMENTED (axe WCAG 2.2 AA on every screen) | | `e2e/accessibility.spec.ts` | | | | Yes | |
| O7 | Opt-in usage ping, update check | DO: IMPLEMENTED (update check on by default) | | `usage-ping.ts`, `update-check.ts` | | settings | | Yes | Change hard-coded hosts |

## P. Packaging, ops, community

| ID | Feature | Repos: status | What | How | Key files | APIs / DB | Deps | Indep. | Mod. |
|---|---|---|---|---|---|---|---|---|---|
| P1 | Docker | DO: IMPLEMENTED (prod + compose + CapRover); CO: IMPLEMENTED (dev sandbox); AJS: - | | | `Dockerfile`, `compose*.yml` | | | Yes | |
| P2 | CI/CD | all: IMPLEMENTED | | | `.github/workflows/*` | | | Yes | Repo-specific names |
| P3 | Self-update / upstream sync | CO: `update-system.mjs` w/ rollback; AJS: `upstream_triage.py`; DO: update notice | | | | | git | Partly | |
| P4 | Installers / plugin manifests | CO: IMPLEMENTED (`npx @santifer/career-ops init`, Claude/Codex/Cursor plugins) | | `scaffolder/` | | | | No | |
| P5 | Community/governance features | CO: IMPLEMENTED (manifesto signatures ledger, hired wall, contributor ladder) | | `SIGNATURES.md`, `HIRED.md`, workflows | | | | No | PII; brand |
| P6 | Marketing site | DO: IMPLEMENTED (`site/`) | | | | | | Yes | Branding |
| P7 | Hosted/shared service | CO: PLANNED only (discussion #904); DO/AJS: - | | `CONTRIBUTING.md`, `TRADEMARK.md` | | | | n/a | n/a |
| P8 | DB-as-source-of-truth tracker | CO: PLANNED then explicitly rejected (`ARCHITECTURE.md` doctrine #918) | | | | | | n/a | n/a |

---

## Unique features (present in exactly one repo)

| Repo | Feature IDs |
|---|---|
| AJS only | B1 (code-level inbound guard), C2 (code-exact weighted rank), D1 (`job_key`), F11 (drafter-reviewer), G3 (LaTeX layout verify), L1 (union salary index), N7 (CI guards), A14 `/add-portal` generator, Danish portal CLIs (A4), LinkedIn search CLI (A5 search half), `fetch_page` browser-header GET |
| CO only | A1, A2, A10, A11, A15, B5 (full), B6, B7, C1, C7, C8, D2, D5, F4 (strongest), G1 hard gate, H6, H7, I1 (rich), J5, K2, K3, L2, L3, L4, M5, M8, M9, N5, N8 (CI-enforced), N9, N10, O3, P3 updater, P4, P5 |
| DO only | A7, A12 (full agent), C3, C4, C5, C9, E1 (normalised), F3 (+auto frame), F5, F6, F9 (measured), H2 (undo), H8, J1, J3, J4, J6, M2, M4, M7, N1-N4, N6, O1, O6, O7, P6 |

## Duplicate features (same capability, same repos' effort repeated)

| Capability | Repos | Evidence of duplication | Which to prefer |
|---|---|---|---|
| FreeHire client | AJS + DO | two clients of `freehire.me` API | DO adapter (typed, tested) or AJS CLI (zero deps) |
| Arbeitsagentur client | CO + DO | two clients | Either (ASSUMPTION: no comparison of test depth made); same legal caveat applies |
| HN "Who is hiring" | CO + DO | two parsers | CO (also Gemini optional) |
| RFC 9309 robots | AJS + DO | Python and TS | AJS (fail-closed documented) |
| SSRF guards | CO + DO | independent | either; CO is AsyncLocalStorage-scoped |
| Notion sync | AJS + CO | MCP spec vs plugin | CO plugin (code) |
| Interview prep | AJS + CO | two prompt suites | CO (deeper) |
| Follow-up cadence | AJS + CO | spec vs script | CO script |
| Cover letter generation | all three | | DO structure + CO verification |
| PDF text/ATS checks | AJS + CO | | CO for coverage, AJS for layout |
| Salary tools | AJS + CO | different data | keep both (complementary data) |

## Similar-but-differently-implemented

| Topic | AJS | CO | DO | Why it matters |
|---|---|---|---|---|
| Scoring | code-weighted | holistic LLM | rubric LLM / typed-question | not comparable numerically |
| Tracker | CSV | markdown + TSV + SQLite index | Postgres | different consistency/concurrency models |
| Status undo | none | ledger only | event with previous state | only DO can revert |
| Secrets | env | `.env` | encrypted DB | |
| Gmail | host MCP | own OAuth plugin (read-only) | own OAuth (send+read) | |
| Prompt-injection | sanitiser + agent isolation | rule + coverage check | marker + no tools + schema | |
| Fact checking | LLM grounding audit | deterministic hard gate | heuristic flags | |
| Dedup | slug key | 7+ layers | DB uniqueness + hash | |
| PDF | LaTeX | Chromium (+LaTeX) | Chromium via app print pages | |
| Scheduler | none | OS scheduler | in-process timers | |
| Provider config | portal CLI skills | `portals.yml` | Settings UI | |
| Expiry | `expired`/`unreachable` | `uncertain` | none | |

## Complementary features (one repo's strength fills another's gap)

| Gap | Filler | Source |
|---|---|---|
| DO has no follow-up/reminders | CO `followup-cadence` or AJS `/outcome followup` | I1 |
| DO has no interview prep | CO `modes/interview*` prompts | K1, K2 |
| DO has no liveness check | CO `liveness-core` | B5 |
| DO deduplication limited to exact ids | CO multi-layer | D2 |
| DO fact guard is heuristic | CO hard fact gate | G1 |
| DO lacks code-level inbound sanitisation | AJS `posting_guard` | B1 |
| CO has no MCP server / OAuth | DO connector | M2 |
| CO web has no auth | DO login/session pattern | N1 |
| CO has no calendar sync | DO calendar | J4 |
| CO has no Gmail send | DO | J1 |
| AJS tracker has no writer script | CO `merge-tracker`/`set-status` or DO status machine | H1, H2 |
| AJS has no UI | DO/CO UIs | O1-O3 |
| AJS only 2 enabled portals | CO providers | A1 |
| CO lacks PDF layout metrics | AJS `verify_layout` | G3 |
| CO lacks salary index data | AJS lookup | L1 |
| AJS/DO lack LLM-egress PII guard | CO privacy guard | M9 |
| AJS lacks multi-provider LLM | DO/CO provider layers | M1 |

## Missing features (no project implements; searched in docs and source)

| Gap | Evidence / note |
|---|---|
| Multi-user / team / recruiter-side tenancy | DO has no user table; CO web no auth; AJS none |
| Push/email/Slack notifications and reminders | DO none (FACT PROJECT_DOSSIER 19); CO/AJS produce lists/drafts only |
| Real currency conversion / PPP normalisation | AJS doc FACT; CO relocation tax "deliberately simplified" |
| Cross-store canonical schema and import/export between the three | none |
| Reproducible scoring benchmark shared across engines | CO golden set only 10 synthetic cases, not in CI |
| Automatic ATS submission (intentionally absent) | all three refuse by design |
| Non-Google mail/calendar built in | CO registry has third-party entries only |
| Mobile app / PWA / offline mobile | none found |
| Public REST/OpenAPI | CO none; DO only MCP |
| LinkedIn profile import | none (CO joins user `Connections.csv` only) |
| UI localisation | DO English only |
| Reference/recommender management workflow | DO stores `Reference` entries only |
| Salary data source bundled | AJS ships none |
| Audit log / MFA | DO none |

## Particularly valuable implementations

| Rank | Implementation | Why | Repo / files |
|---|---|---|---|
| 1 | Inbound posting guard | only deterministic defence against hidden-text prompt injection; tested | AJS `tools/posting_guard.py` |
| 2 | AI provider abstraction | handles per-server quirks, schema fallback, local models | DO `src/lib/ai/*` |
| 3 | Conservative liveness classifier | encodes "false expired is worse than a miss" | CO `liveness-core.mjs` |
| 4 | Multi-layer dedup | breadth of identity signals | CO `scan.mjs` exports, `listing-fingerprint.mjs` |
| 5 | LLM egress privacy guard | fail-closed PII block with category-only errors | CO `lib/privacy-guard.mjs` |
| 6 | Fact gate | hard stop on fabricated CV numbers | CO `verify-cv-facts.mjs` |
| 7 | Unit-based document model + refine/undo/versions | per-unit edits with optimistic stale check | DO `Document.units`, `jobs/refine.ts` |
| 8 | MCP server with built-in OAuth 2.1 AS | no external IdP, stateless, revocable | DO `lib/connector/*` |
| 9 | Provider modules + SSRF guard | 126 sources, safe by construction | CO `providers/*` |
| 10 | Quota-safe agent loop | records run before request; first page only; limits | DO `agent/run.ts` |
| 11 | Status machine with `furthestStage` | accurate funnel after rejection | DO `status.ts` |
| 12 | Exact weighted rank aggregation | `Fraction` rounding, vetoes, deadline logic | AJS `rank_state.py` |
| 13 | Jurisdiction legal-signal tables | rare, structured, with freshness check (re-verify legally) | CO `templates/jurisdiction-*.yml` |
| 14 | Security guard suite for agent repos | exact allowlist checks in CI | AJS `tools/security_guards.py` |
