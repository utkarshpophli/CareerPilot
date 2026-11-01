# LICENSE_AND_ATTRIBUTION_AUDIT - ai-job-search, career-ops, dossier

Date: 2026-11-01. Read-only audit of `C:\Projects\project_rho\{ai-job-search,career-ops,dossier}`. I opened the actual LICENSE, `package.json`, font licence, TRADEMARK, MANIFESTO, GOVERNANCE, CONTRIBUTING and related files (paths cited). Nothing installed or run.

**NOT LEGAL ADVICE.** I am not a lawyer. This document reports what the source files show and gives engineering-level reading of common licence terms. Have qualified counsel review before any copy, fork, redistribution, hosted offering, or product naming decision (see section 9).

Labels: FACT = verified in a file (path given). ASSUMPTION = inference or general licence knowledge, not proven by the repo. RECOMMENDATION = my advice.

## 1. Summary table

| Item | ai-job-search (AJS) | career-ops (CO) | dossier (DO) |
|---|---|---|---|
| Licence | MIT (FACT `LICENSE`) | MIT (FACT `LICENSE`; `package.json` `"license": "MIT"`; `CITATION.cff` `license: MIT`) | GNU AGPL v3 (FACT `LICENSE`, 661 lines, "Version 3, 19 November 2007"; `package.json` `"license": "AGPL-3.0-only"`) |
| Copyright holder named | "Copyright (c) 2026 Mads Lorentzen" | "Copyright (c) 2026 Santiago Fernandez de Valderrama" | **Not named.** LICENSE carries only the FSF's 2007 notice and the unfilled placeholder `Copyright (C) <year> <name of author>` (line 633). No NOTICE/COPYRIGHT file (FACT: none found). |
| Contributors beyond holder | many (git: Mads Lorentzen 123 commits, Ayobami Adegoke 75, Rudy Mizrahi Celekli 41, Oscar Madera 33, ...) | 409 contributors per `funding.json` | 2 git authors: `Alien <[email omitted]>` 24 commits, `Ali Hassan` 1; plus fork-adapted code (below) |
| Inbound-licence statement for contributions | none found (FACT: no "licen" statement in `CONTRIBUTING.md`; credit norm = `Co-authored-by`, line 39) | yes: "Contributions to the codebase are governed by the MIT LICENSE" (FACT `CONTRIBUTING.md` line 265) | none; no CLA/DCO. PRs are re-implemented by the maintainer and closed, not merged (FACT `CONTRIBUTING.md`) |
| NOTICE / per-file headers | none / none observed | none; sub-directories carry own MIT LICENSE files | none / none (FACT grep for `SPDX`, `Copyright` in `src`, `prisma`, `scripts`, `docker` found nothing; fonts excepted) |
| Trademark policy | none found (FACT: grep "trademark" in .md/.json/.html found none) | **Yes: `TRADEMARK.md`** | none found (same grep) |
| Governance docs that bind reuse | none | MANIFESTO/GOVERNANCE do not bind MIT code reuse; bind licensed operators of "official surfaces" (section 4) | none |
| Bundled third-party assets | Lato + Raleway fonts (no licence text shipped) ; `cover.cls` ; mascot GIF ; README SVGs | DM Sans, Space Grotesk (+ web Inter, Instrument Serif), all OFL with texts; two LaTeX/HTML resume-template lineages | 20 OFL font families with texts; code adapted from two named forks |
| Copyleft | none | none in own code; transitive LGPL/MPL in web lockfile | strong copyleft + network clause |

## 2. ai-job-search

