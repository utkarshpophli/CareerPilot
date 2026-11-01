# Audit C: supply chain, CI, fork hygiene and licence compliance

Date: 2026-11-01. Scope: `C:\Projects\project_rho` at git HEAD `c62823b` plus the working tree. Read-only audit; no project code was run and no `yarn install` was done.
Basis labels: FACT = seen in a file or command output. ASSUMPTION = inferred, say how to confirm.

## 0. Method and limits

- Read: `apps/web/package.json`, `yarn.lock`, `.yarnrc.yml`, `Dockerfile`, `compose*.yml`, `docker/*`, `.dockerignore`, `.gitignore` (root and web), `.github/workflows/ci.yml` (root), `apps/web/.github/**`, `apps/cli/*`, `.claude/`, `.claude-flow/`, `.continuum/`, `research/`, `upstream/` (selectively), `src/` (grep for upstream references).
- Ran: `corepack yarn npm audit --all --recursive` (worked; sends package names to the npm registry only), once as plain text, once `--json`, once with `--environment production`. Also read-only `git grep` over HEAD and all 16 revisions for key-like strings, `git ls-files`, and a Node one-liner that read `license` and install-script fields from the installed `apps/web/node_modules/*/package.json`.
- Not verified offline: real licence text of each dependency (only the `license` field was read, from the Windows install, so about 670 of the 880 lockfile entries; Linux-only optional packages are absent); whether the GitHub repo is public; GitHub branch protection or rulesets; whether `.next/standalone` contains package LICENSE files (needs a build); what the credited forks actually published.

## 1. Summary

29 findings: 1 HIGH, 12 MEDIUM, 10 LOW, 6 INFO. No CRITICAL. No committed secret found in the tree or in history.

The two things that matter most: the production compose file and the docs still tell people to pull and run the upstream author's image (`ghcr.io/aientech/dossier:latest`), and the AGPL source offer in the UI is only a "Star on GitHub" link.

## 2. What is already good

- No secrets in tracked files or any of the 16 revisions (regexes for Anthropic, OpenAI, AWS, GitHub, Slack, Google keys, PEM blocks and JWTs: zero hits). Only clearly marked e2e fixtures (`apps/web/e2e/support.ts:15`, `fake-google.mts:13`, `api.spec.ts:11`) and `.env.example` with empty values. No `.env`, `.pem`, `.key`, `.db` ever tracked or deleted from history (only the two `.env.example` files).
- Root `.gitignore` ignores `.env` and `.env.*` except `.env.example`; web `.gitignore` also covers `.env*`, `*.pem`, `/data/`, `/src/generated/prisma`, `/e2e/.auth/`, coverage and `.next`. `git check-ignore` confirms `.next`, `node_modules`, `tsconfig.tsbuildinfo` are ignored.
- Root CI (`.github/workflows/ci.yml`): `permissions: contents: read` (line 8-9), uses `pull_request` and `push` to main only (no `pull_request_target`), no secrets referenced, no `actions/cache` so no cache-poisoning surface, `yarn install --immutable`, concurrency group, runs lint, typecheck, coverage-gated tests with a Postgres service, and the CLI tests.
- Lockfile: no git, URL or tarball dependencies (no `resolution:` other than `npm:`/`workspace:`/`patch:`); `yarn.lock` committed; `packageManager` pinned with a sha512 hash; `next`, `react`, `react-dom`, `esbuild`, `@playwright/test` pinned exactly.
- `apps/cli` has zero dependencies, FACT: `apps/cli/package.json` has no `dependencies` or `devDependencies`; `lib.mjs`/`pilot.mjs` import only `node:fs` and `node:path`; global `fetch` only; `CAREERPILOT_URL` must be https except for localhost (`lib.mjs:188`).
- Docker production image: multi-stage; runs as `USER node` (Dockerfile:84); only `.next/standalone`, `.next/static`, `public`, `/tools` are copied in (lines 65-83), so source, tests, `.env`, docs and dev files are not shipped; `HEALTHCHECK` on `/api/health` (86); builds without secrets; `.dockerignore` excludes `.env*`, `.git`, `.github`, `node_modules`, `docs`, `site`, `data`, `e2e/.auth`; compose publishes the app on `127.0.0.1` only and requires `POSTGRES_PASSWORD`, `DOSSIER_PASSWORD`, `DOSSIER_SECRET` (`:?` guards); `NEXT_TELEMETRY_DISABLED=1`; `poweredByHeader: false`.
- `upstream/` is outside the Docker build context (context is `apps/web`), the root has no `package.json` or workspace config that links it, and `apps/web` and `apps/cli` are `private: true`: nothing in `upstream/` is built into or published with any artifact. FACT.
- Usage ping to a third party is genuinely off: `sendsFromHere()` needs `NODE_ENV=production` and a non-empty `CAREERPILOT_USAGE_PING_HOST` (`src/lib/usage-ping.ts:62`, host default empty at :24), and the compose file does not pass that variable through. No upstream telemetry host exists in `src/`.
- The only hard-coded outbound project endpoint in `src/` is `api.github.com/repos/utkarshpophli/CareerPilot/releases/latest` (`src/lib/releases.ts:4`, `src/lib/update-check.ts:46`), and release URLs are validated to stay on that repo (`isReleasePage`).
- MIT attribution for the one ported file is correct: `src/lib/guards/posting-guard.ts:1-2` keeps origin path and "Copyright (c) 2026 Mads Lorentzen. MIT License". Both upstream MIT `LICENSE` files are present. Root `LICENSE` and `apps/web/LICENSE` are byte-identical (`cmp`), 661 lines, verbatim FSF AGPLv3.
- Every one of 20 bundled font folders under `apps/web/src/fonts` has its own `OFL.txt` with the copyright line; `src/fonts/README.md` documents provenance, the WOFF2 conversion and the Noto Sans SC subset.
- Dependency licences: no UNLICENSED, SSPL, BUSL, commercial or missing licence field in the installed tree (section 7).
- `.claude/settings.local.json` is narrow (one Chrome tab-context tool and `localhost:3199`); `.claude/proven-config.json` and `.claude-flow/*` hold only numeric policy parameters and a hash-chained receipt ledger. No credentials or personal data in any of them.

