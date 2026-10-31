# Third-party notices

CareerPilot is licensed under the GNU Affero General Public License v3.0 only (see `LICENSE`).

It is built from, and includes code from, the projects below. Their licence texts are kept in their own folders.

| Project | Where | Licence | Copyright |
|---|---|---|---|
| dossier | `apps/web` (modified; this is the base of the application) | AGPL-3.0-only (`apps/web/LICENSE`) | No holder is named in the upstream repository. Upstream authors in git history: "Alien" (AienTech) and Ali Hassan. Code adapted from forks by avinashbatchala and Anirudh Sharma is credited in the comments of `src/lib/agent/*`, `src/lib/ai/tasks/score-posting.ts` and `src/lib/connector/*`. |
| career-ops | `upstream/career-ops` (reference copy; code is ported into packages as needed, each ported file keeps its origin and copyright line) | MIT (`upstream/career-ops/LICENSE`) | Copyright (c) 2026 Santiago Fernandez de Valderrama |
| ai-job-search | `upstream/ai-job-search` (reference copy; same porting rule) | MIT (`upstream/ai-job-search/LICENSE`) | Copyright (c) 2026 Mads Lorentzen |

## Rules for ported code

- Keep the origin path and the MIT copyright line at the top of every file ported from career-ops or ai-job-search.
- Do not use the name "career-ops" in any product name, domain or logo (`upstream/career-ops/TRADEMARK.md`).
- Do not copy `SIGNATURES.md`, `HIRED.md`, `CONTRIBUTORS.md` or `MAINTAINERS.md` from career-ops (personal data).
- Fonts: keep each `OFL.txt` next to its font files. Do not copy the Lato and Raleway fonts from ai-job-search; they ship without licence texts.
- Resume template lineage lines (for example "Based on: Gabriel Sison / sb2nov resume template, MIT") stay in the template headers.

## Known open items

See `research/LICENSE_AND_ATTRIBUTION_AUDIT.md` section 9: the dossier copyright holder is unconfirmed, the licence of the two credited forks is not in the repository, and dependency licences have not been scanned yet. Get legal review before any public hosted launch.