| Question | Answer |
|---|---|
| Licence type | MIT. FACT `LICENSE` (21 lines). README badge and "## License: MIT" (line 448-450). |
| Copyright holder | Mads Lorentzen, 2026 (FACT `LICENSE` line 3; `.github/FUNDING.yml`: `github: MadsLorentzen`). |
| Attribution requirement | Keep the copyright notice and permission notice "in all copies or substantial portions of the Software" (FACT `LICENSE`). No attribution-in-UI, no advertising clause. |
| Distribution obligations | Include the MIT text with copies. No source-offer duty. No patent grant (ASSUMPTION: MIT has none express). No warranty. |
| Third-party / bundled | (1) `cover_letters/OpenFonts/fonts/lato/*.ttf` and `raleway/*.otf`: **no licence file ships with them** (FACT: `find` for licen/OFL/NOTICE/COPYING returned only root `LICENSE`). ASSUMPTION: Lato and Raleway are SIL OFL 1.1; OFL requires the licence/copyright to accompany redistributed font files. (2) `cover_letters/cover.cls`: header says `\ProvidesClass{cover}[2024/04/30 Cover letter class]`, no author/licence line (FACT grep); provenance UNVERIFIED. (3) `cv/main_example.tex` loads `moderncv` (not bundled; ASSUMPTION LPPL). (4) `assets/mascot/pip_flight_loop.gif`, `assets/readme/*.svg`: provenance not stated (ASSUMPTION project-owned). (5) Dependencies: no lockfile, no Python manifest (FACT `.gitignore:2`), so licences cannot be read from files. `@bunli/core 0.9.1` and `@bunli/utils 0.6.0` UNVERIFIED. `zod`, `node-html-parser`, `typescript` (ASSUMPTION MIT/MIT/Apache-2.0). |
| Trademark | none found. |
| Governance / ethics docs | `SECURITY.md`, `CONTRIBUTING.md` (credit norm). Nothing licence-conditioning. |
| Third-party service terms | LinkedIn CLI states "Personal use only (LinkedIn ToS)" in `.agents/skills/linkedin-search/cli/package.json` description (FACT). This is a third-party ToS, not a licence term, but a reuse risk. README says FreeHire backend is MIT and self-hostable (claim by README; not verified here). |
| Reuse implication | Code can be copied under MIT with notice. RECOMMENDATION: do not copy the font binaries unless you add upstream OFL texts; verify `cover.cls` origin first. |

## 3. career-ops

