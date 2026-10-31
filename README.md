# CareerPilot

A job-search workbench: find and verify openings, score fit honestly, draft truthful tailored resumes and letters, and track every application, from a dashboard. You can also drive it from a CLI, Claude Code, Codex or any MCP client; everything those do shows up in the dashboard.

It never submits or sends anything for you without a click.

Status: early. The plan is in [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md).

## Layout

| Path | What |
|---|---|
| `apps/web` | The application (Next.js, PostgreSQL, Prisma). Based on dossier. |
| `upstream/career-ops`, `upstream/ai-job-search` | Read-only reference copies of the two MIT projects we port from. |
| `research/` | Analysis and design documents that led to the plan. |
| `docs/` | Master plan and architecture decision records (`docs/adr`). |

## Develop

Needs Node 24 (see `.nvmrc`), Yarn 4 through corepack, and PostgreSQL.

```bash
cd apps/web
corepack enable
yarn install
cp .env.example .env   # then fill in the values
yarn prisma generate
yarn dev
```

Checks: `yarn lint`, `yarn typecheck`, `yarn test` (add `--project db` tests need `DATABASE_URL`).

## Licence

AGPL-3.0-only. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
