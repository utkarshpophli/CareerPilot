# Sprint 2 security plan

Written 2026-11-01 from three independent read-only audits (`AUDIT_A_AUTH.md`, `AUDIT_B_INPUT.md`, `AUDIT_C_SUPPLY.md`): 77 findings, none critical, 5 high. The audits are working papers; this file is the worklist and the record of what we decided.

Model: local-only, open source, people self-host. We run nothing for anyone, but a self-hoster may expose the app through a reverse proxy, so every default must be safe when reachable from the internet.

## Decisions (owner, 2026-11-01)

| Question | Decision | Closes |
|---|---|---|
| What may agents do to application status? | Agents propose, the owner confirms. Free for agents: DRAFT, REJECTED, DECLINED. Statuses that claim progress (SENT, SCREENING, INTERVIEW, OFFER, ACCEPTED) are refused for tokens and the connector until the proposal queue ships (Sprint 3), then become a one-click confirmation. | A-05, A-09, B-01 (part) |
| Usage ping and update check | Delete the ping. Update check stays, off until the owner turns it on. | C-05, C-15 |
| Environment variable names | Rename to `CAREERPILOT_*`; read the old `DOSSIER_*` names as a fallback with a one-line warning. Image and repository references point at this project. | C-01, C-25 |
| Copyright holder | Utkarsh Pophli, for CareerPilot's changes, alongside the upstream notices that stay. | C-04 |