| Question | Answer |
|---|---|
| Licence type | MIT. FACT `LICENSE`; `package.json` line 109; `CITATION.cff`; `README.md` "## License & Trademark" (line 690). |
| Copyright holder | Santiago Fernandez de Valderrama, 2026 (FACT `LICENSE`; `TRADEMARK.md` footer; `funding.json` entity). |
| Attribution requirement | MIT notice retention (FACT). Additionally the project *invites* "based on career-ops" / "fork of" lineage statements "with attribution" (`TRADEMARK.md`, "What you can do without asking"), and `CITATION.cff` asks citation (message: "If you use career-ops, please cite it"). Those two are requests, not licence conditions (ASSUMPTION; MIT text contains no such condition). |
| Distribution obligations | MIT text with copies. Sub-package LICENSE files all MIT, same holder: `scaffolder/LICENSE`, `antigravity-directory/LICENSE`, `claude-directory/LICENSE`, `cursor-directory/LICENSE`, `openai-directory/LICENSE` (FACT). `plugins/_template/LICENSE` is MIT with holder "the career-ops-plugin-{{NAME}} authors" (FACT). `templates/cv-template.tex` header: "Based on: Gabriel Sison / sb2nov resume template, License: MIT" (FACT). |
| Bundled third-party | **Fonts (OFL 1.1, texts present, FACT):** `fonts/dm-sans-OFL.txt` ("Copyright 2014 The DM Sans Project Authors"), `fonts/space-grotesk-OFL.txt`; `fonts/README.md` states OFL "requires the license to accompany any redistribution". Web UI: `web/src/assets/fonts/{inter,instrument-serif}/OFL.txt` (FACT; README cites `@fontsource` 5.2.8). **Template lineage:** `templates/cv-template.tex` and `cv-template.cjk.tex` ("Based on: cv-template.tex (Gabriel Sison / sb2nov resume template)"); `templates/cv-template.jake.html` is "An HTML port of 'Jake's Resume'" (FACT header); upstream licence of Jake's Resume not stated in file: UNVERIFIED. **Design reference:** `docs/PRIVACY.md` line 244: `PIIGuard` pattern adapted from `asimthaha/hunter`; hunter's licence UNVERIFIED. **Runtime data (not bundled):** `scan-ats-full.mjs` fetches `Feashliaa/job-board-aggregator` dataset from raw.githubusercontent.com (FACT line 105); dataset licence UNVERIFIED. **Credit in docs:** `docs/COWORK.md` "Credit where due" names `woolly-earth/career-ops-cowork-guide`. **Dependencies (FACT from `web/package-lock.json`, which stores licence fields):** direct web deps MIT, Apache-2.0 (`@paper-design/shaders-react` 0.0.80, `pdfjs-dist`, `playwright-core`, `class-variance-authority`, `typescript`), ISC (`lucide-react`). Whole lock: 170 MIT, 42 Apache-2.0, 12 MPL-2.0, 10 LGPL-3.0-or-later (+4 combined with Apache/MIT), 5 ISC, 2 0BSD, 1 each Python-2.0, CC-BY-4.0, BSD-3-Clause. Root deps (`@google/generative-ai`, `dotenv`, `js-yaml`, `playwright`, `undici`): no root lockfile (FACT), ASSUMPTION Apache-2.0 / BSD-2 / MIT / Apache-2.0 / MIT. Go deps (Bubble Tea etc.): ASSUMPTION MIT, `golang.org/x/sys` BSD-3. |
| Trademark | **`TRADEMARK.md`** (FACT). Reserved: product/service/company names containing "career-ops" or variants ("career-ops Cloud/Pro/SaaS", "CareerOps by [vendor]"); endorsement/affiliation claims ("Powered by career-ops", "Official career-ops"); domains, social handles, app-store listings for commercial purposes; logos, wordmarks, colour schemes, visual identity in commercial contexts; compatibility certifications. Allowed without asking: forking/modifying, "works with / based on / fork of / extends career-ops" with attribution, distinct fork names, educational/journalistic/personal use. Permission by email `[email omitted]`, "Trademark request"; revocable, non-exclusive by default. Footer: `"career-ops"(TM)`, application filed with OEPM (Spain) classes 9 and 42, registration pending (FACT). MIT is stated not to grant brand rights. |
| Official surfaces clause | "Official surfaces" (official web experience, opt-in shared service) may be run by an operator licensed by the maintainer. Operator is bound by the nine MANIFESTO rights, may not charge candidates or paywall/degrade the open core, must be disclosed by name, licence term renewable and reverts on change of control, no money-buyable ranking (FACT `TRADEMARK.md` "Official surfaces"; `CONTRIBUTING.md` lines ~115-117). |
| Other legal text | `LEGAL_DISCLAIMER.md`: local tool, no GDPR controller/processor role, hallucination and ToS warnings, EU AI Act statement, **section 7 indemnification "By using career-ops, you agree to indemnify, defend, and hold harmless the authors..."**, cost responsibility, section 10 trademark pointer. ASSUMPTION: the indemnity is not a condition of the MIT grant and its enforceability is unclear; do not copy it into another product without counsel. |

## 4. career-ops manifesto / governance: do they bind reuse?

| Document | What it is (FACT) | Binds reuse of MIT code? | Basis |
|---|---|---|---|
| `LICENSE` | MIT, unconditional | n/a (the grant) | text |
| `MANIFESTO.md` | v1.0 "signed at 60,000 stars. July 14, 2026"; practice + nine "Your rights" (invisible by default; no one proposes you without your yes; human yes; you never pay; ...). Closing: "the project ... remains its first reference implementation, nothing more. Build your own. Implementations welcome." | **No** for code under MIT: nothing in `LICENSE` conditions the grant on it; no file states it is a licence term (checked LICENSE, CONTRIBUTING, README, TRADEMARK). **Yes** for operators of an *official surface* licensed under TRADEMARK.md (FACT `TRADEMARK.md`, `CONTRIBUTING.md`). Also used as the source-acceptance standard (`CONTRIBUTING.md` line 136: "rules are the CareerOps Manifesto applied to sources") i.e. it binds *contributions to this repo*. |
| `SIGNATURES.md` | public ledger of signatories (GitHub handle, display name, date, id, src URL, ordinal) | n/a. PII: do not copy. | file text |
| `GOVERNANCE.md` | BDFL model; contributor ladder; maintainer decides architecture (CLAUDE.md/AGENTS.md, scoring, data contract) | No (process for this repo) | text |
| `MAINTAINERS.md`, `CONTRIBUTORS.md`, `HIRED.md` | people lists and personal hire stories with GitHub handles | n/a. PII; do not copy. | file text |
| `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md` | community policy | No | |
| `LEGAL_DISCLAIMER.md` | acceptable-use text (no auto-submit, no ToS-violating scraping, no spam), indemnity | Not a licence condition (ASSUMPTION); but "unacceptable use" list expresses project policy | section 5 |
| `CITATION.cff` | citation metadata | Request only | file |
| `DATA_CONTRACT.md` | system vs user data layers | No (technical) | |