## 3. Findings

### Fork hygiene and licence (the high-impact group)

#### C-01 HIGH: production compose, README and messages send users to the upstream author's image
- Location: `apps/web/compose.production.yml:1-4,29` (`image: ${DOSSIER_IMAGE:-ghcr.io/aientech/dossier:latest}`); `apps/web/README.md:81,91,15`; `apps/web/Dockerfile:77` (comment); `apps/web/.env.example:8`; `apps/web/scripts/hash-password.ts:3`; `apps/web/src/lib/env.ts:11` (error text shown at startup); `apps/web/docker/start.sh:9`; `apps/web/site/index.html:437,447`.
- Wrong: following the documented install pulls a mutable third-party `:latest` image built from upstream Dossier, not CareerPilot. `curl .../AienTech/dossier/main/compose.production.yml` does the same. `docker run ... ghcr.io/aientech/dossier hash-password` makes the user type their sign-in password into a third party's container; `env.ts:11` prints that command to anyone who forgets to set `DOSSIER_PASSWORD`.
- Impact: users run code that is not this repo (supply-chain trust in AienTech's registry and any future push to `latest`), CareerPilot features are absent, and the AGPL source offered in the UI would not match what runs. FACT.
- Fix: change the default image to CareerPilot's own GHCR name (or require `DOSSIER_IMAGE`/`CAREERPILOT_IMAGE` with no default until an image is published), digest-pin releases, and replace every `ghcr.io/aientech/dossier` and `AienTech/dossier` string in the files above. Until an image exists, make `hash-password` documentation use `yarn hash-password` or `docker compose run --rm app hash-password`.

#### C-02 MEDIUM: AGPL section 13 source offer is weak and unverifiable
- Location: `apps/web/src/app/(app)/repository-link.tsx:10` (label "Star on GitHub"), `src/lib/releases.ts:4-6` (target `https://github.com/utkarshpophli/CareerPilot`), rendered only in the signed-in sidebar (`sidebar.tsx:80`).
- Wrong: the link is framed as a star prompt, not an offer of Corresponding Source. `git grep` finds no "AGPL", "source code" or licence text anywhere in the UI (Settings → About included), and nothing on the login page. The link is not version-specific, so a modified deployment cannot point users to the exact source they are running. I cannot tell whether the repo is public.
- Impact: section 13 requires a prominent offer to all users interacting remotely, for the modified version. Not binding while it is single-user self-hosting by the author; becomes a real compliance gap for any hosted or shared deployment. FACT for the UI text; ASSUMPTION that the repo is or will be public.
- Fix: add "Source code (AGPL-3.0-only)" to the sidebar footer, Settings → About and the login page; inject the build commit SHA and tag (Docker build arg → env, shown beside the link) and link to `/tree/<sha>`; include the licence link; make sure the repository is public before any non-private deployment. Effort S.

#### C-03 MEDIUM: THIRD_PARTY_NOTICES is incomplete and the image carries no notices
- Location: `THIRD_PARTY_NOTICES.md` (whole file); `apps/web/Dockerfile:65-83`.
- Wrong: (1) it lists the three code sources but not the 20 font families or their copyright holders (the OFL texts sit in `src/fonts/*/OFL.txt` but that folder is not copied into the production image; Next emits only `.woff2` into `.next/static/media`); (2) it says nothing about npm dependencies (MIT, ISC, BSD, Apache-2.0, MPL-2.0, LGPL-3.0 libvips, CC-BY-4.0 caniuse-lite data) all of which are conveyed in the image; (3) the MIT permission text for the ported posting guard exists only as a path reference (`upstream/ai-job-search/LICENSE`) that is not in the image; (4) Chromium and Debian packages are bundled by `playwright install --with-deps` with no note. The standalone output tends to omit dependency LICENSE files (ASSUMPTION: confirm with `find .next/standalone -iname 'LICENSE*' | wc -l` after a build).
- Impact: MIT/BSD/Apache/OFL require the notice to accompany copies; distributing the container without it is a compliance defect (low enforcement risk, easy to fix).
- Fix: generate `THIRD_PARTY_LICENSES.txt` at build time (for example a small script over `node_modules/*/package.json` plus the LICENSE files, or a Yarn licenses plugin) and `COPY` it plus the root `LICENSE`, `THIRD_PARTY_NOTICES.md`, the two MIT texts and the font OFL files into `/app` in the production stage; add a font table to `THIRD_PARTY_NOTICES.md`. Effort M.

#### C-04 MEDIUM: no CareerPilot copyright statement, no dated modification notice, upstream holder unnamed
- Location: `THIRD_PARTY_NOTICES.md:9,24`; `LICENSE` (FSF text only); no per-file headers in `src/` except `guards/posting-guard.ts`; `git log` authors are mostly "Claude <noreply@anthropic.com>".
- Wrong: no statement says who holds copyright in CareerPilot's changes; AGPL section 5(a) asks for prominent notice that the work was modified with a date; the dossier holder is unnamed in upstream (research audit section 9 says the same); git history shows most new code authored by an AI account, which complicates a copyright claim. `package.json` says `AGPL-3.0-only`; upstream already said that (research/PROJECT_DOSSIER.md:80), so this is inherited, FACT.
- Impact: unclear licensor for any future relicensing, dual-licensing or enforcement; legal review item already noted by the owner.
- Fix: add a root `NOTICE`/`COPYING` line "Copyright (C) 2026 <you> and contributors. Based on dossier (AGPL-3.0, holder not stated upstream), modified from <date>", keep it in the About page, and decide the policy on AI-authored commits. Effort S, plus legal review.

#### C-05 MEDIUM: usage-ping UI names the upstream maintainer's mailbox and a server CareerPilot does not have
- Location: `src/app/(app)/settings/about-section.tsx:150-158`, `src/app/(app)/usage-ping-dialog.tsx:51-67` (both `mailto:dossier.app@pm.me`, "on the project's own server in Germany", "deleted after a year", "The receiver doesn't keep the address").
- Class: (a)/(b). Only shown when an operator sets `CAREERPILOT_USAGE_PING_HOST`, then users are told to email install IDs to the upstream author and are given retention and location promises CareerPilot cannot make. The data flow itself (ping) goes to the operator's own host; the email is voluntary.
- Fix: make the text generic ("your server's operator", host shown from the variable), remove the mailbox and the Germany/retention claims, or delete the ping feature outright (YAGNI: nobody runs a receiver). Bump `USAGE_PING_TEXT_VERSION` if the text changes. Effort S.

#### C-06 MEDIUM: privacy and security documents describe Dossier, not CareerPilot
- Location: `apps/web/PRIVACY.md:51,81` (lists `telemetry.dossier.aien.me` as a recipient, Dossier project promises); `apps/web/SECURITY.md:3-48` ("Dossier does...", "Dependabot proposes updates once a week" while no dependabot config exists anywhere in the repo, an advisory table dated 28 Sep 2026 that no longer matches the audit); `apps/web/README.md` (title "Dossier", badges and wiki links to AienTech); `CONTRIBUTING.md:11`, `DEVELOPMENT.md:219-223`, `UPGRADE_GUIDE_URL` → `.../utkarshpophli/CareerPilot/wiki/Upgrading` (no wiki known to exist, ASSUMPTION).
- Class: (b) misleading branding, and inaccurate security/privacy claims (the Dependabot sentence is false, FACT: `find` shows no `dependabot.yml` outside `upstream/career-ops/.github`).
- Impact: wrong data-flow disclosure (PRIVACY.md also says the update check is on by default, true, but names the wrong project), false assurance in SECURITY.md, vulnerability reports directed at upstream.
- Fix: rewrite PRIVACY.md and SECURITY.md for CareerPilot; add a root `SECURITY.md` with a private reporting channel; delete or rewrite the README. Effort M.

### Dependencies

#### C-07 MEDIUM: 15 open advisories; none reachable at runtime, but nothing tracks them
Command: `corepack yarn npm audit --all --recursive` (worked). 5 high, 8 moderate, 2 low, including one deprecation notice.

| Package (installed) | Advisory | Sev | Pulled in by | Reachable here? |
|---|---|---|---|---|
| source-map-js 1.2.1 | GHSA-68fv-2mgg-jv7q event-loop DoS via indexed source-map offsets | high | `postcss@8.5.23` (exact pin by `next@16.4.3`), `@tailwindcss/node` | Build time only (CSS compile). The lockfile already has 1.2.2 for other ranges. Also listed by `--environment production`, because next's postcss is a production dependency, but no attacker-controlled source map reaches it. |
| undici 8.11.2 | 8 advisories: 4 high (GHSA-xjj6-f33q-929c, 4w7w-5xrc-9h26, 2m5v-pch6-74hx, qrxm-fqhp-jwvm), 4 moderate | high/mod | `node-gyp@13.0.2` ← `fsevents` (darwin only) | No. macOS dev only; not in Linux image or Windows. Same package is already at 8.12.3 elsewhere in the lock (`undici@npm:^8.12.1`), so a dedupe fixes it. |
| fast-uri 3.1.8 | 4 advisories (GHSA-w74x-v6f9-j3xg, xhq7-xmqj-769h, wjr9-j795-jxcr, 333x-w4r6-6crp) | 2 mod, 2 low | `ajv@8.20.0` ← `@prisma/streams-local` (prisma CLI) and eslint | Only inside Prisma CLI (migrations at container start) and lint. No user URL reaches it. Appears in `--environment production` output. |
| minimatch 3.1.5 / 10.2.6 | GHSA-g3hv-75wg-m249 globparts DoS | mod | eslint, `@typescript-eslint/typescript-estree` | Dev only. |
| eslint 9.39.5 | deprecation: version no longer supported | mod | direct devDependency (`package.json:59`) | Dev only. |

- Direct runtime dependencies (next, react, prisma client/adapter-pg, jose, zod, mammoth, unpdf, fflate, node-html-parser, openai, @anthropic-ai/sdk, ollama, @modelcontextprotocol/server, playwright-core, radix-ui, lucide-react, @dnd-kit/*): zero advisories reported.
- Maintained/abandoned check: all direct dependencies resolved to publishers' repos (checked `repository` fields for MCP server, mammoth, unpdf, ollama, anthropic SDK, fflate, jose, lucide, node-html-parser). `@modelcontextprotocol/server@2.4.0` is the official `modelcontextprotocol/typescript-sdk` split, Apache-2.0. None deprecated (audit shows only eslint).
- Fix: `yarn up -R source-map-js fast-uri undici minimatch` (or `resolutions` entries) and re-run the audit; rely on `next` bumping postcss for the exact pin. Then refresh `SECURITY.md` and wire audit into CI (C-08). Effort S. FACT.

#### C-10 MEDIUM: production image resolves Prisma CLI dependencies outside the lockfile
- Location: `apps/web/Dockerfile:44-54` (`cd /tools && npm install --omit=dev --no-audit --no-fund`, with only `prisma` and `dotenv` pinned and the `mysql2` override).
- Wrong: transitive dependencies of the Prisma CLI are fetched from the registry at build time with `npm` semver resolution and no lockfile or integrity pins, bypassing `yarn.lock`. The result is runtime code in the final image (`/app/tools/node_modules`) that runs `migrate deploy` with database credentials on every start. It also brings in the packages behind advisories in C-07 at whatever version npm picks that day, and EPL/LGPL packages (C-20).
- Impact: build reproducibility and supply-chain exposure at the most privileged step of the image. FACT.
- Fix: install the CLI with the lockfile (for example `yarn workspaces focus`/`yarn install --immutable` in a tools stage that copies `yarn.lock`, or generate a `package-lock.json` once and use `npm ci`), and copy only the resulting tree. Effort M.

#### C-18 LOW: install scripts and no script policy
- FACT, from installed manifests: `prisma@7.10.1` (`preinstall`), `@prisma/engines@7.10.1` (`postinstall`, downloads engine binaries), `esbuild@0.28.2` (`postinstall: node install.js`), `unrs-resolver@1.12.2` (`postinstall`, dev, via eslint import resolver). All from expected publishers. `.yarnrc.yml` only sets `nodeLinker: node-modules`, so Yarn 4 runs every dependency's scripts, including future new transitive ones.
- Fix: add `enableScripts: false` plus `dependenciesMeta.<pkg>.built: true` for the four above, and consider `npmMinimalAgeGate` (a few days) so brand-new malicious versions are not picked up by `yarn up`. Effort S.

#### C-19 LOW: loose ranges and stale pins
- `apps/web/package.json`: every non-exact dependency is a caret range, including whole-major ranges `typescript ^5`, `tailwindcss ^4`, `@tailwindcss/postcss ^4`, `@types/node ^24`, `eslint ^9`. The lockfile plus `--immutable` (CI and Docker) contains the practical risk, so only `yarn up` can move them.
- `resolutions` (`package.json:71-73`) pins `mysql2@npm:3.15.3`; the lock has no `3.15.3`, only `mysql2@npm:3.24.4` (`yarn.lock:7265`), so the pin does nothing now (stale). `node-gyp@npm:latest` comes from Yarn's built-in `fsevents` patch entry (`yarn.lock:5905,5915`); harmless offline but it is why undici 8.11.2 sits in the tree.
- Fix: delete the stale resolution; leave carets, rely on the age gate and Dependabot. Effort S.

### CI, automation, repo settings

#### C-08 MEDIUM: root CI is a reduced copy; the full workflows are inert; key checks are missing
- Location: `.github/workflows/ci.yml`; `apps/web/.github/workflows/{ci,pages,release}.yml`.
- FACT: GitHub only reads `<repo root>/.github/workflows`. The full upstream pipeline (e2e Playwright job, image build and GHCR push, release, Pages) lives in `apps/web/.github/` and never runs. The root CI runs lint, typecheck, coverage tests and `node --test` for the CLI on `ubuntu-latest` only.
- Missing: Playwright e2e (the repo ships ~30 specs), `next build`, a Docker build of the production target (so Dockerfile/`/tools` regressions go unseen), `yarn npm audit`, a licence check, secret scanning, any Windows job (maintainer develops on Windows; `pilot.mjs:192` has a Windows-specific libuv workaround that no job exercises), and a gate that the working tree is clean after `prisma generate`.
- Fix: add jobs `e2e` (as in the dead file), `docker` (build `--target production`, no push), `audit` (`yarn npm audit --all --recursive --environment production`, allow-list in a file), `licenses` (script over the lock/`node_modules`), and a `windows-latest` job running `node --test` for `apps/cli` and `yarn test`. Move or delete `apps/web/.github/workflows` and `.github/scripts` once ported. Effort M.

#### C-09 MEDIUM: no Dependabot, CODEOWNERS, security policy or PR template at the repo root
- FACT: root `.github/` holds only `workflows/ci.yml`. No `dependabot.yml` for `apps/web` (confirms earlier notes), `apps/cli`, GitHub Actions or Docker. `upstream/career-ops/.github/CODEOWNERS` and `dependabot.yml` exist but are nested copies GitHub ignores. No branch-protection information is visible in the repo; I cannot tell whether `main` requires CI, review or signed commits.
- Fix: add `.github/dependabot.yml` (npm in `/apps/web`, github-actions in `/`, docker in `/apps/web`; do not enable for `upstream/`), a root `SECURITY.md`, and `CODEOWNERS` (`* @utkarshpophli`). Enable branch protection (required status checks `check`, `cli`, no force-push, require PR) and secret scanning/push protection in repo settings. Effort S.

#### C-17 LOW: pinning
- Actions use mutable tags only (`actions/checkout@v7`, `actions/setup-node@v7`; `.github/workflows/ci.yml:35,37,67,69`), first-party owners only. Service image `postgres:18-alpine` and base `node:24-trixie-slim` (`Dockerfile:5`) are tag-pinned without digests; same for `ollama/ollama:0.40.10` (pinned by version but not digest).
- Fix: pin third-party-owned actions to full SHAs when added (docker/*), let Dependabot bump digests. Effort S.

#### C-12 MEDIUM: root `.gitignore` is thin; agent state is untracked but not ignored
- Location: `.gitignore` (6 lines: `node_modules/`, `.env`, `.env.*`, `.DS_Store`, `*.log`). `git status` shows `.continuum/` (`store.db`, `-wal`, `-shm`), `.claude/proven-config.json`, `.claude/.proven-config-version`, `apps/web/.claude-flow/` and `apps/web/AGENTS.md` as untracked and unignored; `.claude/settings.local.json` is also not ignored; `.claude-flow/policy/{state,ledger-anchors}.json` are tracked and rewritten every session (shown as modified).
- Wrong: one `git add -A` commits agent memory databases and per-machine permission grants. `.continuum/store.db` is an SQLite "nodes" memory store (project memory, free-text bodies); today it holds schema only as far as a strings scan shows (ASSUMPTION about the WAL contents), but it will hold whatever the assistant is told to remember. Also no ignore for `*.pem`, `*.key`, `data/`, `coverage/`, `.next/`, `*.tsbuildinfo` at the root (web `.gitignore` covers its own subtree only; `apps/cli` has none).
- Fix: append to the root `.gitignore`: `.continuum/`, `.claude/settings.local.json`, `.claude/proven-config*`, `.claude/.proven-config-version`, `.claude-flow/`, `**/.claude-flow/`, `graphify-out/`, `*.pem`, `*.key`, `*.p12`, `*.sqlite*`, `*.db*`, `data/`; then `git rm -r --cached .claude-flow`. Effort S.

### Containers and deployment

#### C-11 MEDIUM: dev compose publishes Postgres and the app on all interfaces with default credentials
- Location: `apps/web/compose.yml:5-10` (`POSTGRES_PASSWORD:-postgres`, `ports: "${POSTGRES_PORT:-5432}:5432"` → 0.0.0.0), `:30-31` (`3000:3000`), `:33` (`.:/app` mounts the project including `.env`).
- Impact: on a laptop on any shared network (Docker Desktop on Windows binds all interfaces by default) the database is reachable with `postgres/postgres`. The `studio` service is correctly bound to `127.0.0.1` (line 53), so the omission here is inconsistent. Dev only.
- Fix: `"127.0.0.1:${POSTGRES_PORT:-5432}:5432"` and `"127.0.0.1:3000:3000"`; require `POSTGRES_PASSWORD` in `.env` for dev too. Effort S.

#### C-22 LOW: production compose hardening and image build notes
- `compose.production.yml`: no `read_only: true` (writes needed: `/data`, `.next/cache`), no `cap_drop: [ALL]`, no `security_opt: no-new-privileges`, no `pids_limit`, no `init: true` (Chromium children), `restart` only. `extra_hosts: host.docker.internal` is intentional. `db` has no published port (good). Image default tag `:latest` (see C-01).
- Dockerfile: base `node:24-trixie-slim` floating (C-17); final image root-owned `/app/tools` (good, not writable by `node`); no `.env`, no dev files; `COPY . .` in the build stage sends everything not in `.dockerignore` to the build (e.g. `graphify-out`, `.claude-flow`, `e2e`, `AGENTS.md`, `.yarn`) but none of it reaches the final stage. Add those to `.dockerignore` for tidiness. `docker/bin/yarn` is a dev helper that runs `docker compose exec/run`; it forwards arguments verbatim and is not copied into any image.
- Fix: add the hardening keys and a compose `init: true`; expand `.dockerignore`. Effort S.

### Repo hygiene

#### C-13 MEDIUM: `upstream/` vendors other people's personal data, contradicting `THIRD_PARTY_NOTICES.md`
- Location: `upstream/career-ops/{SIGNATURES,HIRED,CONTRIBUTORS,MAINTAINERS}.md` (tracked). `THIRD_PARTY_NOTICES.md:19` says "Do not copy ... (personal data)", yet the vendored copy already contains them. `HIRED.md` lists third parties' GitHub handles with job titles and story links; `SIGNATURES.md` lists handles, display names and sentences. About 3,300 tracked files (58 MB) are vendored and include real maintainer emails (for example `hi@santifer.io` in policies).
- Impact: republishing people's names and employment stories in a repo that may become public; GDPR-style removal requests would land on this repo. Not shipped in any artifact (see section 2). FACT.
- Fix: `git rm` those four files and anything else not needed as reference (translated READMEs, `.github/`, `web/`, `batch/` scripts, `graphify-out`); better, keep only the paths the port needs, or replace `upstream/` with a pinned submodule/commit reference plus a `PORTED_FROM.md`. Effort S-M (history still contains them; rewriting history is optional).

#### C-23 LOW: risky and agent-steering content in `upstream/`
- `--dangerously-skip-permissions` appears in `upstream/career-ops/batch/batch-runner.sh:9,1509`, `batch-tailor.mjs:129`, `salary-gap.mjs:50`, `web/src/lib/clis.ts:46`; `upstream/career-ops/hooks/hooks.json` is a `SessionStart` hook that runs a Node script with a 300 s timeout when career-ops is installed as a plugin; `upstream/ai-job-search/.claude/settings.json` pre-allows `Bash(bun run ...)` and `Bash(python tools/...)` patterns; both projects ship `CLAUDE.md`/`AGENTS.md` that agents read when they work in those directories.
- Impact: inert until someone opens an agent session inside `upstream/<project>` or installs the plugin, but agents operating in this monorepo can pick up foreign instructions and allow-lists, and the vendored scripts are code nobody reviewed. The nested `.github/workflows` (30+ files under career-ops) are ignored by GitHub, but its dependency scanners will read their manifests (6 `package.json` under `ai-job-search/.agents/skills/*/cli`).
- Fix: strip `.claude/`, `.claude-plugin/`, `hooks/`, `.github/`, `CLAUDE.md`, `AGENTS.md`, `CODEX.md`, `GEMINI.md`, `KIMI.md`, `OPENCODE.md` and the batch scripts from `upstream/`, or move reference code to a non-agent folder name and add a root note "do not run". Effort S.

#### C-14 LOW: generated analysis artifacts committed
- 362 tracked `graphify-out` files (`research/*/graphify-out/**`, `apps/web/graphify-out/cache/stat-index.json`), about 47 MB under `research/`. They embed absolute local paths (`C:\Projects\project_rho\...`, FACT in `research/ai-job-search/.graphify_detect.json`) and derived content from three projects. Research markdown also contains the maintainers' emails (`hi@aien.me`, `alih.qureshi@hotmail.com`, `hi@santifer.io`), which are in the upstream histories but are not needed.
- Fix: untrack the caches (`git rm -r --cached`, ignore `graphify-out/`), redact the emails in `research/LICENSE_AND_ATTRIBUTION_AUDIT.md`. Effort S.

#### C-16 LOW: dead upstream metadata in `apps/web/.github` and `site/`
- `apps/web/.github/FUNDING.yml:1` (`github: AienTech`), `ISSUE_TEMPLATE/config.yml:4-10` (wiki, troubleshooting and private security advisory links to `AienTech/dossier`), `ISSUE_TEMPLATE/*.yml`, `release.yml:60` (GitHub release titled "Dossier"), `site/index.html` (canonical `https://dossier.aien.me/`, many AienTech links), `site/main.js:140` (`https://api.github.com/repos/AienTech/dossier`: a visitor's browser would call GitHub for upstream's release data), `.github/images/*.png` (Dossier screenshots).
- Inert today because GitHub ignores nested `.github`. If moved up unchanged they would route security reports and sponsorship to upstream. Class (b), and (a) for `site/main.js` if ever published.
- Fix: delete `site/`, `FUNDING.yml`, the images and issue templates, or rewrite and move the templates to the root `.github/`. Effort S.

#### C-15 LOW: update check on by default, inherited version number, dead wiki
- `src/lib/settings.ts:186` `updateCheck: flag(true)`: once per day of use the server calls `api.github.com/repos/utkarshpophli/CareerPilot/releases/latest` (class (a): GitHub sees the server IP and `User-Agent: CareerPilot`, nothing else). It is disclosed in Settings → About. `docs/MASTER_PLAN.md:250` plans to make it opt-in; not done. `apps/web/package.json:3` still says `"version": "1.11.0"` (dossier's), displayed in the UI and used for comparison: a first CareerPilot release `v0.x` would never show as newer. `package.json` has no `repository`, `homepage` or `bugs` fields.
- Fix: default `updateCheck` to false (or ask once), set version `0.1.0` consistent with `apps/cli`, add `repository` to both manifests. Effort S.

### Licences of dependencies and credited code

#### C-20 LOW: dependency licence review (partial)
From the installed tree, `license` fields: MIT 544, Apache-2.0 47, ISC 34, BSD-2/3 26, MPL-2.0 4, MIT-0 2, CC0 2, Unlicense 3, 0BSD 1, BlueOak 1, others below. No UNLICENSED, SSPL, BUSL, "SEE LICENSE", commercial or missing field. Notables:
- `@img/sharp-win32-x64` `Apache-2.0 AND LGPL-3.0-or-later` (libvips; on Linux the equivalent `@img/sharp-libvips-linux*` is LGPL-3.0-or-later). Compatible with AGPL-3.0 (LGPLv3 permits combination with GPLv3 works); needs the LGPL text and a way to relink (native dynamic library, fine). Covered by C-03.
- `elkjs@0.11.1` EPL-2.0 (via `@prisma/studio-core`, prisma CLI only). EPL-2.0 is not GPL-compatible unless the author designates a secondary licence. It is not linked into CareerPilot code; it would only be redistributed as a separate package inside `/app/tools` in the image (mere aggregation, ASSUMPTION), or in dev. Remove it from the image by not installing `studio-core` (see C-10).
- `axe-core`, `@axe-core/playwright`, `lightningcss` (MPL-2.0): file-level copyleft, dev/build only, compatible with AGPLv3 (MPL section 3.3).
- `jszip` `(MIT OR GPL-3.0-or-later)` (via mammoth): elect MIT. `caniuse-lite` CC-BY-4.0 (data; attribution). `duck@0.1.12` just says "BSD" (unspecific; transitive of the Prisma studio chain); `@visx/vendor` is an alpha release in the same chain.
- Could not verify: licence text vs field, Linux-only optional packages, `@prisma/*` engine binaries, Playwright's downloaded Chromium (BSD and other licences), Debian packages in the image.
- Fix: add a CI licence check with an allow-list (MIT, ISC, BSD, Apache-2.0, MPL-2.0, LGPL-3.0, 0BSD, CC0, Unlicense, BlueOak, CC-BY-4.0, Python-2.0, Zlib), fail on anything else. Effort S-M.

#### C-21 LOW: licences of the two credited forks are unknown
- Location: `src/lib/agent/draft.ts:26`, `agent/run.ts:28`, `ai/tasks/score-posting.ts:10-11` ("Adapted from avinashbatchala's fork of Dossier"); `src/lib/connector/oauth.ts:13-14`, `connector/tools.ts:32-33` ("Anirudh Sharma's fork").
- State: FACT these comments came with dossier, so CareerPilot received the code through upstream's AGPL repository, not directly from the forks. ASSUMPTION: the forks were published as AGPL-3.0 derivatives of dossier (inherited `LICENSE`). Nothing in this repo records their licence or copyright (`THIRD_PARTY_NOTICES.md:9`, research audit section 9). Their handles and names are kept as required credit.
- Fix: check each fork's `LICENSE`/README on GitHub, record the result in `THIRD_PARTY_NOTICES.md`, keep the comments. Effort S.

#### Trademark "career-ops"
- OK as far as reviewed: no product name, domain or logo uses it; `THIRD_PARTY_NOTICES.md:21` states the rule; `upstream/career-ops/TRADEMARK.md` explicitly welcomes "based on career-ops" lineage statements. `src/` mentions only in comments. The root README table names the project descriptively (permitted). See C-27 for the stray folder.

### Informational

#### C-24 INFO: inherited third-party integrations with terms-of-service or data-sharing implications (all off until configured)
`.env.example:52-57` (Bundesagentur für Arbeit: "without its permission, terms don't allow automated access"), TypeSafe "Jev" scorer (posting plus profile sent to `api.typesafe.ai` when `DOSSIER_SCORER=jev`), FreeHire, JSearch/Adzuna keys. User-initiated and documented in PRIVACY.md; decide whether CareerPilot, as a product, should keep them. They are not data-leaks.

#### C-25 INFO: environment variable inventory and rename policy (class (c): harmless identifiers)
All read via `src/lib/env.ts` (zod). In use: `DOSSIER_PASSWORD`, `DOSSIER_SECRET`, `DOSSIER_DATA_DIR`, `DOSSIER_PUBLIC_URL`, `DOSSIER_PORT`, `DOSSIER_IMAGE`, `DOSSIER_BACKUP_RETENTION_DAYS`, `DOSSIER_TELEMETRY`, `DOSSIER_AI_PROVIDER`, `DOSSIER_AI_URL`, `DOSSIER_AI_MODEL`, `DOSSIER_AI_KEY`, `DOSSIER_AI_TIMEOUT_SECONDS`, `DOSSIER_JOBS_SOURCE`, `DOSSIER_JSEARCH_KEY`, `DOSSIER_JSEARCH_HOST`, `DOSSIER_ADZUNA_APP_ID`, `DOSSIER_ADZUNA_KEY`, `DOSSIER_FREEHIRE_URL`, `DOSSIER_JOBS_ARBEITSAGENTUR`, `DOSSIER_SCORER`, `DOSSIER_TYPESAFE_KEY`, `DOSSIER_GOOGLE_CLIENT_ID`, `DOSSIER_GOOGLE_CLIENT_SECRET`, plus test-only `DOSSIER_JOBS_TEST_BASE_URL`, `DOSSIER_GOOGLE_TEST_BASE_URL`, `DOSSIER_USAGE_PING_TEST_URL`, `DOSSIER_UPDATES_TEST_BASE_URL`, `DOSSIER_TYPESAFE_TEST_BASE_URL`. Already new: `CAREERPILOT_USAGE_PING_HOST`, `CAREERPILOT_URL`, `CAREERPILOT_TOKEN`.
- No data leaves because of the names; they only confuse. Judgement: since CareerPilot has no installed base, rename to `CAREERPILOT_*` in one pass; a dual-read alias (`CAREERPILOT_X ?? DOSSIER_X` with a one-line deprecation warning) is only needed if you want existing dossier deployments to migrate in place. Failure mode is safe: missing `DOSSIER_PASSWORD`/`SECRET` stops the server at start.
- Do NOT rename without a migration: the HKDF label `` `dossier ${purpose} v1` `` in `src/lib/keys.ts:27` (renaming makes stored encrypted API keys unreadable); the export format id `"dossier-export"` (`src/lib/data-export.ts:42`; keep accepting it on import); the audience strings `dossier-*` in `connector/oauth.ts:30` and `google/oauth.ts:96` and the cookies `dossier_session`, `dossier_theme`, `dossier_sidebar`, `dossier-tz` (renaming only logs people out and resets preferences, safe). The MCP server name `"dossier"` (`connector/tools.ts:130`) and scope `"dossier"` change what clients see and should be renamed together with docs.

#### C-26 INFO: test-only env overrides are honoured in production
`DOSSIER_*_TEST_BASE_URL`/`_TEST_URL` redirect Google OAuth, job-source, update-check, TypeSafe and ping traffic to any http(s) URL (`src/lib/env.ts:161-186`). Requires control of the server environment, so no escalation, but in a production build they could be ignored (`NODE_ENV !== "production"` guard) to remove a way to silently redirect credentials.

#### C-27 INFO: stray untracked `career-ops/` folder at the repo root
`C:\Projects\project_rho\career-ops\examples\dual-track-engineer-instructor\cv.md` (fictional "Sam Rivera" sample, `example.com` contacts). It is not in `upstream/` and not tracked. Delete or move it; do not commit it under a top-level name that looks like the project.

#### C-28 INFO: Noto Sans SC subset and Plex conversion
`src/fonts/README.md` states the subset and WOFF2 conversions. OFL allows modification provided the Reserved Font Name is not used for the modified version; Noto Sans SC's RFN is "Source", the family keeps the name "Noto Sans SC". Check the font's internal name table does not carry "Source" (ASSUMPTION; `fonttools` can print it). IBM Plex (RFN "Plex") is converted only, not modified.

#### C-29 INFO: remote leftovers and provenance
`origin/claude/pensive-thompson-c7m7fi` is a stale remote branch (an ancestor commit of `main`); delete it. Most commits are authored by "Claude <noreply@anthropic.com>" (see C-04). `apps/web/package.json` has no `description`/`repository`; `packages` field `"private": true` is correct and prevents accidental npm publish.

## 4. Top-10 fix list

| # | Fix | Finding | Effort |
|---|---|---|---|
| 1 | Replace every `ghcr.io/aientech/dossier`, `AienTech/dossier` default (compose, README, env.ts message, hash-password docs) with CareerPilot's own or none | C-01 | S |
| 2 | Add a visible "Source code (AGPL-3.0-only)" link tied to the build SHA in sidebar, About and login; make repo public before any shared deployment | C-02 | S |
| 3 | Build-time third-party licence file and OFL/MIT texts into the image; add fonts and dependencies to `THIRD_PARTY_NOTICES.md` | C-03, C-20 | M |
| 4 | Bump or dedupe vulnerable transitives (`source-map-js`, `fast-uri`, `undici`, `minimatch`), re-run audit, then update SECURITY.md | C-07 | S |
| 5 | Move/extend CI at the repo root: e2e, production Docker build, `yarn npm audit`, licence check, Windows job | C-08 | M |
| 6 | Add `.github/dependabot.yml` (npm, actions, docker; not `upstream/`), root SECURITY.md, CODEOWNERS; turn on branch protection and secret scanning | C-09, C-06 | S |
| 7 | Remove personal data and agent config from `upstream/` (`SIGNATURES/HIRED/CONTRIBUTORS/MAINTAINERS`, `.claude`, hooks, nested `.github`) | C-13, C-23 | S |
| 8 | Fix root `.gitignore` (`.continuum/`, `.claude` local files, `.claude-flow/`, `graphify-out/`, keys) and untrack generated caches | C-12, C-14 | S |
| 9 | Make `/tools` install use the lockfile; add `enableScripts` allow-list and an age gate to `.yarnrc.yml` | C-10, C-18 | M |
| 10 | Rewrite PRIVACY.md/SECURITY.md/README for CareerPilot, drop upstream mailbox and server claims, add a CareerPilot copyright and modification notice | C-04, C-05, C-06 | M |

## 5. Open questions for the owner

1. Is `github.com/utkarshpophli/CareerPilot` public, and will you publish a container image? Under which registry name? (decides C-01, C-02.)
2. Who is the copyright holder to name for CareerPilot's changes, and what is your policy for AI-authored commits (C-04)?
3. Do you want the usage ping at all? Nobody runs a receiver; deleting the feature is smaller than rewriting its text (C-05).
4. Rename `DOSSIER_*` env vars in one pass, or provide a dual-read alias for migrating dossier users (C-25)? Is there any existing dossier deployment you must keep working?
5. Which of the inherited integrations (Bundesagentur unofficial access, TypeSafe Jev, FreeHire) stay in the product (C-24)?
6. What are the current GitHub settings: branch protection, required checks, secret scanning, Dependabot alerts (C-09)? I could not see them from the repo.
7. Will `upstream/` stay in the repo? If it must, can it be cut to the files actually used for porting (C-13, C-23)?
8. Should the update check default to off (C-15), given the plan already says opt-in?
9. Legal review: do you want counsel on the AGPL-only claim for a fork whose upstream shows no copyright holder, and on the two credited forks (C-04, C-21)?
