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
| Dev compose binds Postgres and the app to loopback, no default DB password | A-01 | NEXT |
| Data import must not repoint AI provider, URL, key target, Gmail or agent settings | B-10, B-15 | NEXT |
| Prompt delimiters cannot be closed from inside untrusted text | B-07 | NEXT |
| `DOSSIER_PUBLIC_URL` required when connector or Google is on; Secure cookies on https | A-12, A-13, B-19 | NEXT |
| Entropy check on the secret; backup files mode 0600; strip control characters in the CLI | A-19, A-18, A-22 | NEXT |

### 2. The agent doorway

| Item | Finding | Status |
|---|---|---|
| Refuse progress statuses for tokens and the connector (interim of the decision above); refuse moves on applications awaiting review or archived | A-05, A-09 | NEXT |
| Rate limits and caps on `/api/v1` and the connector: requests per minute per token, steps per run, `data` size and depth, runs and applications per day, event paging | A-06, A-14, B-20 | NEXT |
| Run the posting guard on every connector posting path; label returned text as untrusted data | A-10, B-01, B-08 | NEXT |
| Login throttle: reserve before verify, slow down instead of refusing the right password, cap password length | A-02, A-03 | NEXT |
| Server-side session epoch ("sign out everywhere"); password required to create an API token | A-04, A-20 | NEXT |
| Redact secrets in run steps and ledger data | (plan) | NEXT |
| Proposal queue for progress statuses (one-click confirm) | A-05 | LATER, Sprint 3 |
| OAuth grants stored in the database: single-use codes, rotating refresh tokens, per-client revoke | A-07 | LATER, Sprint 3 |
| Pairing window for connector client registration; consent name from the redirect host | A-08, A-19 | LATER, Sprint 3 |

### 3. Fork hygiene and compliance

| Item | Finding | Status |
|---|---|---|
| Replace `ghcr.io/aientech/dossier` and `AienTech/dossier` everywhere | C-01 | NEXT |
| Rename `DOSSIER_*` to `CAREERPILOT_*` with fallback | C-25 | NEXT |
| Delete the usage ping; update check opt-in | C-05, C-15 | NEXT |
| Visible "Source code (AGPL-3.0-only)" link tied to the build, in sidebar, About and login | C-02 | NEXT |
| `THIRD_PARTY_NOTICES.md` complete (fonts with OFL texts, MIT-ported code, dependencies); licence texts shipped in the image | C-03, C-20 | NEXT |
| Copyright and modification notice; rewrite SECURITY.md, PRIVACY.md, README for CareerPilot | C-04, C-06 | NEXT |
| Remove personal data and agent config from `upstream/`; fix `.gitignore` | C-13, C-23, C-12, C-14 | NEXT |

### 4. Supply chain and CI

| Item | Finding | Status |
|---|---|---|
| Bump or dedupe vulnerable transitives, re-run audit | C-07 | NEXT |
| Root CI: e2e, production Docker build, `yarn npm audit`, licence check, Windows job, CLI tests | C-08 | NEXT |
| Dependabot (npm, actions, docker), CODEOWNERS, root SECURITY.md | C-09 | NEXT |
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