RECOMMENDATION: if you reuse CO code and want to align ethically, adopt the practices voluntarily; do not market the product as the CareerOps "official" implementation.

## 5. dossier

| Question | Answer |
|---|---|
| Licence type | AGPL-3.0-only. FACT `package.json` line 5; `LICENSE` is the verbatim FSF AGPLv3; README badge "License: AGPL-3.0" (line 14). The "How to Apply" boilerplate in `LICENSE` (lines 621-640) contains the generic "(at your option) any later version" text, but it is the unmodified template; no source file carries a header, and `package.json` says `-only`. Treat as v3 only (ASSUMPTION). |
| Copyright holder | **Not stated in any file I found** (FACT). Evidence of authorship only: git authors `Alien <[email omitted]>` (24 commits) and `Ali Hassan` (1); GitHub org/repo `AienTech/dossier` (FACT `src/lib/releases.ts` line 4); domain `dossier.aien.me` (`package.json` name). ASSUMPTION: copyright is held by the author(s) "Alien"/AienTech and any contributors; confirm with the owner. |
| Attribution requirement | AGPL s.4-6 and s.5(a)-(d): keep copyright notices and licence text; modified versions must carry "prominent notices stating that you modified it, and giving a relevant date" (s.5a); interactive UIs of modified works must display Appropriate Legal Notices (s.5d). |
| Distribution obligations | Conveying copies (including container images) in object form requires Corresponding Source (s.6); whole work under AGPL (s.5c); no further restrictions (s.10); patent licence from contributors (s.11). **s.13 (LICENSE lines 540-559):** "if you modify the Program, your modified version must prominently offer all users interacting with it remotely through a computer network ... an opportunity to receive the Corresponding Source of your version ... at no charge". Running an unmodified copy does not trigger s.13 by its text (ASSUMPTION on reading). |
| Source-offer plumbing in the app today | The sidebar `RepositoryLink` ("Star on GitHub") points to `REPOSITORY_URL = https://github.com/AienTech/dossier` (FACT `src/app/(app)/repository-link.tsx`, `src/lib/releases.ts`). A modified, network-served fork must offer *its own* source: RECOMMENDATION change `RELEASES_REPOSITORY` and provide a visible source link; also change telemetry host (`usage-ping.ts`) and update-check repo so a fork does not phone the original. |
| Third-party / adapted code (credited) | FACT comments: `src/lib/agent/run.ts` line 27 and `agent/draft.ts` line 25 "Adapted from avinashbatchala's fork of Dossier"; `ai/tasks/score-posting.ts` lines 10-11 same; `connector/oauth.ts` lines 13-14 and `connector/tools.ts` lines 32-33 "adapted from Anirudh Sharma's fork of Dossier". The licence under which those forks' authors contributed is not in this repo (UNVERIFIED). ASSUMPTION: derivatives of an AGPL work, therefore AGPL-bound; but this means copyright in these parts may belong to people other than the main author, which matters for any relicensing request. |
| Bundled fonts | 20 families under `src/fonts/*/OFL.txt` (FACT, headers verified): EB Garamond (2017), Fraunces (2018), Geist (2024), IBM Plex Sans/Mono/Arabic/Devanagari/JP/KR (2017 IBM Corp., Reserved Font Name "Plex"), Inter (2020), JetBrains Mono (2020), Libre Caslon Text (2018), Lora (2011, RFN "Lora"), Manrope (2018), Newsreader (2020), Noto Sans SC (2014-2021 Adobe, RFN "Source"), Playfair Display (2017), Source Serif 4 (2014), Space Grotesk (2020), Work Sans (2019). `src/fonts/README.md`: fonts converted to WOFF2 without subsetting except Noto Sans SC (subset to GB 2312, weight axis limited; file `NotoSansSC-Variable.woff2`, which avoids the RFN "Source"). OFL obligations: ship each OFL.txt with the font files; no standalone sale; do not use a Reserved Font Name for modified versions (ASSUMPTION on OFL reading). |
| Dependencies | Licences not readable offline: `yarn.lock` carries no licence field; no `node_modules` (FACT per project doc). ASSUMPTIONS (project doc): MIT for most (`next`, `react`, `zod`, `jose`, radix-ui, dnd-kit...), ISC `lucide-react`, BSD-2 `mammoth`, Apache-2.0 `openai`, `playwright-core`, Prisma, `typescript`; `@modelcontextprotocol/server` licence to verify; `@axe-core/playwright` MPL-2.0 dev-only. |
| Container image components | `postgres:18-alpine`, `node:24-trixie-slim`, Playwright Chromium, optional `ollama/ollama`: each has own licence (ASSUMPTION; not verified). Relevant only if you redistribute an image. |
| Third-party data/API terms | Adzuna attribution ("Jobs by Adzuna" with locale link rule; FACT per project doc 10.1); Arbeitsagentur integration uses a public static key and is self-declared unofficial / against the agency's terms (FACT `sources.ts` per project doc; `README`); JSearch/FreeHire/TypeSafe terms not reviewed. |
| Trademark | none found. Absence of a policy does not mean no trademark rights (ASSUMPTION): do not reuse the "Dossier" name/branding without asking. |
| Governance docs | `CONTRIBUTING.md` (3 PR rules; maintainer re-implements and credits in release notes), `PRIVACY.md`, `SECURITY.md`, `DEVELOPMENT.md`: none conditions the licence. PRIVACY.md/CONTRIBUTING.md source rules are project policy for contributions. |

