# Third-party notices

CareerPilot is licensed under the GNU Affero General Public License v3.0 only (see `LICENSE`).

**Copyright (C) 2026 Utkarsh Pophli** for the changes and additions made in CareerPilot. The parts that come from other projects keep their own copyright and licence, listed below.

## Modified version notice (AGPL-3.0 section 5)

CareerPilot is a modified version of **dossier**. It was renamed and changed substantially: new Activity Ledger, Runs, REST API, `pilot` command line, agent-access rules, security hardening, and features ported from two MIT-licensed projects. The history of changes is the git history of this repository, starting from the commit that added `apps/web`. The corresponding source for any running copy is the repository at the commit or release it was built from.

## Projects this is built from

| Project | Where | Licence | Copyright |
|---|---|---|---|
| dossier | `apps/web` (modified; this is the base of the application) | AGPL-3.0-only (`apps/web/LICENSE`) | No holder is named in the upstream repository. Upstream authors in its git history: "Alien" (AienTech) and Ali Hassan. Code adapted from forks by avinashbatchala and Anirudh Sharma is credited in the comments of `src/lib/agent/*`, `src/lib/ai/tasks/score-posting.ts` and `src/lib/connector/*`; the licences of those two forks are not recorded in the upstream repository. |
| career-ops | `upstream/career-ops` (reference copy; code ported into `apps/web` as needed) | MIT | Copyright (c) 2026 Santiago Fernández de Valderrama |
| ai-job-search | `upstream/ai-job-search` (reference copy; code ported into `apps/web` as needed) | MIT | Copyright (c) 2026 Mads Lorentzen |

Files ported from the two MIT projects keep their origin path and copyright line at the top (for example `apps/web/src/lib/guards/posting-guard.ts`, ported from ai-job-search's `tools/posting_guard.py`).

### MIT licence text (career-ops, ai-job-search)

This text applies to the portions of career-ops and ai-job-search that are included here, with the copyright line of the respective project shown in the table above.

```
MIT License

Copyright (c) 2026 Santiago Fernández de Valderrama (career-ops)
Copyright (c) 2026 Mads Lorentzen (ai-job-search)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The exact files are `upstream/career-ops/LICENSE` and `upstream/ai-job-search/LICENSE`.

## Fonts (bundled in `apps/web/src/fonts`)

All 20 families are licensed under the SIL Open Font License 1.1. Each folder keeps its own `OFL.txt`, which is the licence text and must stay next to the font files. A "Reserved Font Name" means a modified font must not use that name.

| Folder | Copyright | Reserved name |
|---|---|---|
| `eb-garamond` | 2017 The EB Garamond Project Authors | |
| `fraunces` | 2018 The Fraunces Project Authors | |
| `geist` | 2024 The Geist Project Authors | |
| `ibm-plex-mono`, `ibm-plex-sans`, `ibm-plex-sans-arabic`, `ibm-plex-sans-devanagari`, `ibm-plex-sans-jp`, `ibm-plex-sans-kr` | (c) 2017 IBM Corp. | "Plex" |
| `inter` | 2020 The Inter Project Authors | |
| `jetbrains-mono` | 2020 The JetBrains Mono Project Authors | |
| `libre-caslon-text` | 2018 The Libre Caslon Text Project Authors | |
| `lora` | 2011 The Lora Project Authors | "Lora" |
| `manrope` | 2018 The Manrope Project Authors | |
| `newsreader` | 2020 The Newsreader Project Authors | |
| `noto-sans-sc` | 2014-2021 Adobe | "Source" (as stated in its `OFL.txt`) |
| `playfair-display` | 2017 The Playfair Display Project Authors | "Playfair Display" |
| `source-serif-4` | 2014 The Source Serif 4 Project Authors | |
| `space-grotesk` | 2020 The Space Grotesk Project Authors | |
| `work-sans` | 2019 The Work Sans Project Authors | |

Do not copy the Lato and Raleway fonts from ai-job-search: they ship there without licence texts.

## npm dependencies

The web app depends on npm packages under their own licences (mostly MIT, ISC, Apache-2.0 and BSD). A generated, complete list with licence texts is **not yet produced**; it is tracked as audit item C-03 in `docs/security/SECURITY_PLAN.md`, together with shipping those texts inside the Docker image. Known notes from the audits: `@paper-design/shaders-react` is Apache-2.0 (in the career-ops web lockfile, which we do not ship); the career-ops web lockfile also shows LGPL-3.0-or-later and MPL-2.0 transitive packages, so check ours when the list is generated.

## Rules for ported code

- Keep the origin path and the MIT copyright line at the top of every file ported from career-ops or ai-job-search.
- Do not use the name "career-ops" in any product name, domain or logo (`upstream/career-ops/TRADEMARK.md`).
- Do not copy `SIGNATURES.md`, `HIRED.md`, `CONTRIBUTORS.md` or `MAINTAINERS.md` from career-ops (personal data; they are removed from `upstream/`).
- Keep each font's `OFL.txt` next to its files.
- Resume template lineage lines (for example "Based on: Gabriel Sison / sb2nov resume template, MIT") stay in the template headers.

## Open items

See `research/LICENSE_AND_ATTRIBUTION_AUDIT.md` and `docs/security/AUDIT_C_SUPPLY.md`: the dossier copyright holder is unconfirmed, the licences of the two credited forks are not in the repository, and the dependency licence list is not generated yet. Get legal review before any public hosted launch. This file is engineering notes, not legal advice.