Defaults I took without asking (change them if wrong): drop the unofficial Bundesagentur access and the TypeSafe Jev scoring from the default setup (the first is against that agency's terms, the second sends data to a third-party processor); keep FreeHire; remove personal data from `upstream/`; AI-authored commits stay as they are, with the owner as committer.

## Groups, in order

Status: DONE, NEXT, LATER (with the sprint it moves to).

### 1. Quick wins (small, no design choices)

| Item | Finding | Status |
|---|---|---|
| Open redirect after login | B-09 | DONE |
| Quadratic regex in mail HTML to text (any sender could freeze the server) | B-03 | DONE |
| Quadratic regex in startups HTML to text | B-05 | DONE |
| Terminal escape codes in text from the server (CLI) | A-22 | DONE |
| Dev compose binds Postgres and the app to loopback; a test fails if any compose file publishes a non-loopback port | A-01 | DONE (kept the dev-only default DB password, now unreachable from the network) |
| Data import never changes this install's AI target, mail scope, agent settings, update check or consents | B-10, B-15 | DONE |
| Prompt delimiters cannot be closed from inside untrusted text; mail headers on one line | B-07 | DONE |
| Secure session cookie whenever the public address is https | A-13 (part) | DONE; the `__Host-` cookie prefix is not done |
| `DOSSIER_PUBLIC_URL` required before the connector or Google connect can be turned on | A-12, B-19 | LATER, Sprint 3 (with the OAuth rework, which touches the same code) |
| Strip control characters from server text in the CLI | A-22 | DONE |
| `CAREERPILOT_SECRET` must look random (at least 12 different characters, not a repeated word); backup files are mode 0600 in a 0700 folder (checked in Linux CI; modes do not apply on Windows) | A-19, A-18 | DONE |

### 2. The agent doorway

| Item | Finding | Status |
|---|---|---|
| Refuse progress statuses for tokens and the connector (interim of the decision above); refuse moves on applications awaiting review or archived; the connector no longer approves agent drafts | A-05, A-09 | DONE |
| REST: 120 requests a minute per token (burst 100), a shared small allowance for bad tokens, 500 steps per run, 50 runs going at once, step data at most 4,000 characters and 4 levels deep, request bodies refused by announced length and while streaming | A-06, A-14, B-20 | DONE for `/api/v1`. The connector (`/api/mcp`) now has a per-client limit (burst 60, then 1 a second), a tighter one for tools that spend job-source quota or AI money (`search_jobs`, `more_jobs`, `draft_application`: burst 10, then one every 6 seconds, counted per tool in a batch) and a 1 MB body cap |
| Posting guard on every connector posting path (`get_posting`, `save_application`, paste hand-off), labelled as untrusted with a warning when instructions are found | A-10, B-01 | DONE; search snippets and stored Find jobs text are still unguarded (B-08, LATER) |
| Login throttle: the global limit slows sign-in (3 s per check) instead of refusing the right password, so a stranger cannot lock the owner out; password checks run one at a time with the block re-tested inside the queue, so a parallel burst cannot all pass it; passwords over 256 characters are refused without hashing | A-02, A-03 | DONE; configurable trusted-proxy hop count for the client IP not done (NEXT) |
| Session epoch: "Sign out everywhere" in Settings → Security makes every cookie stale at once; kept by Delete everything, never exported or imported | A-04 | DONE |
| Password required to create an API token, through the same throttled check as signing in (one shared function) | A-20 | DONE |
| Best-effort redaction of credentials (API tokens, provider keys, bearer tokens, JWTs, private keys, `name=value` secrets) in run titles, steps and every ledger summary and data field | (plan) | DONE |
| Proposal queue for progress statuses (one-click confirm) | A-05 | LATER, Sprint 3 |
| OAuth grants stored in the database: single-use codes, rotating refresh tokens, per-client revoke | A-07 | LATER, Sprint 3 |
| Pairing window for connector client registration; consent name from the redirect host | A-08, A-19 | LATER, Sprint 3 |

### 3. Fork hygiene and compliance

| Item | Finding | Status |
|---|---|---|
| Replace `ghcr.io/aientech/dossier` and `AienTech/dossier` everywhere: no default image in `compose.production.yml` (you build your own until one is published), docs and messages point at this project, upstream site, issue templates and wiki links removed | C-01, C-16 | DONE |
| Rename `DOSSIER_*` to `CAREERPILOT_*`; the old names are copied over at startup with a one-line reminder, and the new name wins | C-25 | DONE |
| Delete the usage ping; update check off until turned on, queries only this project's releases | C-05, C-15 | DONE |
| Visible licence notice and Source code link on the sign-in page and in Settings > About, tied to the commit the image was built from (`--build-arg GIT_SHA`); the repository must be public before a shared deployment | C-02 | DONE |
| `THIRD_PARTY_NOTICES.md` complete (fonts with OFL texts, MIT-ported code, dependencies); licence texts shipped in the image | C-03, C-20 | NEXT |
| Copyright and modification notice; rewrite SECURITY.md, PRIVACY.md, README for CareerPilot | C-04, C-06 | NEXT |
| Remove personal data and agent config from `upstream/`; fix `.gitignore`; untrack generated graphs | C-13, C-23, C-12, C-14 | DONE |

### 4. Supply chain and CI

| Item | Finding | Status |
|---|---|---|
| Bump or dedupe vulnerable transitives, re-run audit | C-07 | NEXT |
| Root CI: Windows job, `yarn npm audit` (production tree must have no high advisory), production Docker build, CLI tests | C-08 | DONE except e2e and a licence check (NEXT) |
| Dependabot (npm, actions, docker), CODEOWNERS, root SECURITY.md | C-09 | DONE (branch protection and secret scanning are GitHub settings the owner must switch on) |
| Dockerfile `/tools` install from the lockfile; Yarn install-script allow-list and release-age gate | C-10, C-18 | NEXT |

### 5. Untrusted-text deep work (moves to later sprints, designed together)

| Item | Finding | Status |
|---|---|---|
| Fetched pages: run the HTML guard on raw HTML before flattening to text | B-02 | LATER, Sprint 3 (with the shared fetch and dedup work) |
| Guard regexes with quadratic cost (parity test against the Python original must stay green) | B-04 | LATER, Sprint 3 |
| Show guard findings to the user in the New application flow; stop trusting flagged postings and emails as fact sources | B-06, B-12 | LATER, Sprint 3 |
| Guard once at ingestion (Find jobs, agent scoring, mail) instead of per reader | B-08, B-11 | LATER, Sprint 3 |
| Resume zip and PDF budgets, socket destroy on timeout, wider IP block list, scheme-check imported links | B-14 to B-18 | LATER, Sprint 3 |

## Done when (Sprint 2)

Groups 1 to 4 are finished or explicitly accepted in an ADR, the audit command shows no advisory reachable at runtime, CI runs the checks above, and each fixed finding has a test that fails without the fix.