## 6. Compatibility analysis: AGPL-3.0-only (dossier) vs MIT (ai-job-search, career-ops)

| Direction | Possible? | Result | Basis |
|---|---|---|---|
| MIT code into an AGPL project | Yes | Combined work is distributed under AGPL; the MIT portions keep their MIT notice | MIT is permissive; GPL-family compatible (ASSUMPTION: standard FSF view) |
| AGPL code into an MIT project | No (as MIT) | The combined work must be AGPL-3.0; you cannot relicense Dossier code as MIT | AGPL s.5(c), s.10 |
| AGPL code into GPL-3.0 project | Yes with caveat | s.13 para 2 lets you combine with GPLv3 works; AGPL terms (incl. network clause) continue to apply to the AGPL part | LICENSE lines 551-559 |
| AGPL-3.0-only code and "or later" | No | Cannot upgrade; `-only` | `package.json` |
| Using Apache-2.0 deps (Playwright, Prisma, `openai`) in an AGPL product | Yes (ASSUMPTION: Apache-2.0 is GPLv3-compatible) | | |
| Using LGPL-3.0 transitive deps (CO web lockfile) | Generally yes with relinking/notice duties if redistributed (ASSUMPTION) | | |

Key point (FACT from text): s.13 differs from plain GPL; the "network clause" triggers on *modifying* the Program and letting users interact remotely, not on merely running it.

## 7. What each reuse mode implies

Legend for "OK" is under the assumptions stated; counsel should confirm.

