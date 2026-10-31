# TECHNICAL_DECISIONS - ADR log for "Rho"

All entries are **Status: PROPOSED**. Six are **OPEN: they need the user's call** (ADR-001..006) and block roadmap milestones as marked. The rest are proposed defaults that stand unless someone objects; they can be flipped without blocking the plan.

Inputs: `PROJECT_AI_JOB_SEARCH.md`, `PROJECT_CAREER_OPS.md`, `PROJECT_DOSSIER.md`; companion docs `UNIFIED_PRODUCT_VISION.md`, `UNIFIED_ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `API_DESIGN.md`, `IMPLEMENTATION_ROADMAP.md`. The licence question must be read together with `LICENSE_AND_ATTRIBUTION_AUDIT.md` (written concurrently by another agent; not read here). Also exist: `CROSS_PROJECT_COMPARISON.md`, `FEATURE_INVENTORY.md`.
Labels **[F]** fact (repo path) / **[A]** assumption / **[R]** recommendation. Legal statements are **[A]** and need qualified counsel; this is an engineering analysis, not legal advice.

## 0. Index and blocking matrix

| ADR | Decision | Class | Blocks (roadmap tasks/milestones) |
|---|---|---|---|
| 001 | Licence of the new product vs AGPL dossier | **OPEN** | M0 exit (T0.2, T0.7); every dossier-derived task: T3.1-3.3 (auth design), T4.3, T4.7, T4.8, T5.7, T5.14, T6.1-T6.8, T8.5 |
| 002 | Single-user self-hosted vs multi-user SaaS | **OPEN** | T2.1, T2.5 (owner/RLS design), T3.1, T3.6 (SaaS auth), T8.2 (rate-limit model), T9.8, T10.6; changes M0 scope (Google verification lead time) |
| 003 | Language / stack | **OPEN** | M0 (T0.3 onward = everything) |
| 004 | Database: SQLite vs PostgreSQL (and ORM, ADR-021) | **OPEN** | T0.5, T1.6 (queue), all of M2, T2.5 RLS |
| 005 | Keep markdown-mode prompt system? | **OPEN** | T6.4-T6.7, T6.14; shapes M7 copy/UX for prompt customisation |
| 006 | Hosting | **OPEN** | T1.7 (file store flavour, soft), T10.1, T10.6, T10.7; soft-blocks T9.5 budgets |
| 007 | Modular monolith, workspace monorepo | proposed default | M0/M1 layout |
| 008 | Postgres-backed queue + separate worker | proposed default | T1.6 |
| 009 | Own `AiProvider` abstraction over vendor SDKs | proposed default | T6.1, T6.2 |
| 010 | Never-auto-submit as a structural invariant | proposed default (principle P1) | T8.5, T5.14, T9.3 |
| 011 | Layered prompt-injection guard | proposed default | T5.1, T6.3-T6.5 |
| 012 | One fact gate, two stages | proposed default | T6.7, T6.8, T7.5 |
| 013 | Database canonical, files as import/export | proposed default | T2.7, T5.9-T5.12 |
| 014 | Deterministic score aggregation | proposed default | T4.6, T6.6 |
| 015 | Source adapters: contract, MVP set, legal policy | proposed default | T5.2, T5.3, T5.15 |
| 016 | API style: service layer + REST v1 + envelope | proposed default | T1.1, T1.4, T8.1 |
| 017 | MCP: curated tools, no send/delete | proposed default | T8.5 |
| 018 | PDF via Chromium worker | proposed default | T5.7 |
| 019 | Secrets at rest and LLM egress guard | proposed default | T1.5, T6.3 |
| 020 | Auth: library over hand-rolled; revocable sessions | proposed default | T3.1-T3.3 |
| 021 | ORM: Drizzle vs Prisma | proposed default (spike) | T0.5, M2 |
| 022 | No default telemetry / update-check | proposed default | M8, M10 |
| 023 | Test strategy and 80% coverage gate | proposed default | M1, M9 |

Dependencies among the open decisions: ADR-002 influences ADR-004 (SQLite only plausible if single-user) and ADR-006 (hosting) and ADR-001 (SaaS makes the AGPL network clause bite); ADR-003 constrains ADR-021. Suggested order to ask the user: 002 -> 001 -> 003 -> 004 -> 006 -> 005.

---

## ADR-001 - Licence of the new product (OPEN)

**Status:** PROPOSED. **Needs user's call.** **Blocks:** see index.

**Context [F]**
- `dossier`: GNU AGPL v3, `package.json` `"license": "AGPL-3.0-only"`; `LICENSE` is the verbatim FSF text; no per-file headers; **no copyright holder stated**; `CONTRIBUTING.md` says accepted PRs are re-implemented by the maintainer, no CLA (`PROJECT_DOSSIER.md` s21). Comments credit two forks as sources of adapted code (`src/lib/agent/*` from avinashbatchala's fork; `src/lib/connector/*` from Anirudh Sharma's fork).
- `career-ops`: MIT, Copyright (c) 2026 Santiago Fernandez de Valderrama (verified `LICENSE`). Separate `TRADEMARK.md` reserves the name "career-ops" and requires permission for product names containing it. Manifesto binds licensed operators of *official* surfaces only, not code reuse (`PROJECT_CAREER_OPS.md` s21).
- `ai-job-search`: MIT, Copyright (c) 2026 Mads Lorentzen (verified `LICENSE`). Bundled Lato/Raleway fonts ship **without** licence text [F].
- AGPL s13 (network clause): modified versions offered to users over a network must offer those users the corresponding source. AGPL s5(c): a combined work is licensed as a whole under AGPL. MIT code can be included in an AGPL work; the reverse is not possible without relicensing.
- The product direction (ADR-002) interacts: a hosted SaaS built on AGPL code must publish its source.

**Options**

| | A. Clean-room: reimplement dossier's *ideas*, no dossier code | B. Adopt AGPL-3.0 and reuse dossier code | C. Keep dossier as a separate unmodified service, integrate over HTTP/MCP | D (additional). Obtain written relicence/dual-licence from dossier's copyright holder |
|---|---|---|---|---|
| Product licence | free choice: MIT / Apache-2.0 / AGPL / proprietary | AGPL-3.0 (whole product) | free, for our code; dossier remains AGPL on its own | free after grant |
| What we reuse | MIT code from career-ops + ai-job-search (keep notices); dossier only as spec | everything, incl. auth, status machine, units, AI providers, PDF, MCP, Google modules | nothing in-process | everything the grant covers |
| Effort | highest: re-derive ~12 modules; roughly +20-30% on M3-M8 [A] | lowest; fastest to feature parity | low for code, high for UX/data: two apps, two DBs | depends on holder; unknown |
| Legal risk | residual: "derivative" claims if implementers copy structure/prompt text; mitigated by spec-only workflow and provenance log [A] | low if AGPL obligations met (source offer, notices, no hard-coded upstream hosts) | boundary risk: arm's-length separate programs are generally not a combined work, but modified dossier or tight coupling may be [A, counsel] | low once written |
| Commercial/SaaS | allowed (closed or open) | allowed only as open source (s13) | allowed for our part | allowed |
| Fit with ADR-002 | any | self-host/community fits; closed SaaS impossible | **poor**: dossier is single-user, single-instance, no tenant column [F]; cannot serve multi-user | any |
| Product coherence | one codebase | one codebase | split UX/data; dossier exposes only Server Actions, 16 routes and an MCP endpoint, so integration surface is thin [F] | one codebase |
| Dual licensing later | possible | **not possible** unless every contributor/holder agrees; holder unstated [F] | n/a | per grant |
| Upstream drift | none | can cherry-pick upstream AGPL changes | tied to upstream release cadence and hard-coded hosts (telemetry, GitHub repo) [F] | none |

**Trade-offs.** B buys speed and a proven design at the cost of permanent copyleft and no commercial-closed path. A keeps all options open at the cost of effort and process discipline. C looks cheap but fails the multi-user goal and fragments UX; it is only reasonable as an *optional import/bridge* (the importer in `DATABASE_DESIGN.md` s8.4 works from dossier's own export file and is licence-neutral [A]). D is worth an email regardless: if the holder agrees, option B's speed without B's lock-in.

**Honest caveat on A.** The analysts who wrote `PROJECT_DOSSIER.md` read dossier's source. Strict clean-room separation means implementers work from the behavioural descriptions in the research docs (and `UNIFIED_*` docs), not from dossier files, and prompts/regex lists/UI copy are rewritten rather than transcribed. Keep a provenance log per module (what spec it was built from). The research docs name functions and some regex behaviour; if strict isolation is required, have counsel review those documents as the "specification" first [A].

**Recommendation [R]:** **A** (clean-room, spec-driven) with D attempted in parallel; product licence chosen separately as ADR-001b: **Apache-2.0** (patent grant, permissive, compatible with ingesting the MIT code) if the goal is adoption and keeping a hosted option; **AGPL-3.0** if the goal is to guarantee that hosted forks stay open (then B's reuse becomes available as a side effect, so decide A vs B with that in mind). Choose B only if the user prioritises time-to-parity above licensing flexibility. Reject C as primary architecture.

**Consequences if A:** T0.7 port inventory lists MIT ports and "spec-only" dossier modules; reviewers check provenance; dossier-style behaviours still adopted (units model, fact guard heuristics, status undo, job agent quota rule) but rewritten. **If B:** repo `LICENSE` AGPL-3.0, add source-offer link in UI footer, drop hard-coded dossier endpoints (telemetry `telemetry.dossier.aien.me`, GitHub `AienTech/dossier` update check) [F], retain notices, record credited fork authors. **Either way:** keep each MIT file's copyright line (T0.2) and template lineage lines (e.g. career-ops `cv-template.tex` "Based on: Gabriel Sison / sb2nov resume template, MIT" per `LICENSE_AND_ATTRIBUTION_AUDIT.md`; its compatibility matrix by new-product licence agrees with the table above), don't use the name "career-ops" (`TRADEMARK.md`), ship OFL texts for any bundled font (and do not bundle Lato/Raleway from ai-job-search without adding theirs), and verify unverified dependency licences (`@bunli/*`, `@paper-design/shaders-react`, `@modelcontextprotocol/*` - flagged [A] in the source analyses).

---

## ADR-002 - Single-user self-hosted vs multi-user SaaS (OPEN)

**Status:** PROPOSED. **Needs user's call.** **Blocks:** T2.1, T2.5, T3.1, T3.6, T8.2, T9.8, T10.6.

**Context [F]:** All three sources are single-user: dossier has no user table/owner column and global in-process queue/timers/caches (`schema.prisma` verified); career-ops web has no auth (loopback bind + origin guard) and the core is files; ai-job-search is a local workspace. career-ops `LEGAL_DISCLAIMER.md` disclaims GDPR controller/processor roles *because* it is local with no telemetry. Hosted use makes the operator custodian of CVs, email bodies, OAuth tokens [A].

**Options:** (1) Single-user self-hosted only, hard-wired. (2) Single-user-first, multi-user-ready (owner_id + Principal + RLS seams now; SaaS features later). (3) Multi-user SaaS from day one.

| | 1 | 2 (rec.) | 3 |
|---|---|---|---|
| Time to MVP | shortest | +10-15% [A] | +30-50% [A] |
| Retrofit risk | multi-user later = rewrite (dossier's situation) | low | none |
| Security/ops burden | low | low now, grows with SaaS | high: tenant isolation, abuse, incident response |
| Legal | none beyond licences | none now | controller/processor duties, ToS, DPA, scraping liability [A] |
| Google Gmail scopes | user's own client | same | app verification for restricted scopes [A] |
| AI cost | user's keys | user's keys | BYO or operator-paid (abuse/cost) |
| Licence interplay | any | any | AGPL s13 forces source release if ADR-001 = B |

**Recommendation [R]: option 2.** Ship self-hosted single-owner; build seams (owner_id on every owned table, Principal in services, per-user settings/secrets/integrations, owner in queue keys, RLS written behind a flag, registration modes). Defer billing, quotas, org/team sharing, tenant admin, GDPR processes until a go/no-go. If the user chooses 3, apply the roadmap deltas in `IMPLEMENTATION_ROADMAP.md` s5 (T3.6, T9.8 into MVP; start Google verification at W1; move ADR-006 earlier).

---

## ADR-003 - Language / stack (OPEN)

**Status:** PROPOSED. **Needs user's call.** **Blocks:** all of M0+.

**Context [F]:** dossier = TypeScript (Next 16, React 19, Prisma 7, zod 4); career-ops = Node ESM `.mjs` with TS only in `web/`, plus Go TUI; ai-job-search = Python 3 stdlib helpers (~867 test functions) + TS/Bun portal CLIs. Versions are taken from manifests and not verified here.

**Options:** (A) TypeScript end-to-end (Next.js + Node worker); (B) Python (FastAPI) backend + React front; (C) TypeScript web + Python AI/document workers; (D) Go/Rust backend.

**Trade-offs:** (A) one language for UI, API, worker, CLI, MCP; reuses dossier idioms and career-ops providers/MIT JS directly; Python tools (small, stdlib) port cleanly with their tests as spec; weaker ML/document ecosystem but we call hosted/local LLM over HTTP anyway. (B) strong for document/ML libs, but discards two JS codebases and needs a second toolchain for the UI; MCP SDK parity [A]. (C) pragmatic if heavy document parsing/layout is needed, at the cost of two runtimes and a cross-process contract. (D) not supported by any source; no.

**Recommendation [R]: A**, with `core` kept framework-free so a separate API server (Hono/Fastify) or a Python worker can be introduced later without rewriting domain logic. Next.js is chosen for the UI/BFF because two sources already prove it [F]; coupling is contained by the package rules in `UNIFIED_ARCHITECTURE.md` s2.2.

---

## ADR-004 - Database: SQLite vs PostgreSQL (OPEN)

**Status:** PROPOSED. **Needs user's call.** **Blocks:** T0.5, T1.6, all M2.

**Context [F]:** dossier uses PostgreSQL 18 with `citext`, `Json` columns, row locks (`FOR UPDATE`) and a DB trigger [F]; career-ops declares "files canonical, DB derived" and uses `node:sqlite` only as a derived index (`tracker.mjs`), explicitly ruling out DB-as-source (#918) [F]; ai-job-search has no DB.

**Options:** (1) PostgreSQL only; (2) SQLite only; (3) SQLite for self-host + PostgreSQL for SaaS (dual dialect).

| | PostgreSQL | SQLite | Dual |
|---|---|---|---|
| Ops | needs a DB container (compose handles it) | zero-ops file | both |
| Queue | `SKIP LOCKED`, cron in-DB | in-process poller; single process | two implementations |
| Concurrency | multi-writer, multi-worker | single writer; fine for one user | |
| Multi-tenant | RLS available | none | |
| Features used by design | `jsonb`, arrays, `citext`, partial indexes, FTS | JSON1 ok, no arrays/citext | lowest common denominator |
| Backup | `pg_dump` | copy file | |
| Fit | all ADR-002 options | only ADR-002 option 1 | doubles test matrix |

**Recommendation [R]: PostgreSQL only** (dossier's proven choice; supports queue, worker scale-out, RLS, and ADR-002 option 2/3). Choose SQLite only if the user commits to strictly single-user, single-process, zero-ops self-host and accepts no RLS and an in-process queue. Avoid dual dialects (doubles migrations/tests for little gain). ORM: ADR-021.

---

## ADR-005 - Keep the markdown-mode prompt system? (OPEN)

**Status:** PROPOSED. **Needs user's call.** **Blocks:** T6.4-T6.7, T6.14.

**Context [F]:** career-ops and ai-job-search implement workflows as markdown specs ("modes", slash commands, skills) executed by an external agent CLI; career-ops has 45 top-level modes + 15 locale dirs; tests pin prose wording (ai-job-search `test_*_command` spec-guard tests) and the correctness of orchestration "depends on LLM adherence" (`PROJECT_AI_JOB_SEARCH.md` s19). dossier defines tasks as typed TS functions with inline version-stamped prompts, zod-validated output and deterministic post-processing. career-ops batch workers run `claude -p --dangerously-skip-permissions` (`batch/batch-runner.sh:1509`) [F].

**Options:** (1) Keep markdown modes as the runtime (our app launches agent CLIs or exposes them as skills). (2) Prompts fully in code (dossier style). (3) Hybrid: prompts as versioned markdown files with frontmatter and schemas, executed by our runtime with deterministic post-processing; markdown modes remain an *export* for people who want to run them inside Claude Code.

| | 1 | 2 | 3 (rec.) |
|---|---|---|---|
| Server-side/multi-user | no (needs a local agent CLI per user) | yes | yes |
| Testability | wording only | schema + unit tests | schema + unit + golden sets |
| User customisation | easy (edit files) | hard | bounded "addendum" slot per task |
| Safety | broad tool access, injection blast radius larger | no tools | no tools |
| Reuse of existing prompts | maximal | rewrite | convert (career-ops `_shared.md`, `oferta.md` as starting text) |
| Cost model | user's agent subscription | BYO key/local | BYO key/local |
| Ecosystem fit (Claude Code/Codex users) | native | none | via export-skills |

**Recommendation [R]: option 3.** Task = `prompt.md` (frontmatter: id, version, inputs, output schema ref, untrusted inputs, model tier) + `schema.ts` + `post.ts` + fixtures; version `id@N` stored with each output. Provide a guarded per-user "addendum" slot (analogous to career-ops `_profile.md`/`_custom.md`) appended after system rules and never able to override safety rules. Add `rho export-skills` later. Choose option 1 only if the product is explicitly "a toolkit for Claude Code users" rather than an app.

---

## ADR-006 - Hosting (OPEN)

**Status:** PROPOSED. **Needs user's call.** **Blocks:** T10.1, T10.6, T10.7 (soft: T1.7).

**Context [F]:** dossier ships Docker + compose and a CapRover definition; app is not TLS-terminating; needs Chromium (glibc), >= 1 GB for PDF; single instance by design. career-ops Docker is a dev sandbox, not production. Neither source has a hosted offering (career-ops: hosted service only a documented intent, discussion #904) [F].

**Options:** (1) Self-host only: docs + compose, user supplies VPS/home server. (2) Managed container PaaS (Fly/Render/Railway-style) + managed Postgres. (3) Serverless web (e.g. Vercel) + separate worker host. (4) Kubernetes. (5) Operator-run SaaS on VMs/containers.

**Trade-offs:** (1) cheapest, matches P-A, privacy-friendly, support burden on users. (2) one-click-ish, handles TLS/backups, but Chromium/memory limits and cost per GB; vendor choice [A]. (3) great for web, wrong for worker (Chromium, long jobs, cron); two deployment targets. (4) overkill before SaaS. (5) only with ADR-002 = 3.

**Recommendation [R]:** container-first and host-agnostic. Reference deployment = single VPS with compose (web, worker, postgres, optional ollama) behind Caddy; publish a PaaS template as a secondary target. Avoid serverless-only. Decide a concrete provider only when ADR-002 is settled; if SaaS, prefer a managed Postgres with PITR and keep file storage S3-compatible.

---

## ADR-007 - Modular monolith in a workspace monorepo

**Status:** PROPOSED. **Context:** the sources show both failure modes: 166 flat scripts with import cycles (career-ops) and a single Next app mixing UI and logic (dossier `src/lib` 34k lines incl. tests) [F]. **Options:** microservices; monolith without boundaries; modular monolith (packages with enforced dependency rules, two entrypoints). **Recommendation [R]:** modular monolith; lint rule forbids `next/*` in `core`; pure packages have no I/O. **Trade-off:** slight upfront structure cost vs cheap later extraction.

## ADR-008 - Postgres-backed queue and a separate worker process

**Status:** PROPOSED. **Context [F]:** dossier's queue/timers are in-process (second replica would double-run timers); career-ops uses OS scheduler + bash runner. **Options:** keep in-process (simplest, single instance); Postgres queue (pg-boss-like) [A]; Redis/BullMQ; external workflow engine. **Recommendation [R]:** Postgres queue + `apps/worker`, singleton keys, cancel via `AbortController`, boot recovery, AI concurrency 1 local / 3 hosted (dossier rule [F]). **Trade-off:** no extra infra vs lower throughput than Redis (adequate; I/O-bound). **Revisit** if sustained > a few hundred jobs/min.

## ADR-009 - Own `AiProvider` abstraction over vendor SDKs

**Status:** PROPOSED. **Context [F]:** dossier's interface (text + zod-JSON, `listModels`, `test`, one corrective retry, cut-off detection, runtime server-quirk learning) is its "best reusable asset"; career-ops runners are four separate scripts. **Options:** use a multi-provider SDK (e.g. Vercel AI SDK) [A]; thin own interface over official SDKs; call providers via a gateway (OpenRouter) only. **Recommendation [R]:** own interface (small) + official SDKs; evaluate a multi-provider SDK as an adapter internals in the T0.5 spike; keep the interface free of tool-calling (HR1). **Trade-off:** more adapter code vs control of retries, schema fallback and error taxonomy.

## ADR-010 - Never-auto-submit as a structural invariant

**Status:** PROPOSED. **Context [F]:** all three forbid it (ai-job-search `apply.md`; career-ops `submit-guard.mjs` and manifesto; dossier only user-click sends). career-ops' web apply loop has a *known residual*: a custom button's JS can still submit; the submit-event interlock is documented but unimplemented [F]. **Options:** policy only; policy + tests; structural (no capability, scoped tokens, confirmation token, audit test). **Recommendation [R]:** structural, per `UNIFIED_ARCHITECTURE.md` s6.2 (HR1-HR6); MCP/PAT cannot hold `mail:send`; MCP status moves to APPLIED+ become user-confirmed proposals; no apply-assistant feature ships without the submit-event interlock. **Trade-off:** less convenient automation vs the product's core promise.

## ADR-011 - Layered prompt-injection guard

**Status:** PROPOSED. **Context [F]:** ai-job-search `posting_guard.py` (hidden HTML, invisible/tag characters, ~17 English instruction patterns, mixed-script) is advisory and English-only; dossier wraps posting text + untrusted line and gives the model no tools; career-ops relies on prompt rules, with batch workers fully permissioned. **Options:** prompt rule only; guard + rule; guard + rule + no-tools + deterministic extraction. **Recommendation [R]:** the last (architecture s6.3); extend patterns beyond English; persist verdict on posting; show the warning before the user continues. **Residual risk:** manipulation without a trace is undetectable [F ai-job-search `SECURITY.md`]; mitigated by no-tools + fact gate + human review.

## ADR-012 - One fact gate with two stages

**Status:** PROPOSED. **Context [F]:** dossier flags unbacked claims as "check this" (heuristic) but does not block export; career-ops blocks PDF generation on forbidden phrases/unbacked quantified claims. **Options:** flag only; block only; flag at generation + block at export unless acknowledged. **Recommendation [R]:** latter; acknowledgement is per unit and recorded; new confirmed facts are written back to `facts` immediately. **Trade-off:** extra clicks vs trust. Track false-positive/negative rates on a corpus.

## ADR-013 - Database canonical; files as import/export formats

**Status:** PROPOSED. **Context [F]:** career-ops doctrine "files are canonical, SQLite will never become a primary store" (#918), with 17 integrity checks and repair scripts because of markdown-table fragility; ai-job-search lets an LLM edit a CSV; dossier is DB-canonical with versioned JSON export. **Options:** keep files canonical; DB canonical + exporters; dual-write. **Recommendation [R]:** DB canonical; one-shot importers (DATABASE_DESIGN s8); export to JSON/CSV/markdown-tracker for portability; no continuous sync. **Trade-off:** departs from career-ops' philosophy; users who live in markdown/Obsidian get exports, not live editing.

## ADR-014 - Deterministic score aggregation with structured evidence

**Status:** PROPOSED. **Context [F]:** three incompatible scorers: ai-job-search weighted four dimensions (`WEIGHTS` .30/.25/.15/.30, exact rounding, bands, vetoes); career-ops holistic 1-5 with "no arithmetic formula"; dossier 0-100 AI score + reasons. **Options:** pick one verbatim; pure LLM holistic; LLM-supplied dimension scores + evidence status, code-owned aggregation, confidence, legitimacy separate. **Recommendation [R]:** the last; weights versioned and user-overridable per search profile; legacy scores imported with `legacy_score_5`. **Trade-off:** less "nuance" than a free-form model verdict vs reproducibility and testability.

## ADR-015 - Source adapters: contract, MVP set, legal policy

**Status:** PROPOSED. **Context [F]:** career-ops has 126 provider modules with a clean `{id, detect, fetch} -> Job` contract and security helpers; ai-job-search has portal CLIs (LinkedIn regex parser, brittle by its own admission); dossier has 4 adapters incl. an unofficial Arbeitsagentur key. **Options:** port all; port a curated set; rely on aggregator APIs only. **Recommendation [R]:** port the contract and security helpers; MVP adapters Greenhouse, Lever, Ashby, FreeHire; v1 aggregators + ~20 more; others via community contract later. Sources with ToS/legal risk (Arbeitsagentur, LinkedIn guest endpoints) are off by default with per-user acknowledgement and a server-wide kill switch. Drop `local-parser`.

## ADR-016 - API style: service layer + REST v1 + common envelope

**Status:** PROPOSED. **Options:** server actions only (dossier); REST only; GraphQL; tRPC. **Recommendation [R]:** services are the API; Server Actions for the UI; REST `/api/v1` for CLI/integrations with the envelope `{success, data, error, meta}`; MCP/CLI are adapters; OpenAPI generated from zod. **Trade-off:** two thin adapters (action + REST) vs one; justified by the CLI/MCP/integration requirement. Details in `API_DESIGN.md`.

## ADR-017 - MCP: curated tools, no delete/send, OAuth 2.1

**Status:** PROPOSED. **Context [F]:** dossier exposes 11 tools, no delete/archive/send, with an in-app OAuth 2.1 AS (DCR, PKCE S256, signed tokens, revocation by generation). **Recommendation [R]:** same posture; tokens per user; status moves to APPLIED+ require user confirmation; untrusted marking on posting/email payloads. Build after REST is stable (v1).

## ADR-018 - PDF via Chromium in the worker

**Status:** PROPOSED. **Context [F]:** dossier and career-ops both render HTML to PDF with Playwright; page-limit trimming measured on the real PDF; ai-job-search uses LaTeX + Poppler (heavy). **Options:** Chromium; LaTeX; a JS PDF library. **Recommendation [R]:** Chromium (shared browser, pool 2, origin-restricted, path-bound token); LaTeX as optional later path. **Trade-off:** ~1 GB memory budget and Debian base image.

## ADR-019 - Secrets at rest and LLM egress guard

**Status:** PROPOSED. **Context [F]:** dossier AES-256-GCM with HKDF per-purpose keys; career-ops fail-closed outbound guard with protected values and optional redaction; both limited by heuristics. **Recommendation [R]:** adopt both: encrypted per-user secrets with key version; egress guard in the provider base class (block by default). **Note:** delegating to external agent CLIs bypasses any guard (career-ops `LEGAL_DISCLAIMER.md` s2), another reason for ADR-005 option 3.

## ADR-020 - Auth: library-backed, revocable sessions, scoped tokens

**Status:** PROPOSED. **Context [F]:** dossier's stateless JWE cookie bound to a password fingerprint is excellent for one user and awkward for N; career-ops web has no auth. **Options:** hand-roll; Auth.js; Better Auth; external IdP. **Recommendation [R]:** library for sessions/OIDC [A: pick after T0.5 spike], our own throttle, PATs and MCP OAuth AS; argon2id with dossier's parameters as a baseline. **Trade-off:** dependency vs security-sensitive custom code.

## ADR-021 - ORM / query layer

**Status:** PROPOSED (decided in T0.5 spike). **Options:** Prisma 7 (dossier precedent, 34 migrations); Drizzle [A]; Kysely/SQL-first. **Criteria:** RLS with per-transaction `SET LOCAL`, `FOR UPDATE`, partial indexes, `citext`, migration ergonomics, generated types. **Recommendation [R]:** Drizzle (SQL-near) unless the spike shows RLS/session-variable friction is acceptable in Prisma and the team prefers its DX.

## ADR-022 - No default telemetry or update checks

**Status:** PROPOSED. **Context [F]:** dossier has an opt-in usage ping and an on by default GitHub release check with hard-coded hosts that would phone home from forks; career-ops and ai-job-search ship none (career-ops states no telemetry). **Recommendation [R]:** none by default; optional operator-configured endpoints; update notices come from the deployment layer.

## ADR-023 - Test strategy and 80% coverage gate

**Status:** PROPOSED. **Context [F]:** dossier: Vitest projects (node/db/dom), real-Postgres tests with destructive-DB guard, Playwright E2E with fakes + axe, coverage ratchet; career-ops: huge `node:test` suite, cross-platform CI; ai-job-search: unittest + spec-guard tests (prose pinning). **Recommendation [R]:** dossier-style layout, ported MIT test suites as specs, prompt golden sets, security audit tests as blocking CI; 80% global floor with package floors and a ratchet (`IMPLEMENTATION_ROADMAP.md` s6). **Trade-off:** CI time (career-ops full run ~11 min on slowest leg [F]) vs confidence; use sharding and `--quick` tiers.

---

## Decisions the user must make (summary)

1. **Licence (ADR-001):** A clean-room (rec.) / B adopt AGPL / C separate service / D ask dossier's holder for relicence. Sub-choice: product licence (Apache-2.0 rec. under A).
2. **Single-user vs SaaS (ADR-002):** rec. single-user-first, multi-user-ready.
3. **Language/stack (ADR-003):** rec. TypeScript end-to-end.
4. **Database (ADR-004):** rec. PostgreSQL only.
5. **Markdown-mode prompts (ADR-005):** rec. hybrid (task files executed by our runtime; modes exported).
6. **Hosting (ADR-006):** rec. container-first, VPS+compose reference, PaaS template.