| Mode | MIT sources (AJS, CO) | AGPL source (DO) |
|---|---|---|
| **(a) Copy code into a new product** | Allowed for any new-product licence, including proprietary. Must keep the copyright + permission notice with the copied portions (FACT LICENSE). CO also: do not use the "career-ops" name/brand commercially (TRADEMARK.md). Keep OFL texts if you also copy fonts. No source-disclosure duty. | The new product's combined work must be AGPL-3.0 (s.5c). Must make Corresponding Source available when conveying (s.6) and to remote users if you modify and serve it (s.13). Keep notices, mark changes with dates (s.5a). Cannot be closed-source or MIT/Apache-licensed as a whole. Dual/commercial relicensing requires every copyright holder's consent, and the holder(s) are not identified in the repo (FACT). |
| **(b) Copy AGPL code (explicit)** | n/a | Same as (a) right column; mixing MIT code in is fine. Practical: copy at module level but expect the whole distributed product to be AGPL. |
| **(c) Reimplement from ideas/architecture only** | No licence obligations from the code licence if no protected expression is copied (ASSUMPTION: copyright protects expression, not ideas, algorithms, or architecture). Still avoid copying prompt text, tables of data (CO `templates/jurisdiction-*.yml`, `modes/*.md`), error strings, and test fixtures verbatim; those are expression. Do not use the name. Some third-party data in the YAML tables comes from public regulators; check source terms. | Same: ideas, schemas-as-concepts, and algorithms may be reimplemented under any licence if you do not copy code, prompts, or distinctive structure. Risk grows with line-by-line porting or reading code while writing "clean-room" (RECOMMENDATION: separate reader and writer for sensitive modules, document provenance). The AI prompts in `src/lib/ai/tasks/*.ts` are expression: write your own. |
| **(d) Call as a separate process/service** | Free; no obligations while you merely invoke it. If you *ship* it inside your product (container, installer), include the MIT notice. Example: `python tools/posting_guard.py`, `node scan.mjs --json`. | Your own code that talks to an unmodified Dossier over HTTP/MCP is, in the commonly stated FSF view, a separate work (ASSUMPTION: arm's-length communication, no shared address space or intimate data structures). Obligations then attach to Dossier itself: if you distribute it, give source (s.6); if you modify it and users interact with it remotely, offer source (s.13). Hosting unmodified Dossier for others is not a s.13 trigger by its text but conveying images is s.6. Intimate coupling (importing its TS modules, sharing its DB schema/Prisma client) would likely make a combined work. |

## 8. New-product licence choices vs reuse modes

Rows = licence you pick for your own new product. Cells = compatible with that reuse mode (Yes / No / Conditional).

| New product licence | (a) Copy MIT code | (b) Copy AGPL code | (c) Ideas only | (d) Separate process |
|---|---|---|---|---|
| Proprietary / closed | Yes (keep notices; no CO name) | **No** | Yes | Yes for both; do not bundle/modify DO without meeting AGPL for that component |
| MIT | Yes | **No** | Yes | Yes |
| BSD-3-Clause | Yes | **No** | Yes | Yes |
| Apache-2.0 | Yes (ASSUMPTION: MIT code can be included; keep MIT notices) | **No** | Yes | Yes |
| MPL-2.0 | Yes | **No** | Yes | Yes |
| LGPL-3.0 | Yes | **No** (AGPL stronger than LGPL) | Yes | Yes |
| GPL-2.0-only | Yes | **No** (AGPLv3 incompatible with GPLv2-only; ASSUMPTION) | Yes | Yes |
| GPL-3.0 | Yes | Conditional: allowed to combine (s.13 para 2) but AGPL terms stay on the AGPL part | Yes | Yes |
| **AGPL-3.0** | Yes | **Yes** (only fully compatible choice for copying DO code) | Yes | Yes |
| Source-available / SSPL / BSL / non-commercial | Yes (MIT portions only) | **No** (adds restrictions; s.10) | Yes | Yes |
| Dual-licence (open + commercial) | Yes | **No** unless every DO copyright holder agrees (holder not named; fork-adapted parts add more holders) | Yes | Yes |

RECOMMENDATION: if you want maximum freedom (closed or permissive), restrict yourself to AJS/CO code plus ideas from DO, and treat DO as an unmodified separate service. If AGPL is acceptable, DO is the strongest base and can absorb MIT modules.

## 9. Legal-review note and open items

This is an engineering reading, not legal advice. Before shipping, obtain legal review, especially for: AGPL derivative/aggregate boundaries in your architecture; hosted-service obligations (s.13); trademark use of "career-ops"; scraping/ToS exposure (LinkedIn, Arbeitsagentur key, ~126 CO sources); privacy law (CV/PII processed by LLM vendors); the indemnification text in `LEGAL_DISCLAIMER.md`.

Unverified items to resolve (UNVERIFIED because not decidable from the files):
1. AJS: licence of Lato/Raleway binaries and `cover.cls` origin; `@bunli/*` licences; all transitive deps (no lockfile).
2. CO: upstream licences of Jake's Resume HTML lineage, `asimthaha/hunter` (design reference), `Feashliaa/job-board-aggregator` dataset; root dependency licences (no lockfile); which packages carry the LGPL-3.0/MPL-2.0 in the web lock (run `npm ls` + licence tool).
3. DO: copyright holder identity; licence of the two credited forks' contributions; dependency licences (`yarn licenses list`); `@modelcontextprotocol/server`; container-image components; whether a CLA/relicensing path exists.
4. Third-party API/data terms: JSearch, Adzuna (attribution), FreeHire, TypeSafe, Arbeitsagentur, LinkedIn.

## 10. Attribution notices to keep (checklist)

MIT requirement text (FACT, identical in both MIT LICENSEs): "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software."

| # | Notice to keep | Applies when | Source |
|---|---|---|---|
| 1 | "MIT License / Copyright (c) 2026 Mads Lorentzen" + full permission paragraph + warranty disclaimer | you copy any AJS code/docs/templates | `ai-job-search/LICENSE` |
| 2 | "MIT License / Copyright (c) 2026 Santiago Fernandez de Valderrama" + permission + disclaimer | you copy any CO code/prompts/templates | `career-ops/LICENSE` |
| 3 | The sub-package MIT LICENSE if you copy that directory (`scaffolder/`, `*-directory/`, `plugins/_template` with its placeholder holder) | per directory | those LICENSE files |
| 4 | Template lineage line "Based on: Gabriel Sison / sb2nov resume template, License: MIT" | you copy `cv-template*.tex` | file header |
| 5 | AGPL-3.0 text, copyright notices, change markers with date (s.5a), prominent source offer for remote users (s.13), Corresponding Source when conveying (s.6), dossier credits (`avinashbatchala`, `Anirudh Sharma` comments) kept in the files | you copy any DO code | `dossier/LICENSE` and file comments |
| 6 | Each OFL.txt next to its font files (CO `fonts/`, `web/src/assets/fonts/*`; DO `src/fonts/*`), keeping the copyright lines; no standalone sale; honour Reserved Font Names (Plex, Lora, Source, Playfair Display...) | you copy font files | `OFL.txt` files |
| 7 | AJS Lato/Raleway: add upstream licence texts (they are missing today) or do not copy | you copy those fonts | FACT absent |
| 8 | CO TRADEMARK: do not use "career-ops" in product/domain/handle/logo; "based on career-ops" statements permitted with attribution | any public naming | `career-ops/TRADEMARK.md` |
| 9 | Third-party data attribution (e.g. Adzuna "Jobs by Adzuna") if you use those sources | use of those APIs | per DO source doc |
| 10 | Citation request (`CITATION.cff`) | optional | request only |
| 11 | A NOTICE/THIRD_PARTY file in your new product that lists: AJS MIT, CO MIT, any DO AGPL parts, fonts, template lineage, key dependencies | always, RECOMMENDATION | n/a |
| 12 | Strip personal data copied by accident: `SIGNATURES.md`, `HIRED.md`, `CONTRIBUTORS.md`, `MAINTAINERS.md` (handles and stories) | do not copy | PII |
| 13 | For DO derivatives: replace hard-coded `AienTech/dossier` repo constant, telemetry host, Arbeitsagentur key and "Star on GitHub" with your own source link/values | before deploying a fork | `src/lib/{releases,usage-ping}.ts`, `arbeitsagentur.ts` |

## 11. Bottom line

| Question | Answer |
|---|---|
| Can I copy AJS/CO code into a closed product? | Yes under MIT with notices; avoid the "career-ops" name; resolve font/template provenance; run a dependency licence scan. |
| Can I copy DO code into a closed or MIT product? | No. The product (as combined work) would have to be AGPL-3.0; holder identity is not stated, so a commercial relicence is not obtainable from the repo alone. |
| Can I take only DO's ideas? | Yes, if you write your own code and prompts. |
| Can I run DO unmodified beside my product? | Generally yes as a separate service; meet AGPL for DO itself (source for what you convey; s.13 only if you modify). |
| Do the career-ops manifesto/governance bind me? | Not for MIT code reuse. They bind licensed operators of official career-ops surfaces and contributors to that repo. |
| What is missing from the repos? | DO copyright holder and NOTICE; AJS font licence texts and `cover.cls` provenance; any lockfile-based licence data for AJS and CO root. |
