# CareerPilot: the web app

The dashboard and server of CareerPilot: your profile, tailored resumes and letters, every application tracked from draft to offer, and a live view of what your AI assistants are doing. For the project as a whole, see the [root README](../../README.md); for the plan, [`docs/MASTER_PLAN.md`](../../docs/MASTER_PLAN.md).

It is for one person on their own machine or small server: one password, your data in your own PostgreSQL database, and an AI model of your choice (a local one through Ollama or LM Studio, or a hosted one). It never sends or submits anything for you without your click.

This app started as [dossier](https://github.com/AienTech/dossier) (AGPL-3.0) and has been changed substantially; see [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md). It is free software under the GNU Affero General Public License v3.0 only ([`LICENSE`](LICENSE)). If you run a modified copy for other people over a network, the licence requires you to offer them your source.

## Run it on your computer

You need Node 24 (see `.nvmrc`), Yarn 4 through corepack, and PostgreSQL (the development compose file starts one).

```bash
cd apps/web
corepack enable
yarn install
cp .env.example .env              # then fill in CAREERPILOT_PASSWORD, CAREERPILOT_SECRET, DATABASE_URL
yarn hash-password                # prints the hash to put in CAREERPILOT_PASSWORD
docker compose up -d db           # development database on 127.0.0.1:5432 (compose.yml is for development only)
yarn prisma migrate deploy
yarn dev                          # http://localhost:3000
```

On Windows use `corepack yarn ...` if `yarn` is not on your PATH. Settings are environment variables named `CAREERPILOT_*`; the old `DOSSIER_*` names still work and print a one-line reminder to rename them.

## Connect an assistant

Create an API token in Settings, then use the `pilot` command line (`apps/cli`) or the MCP connector; see [`docs/AGENTS.md`](../../docs/AGENTS.md). Assistants can report what they are doing (it shows on the Runs page) and track applications, but cannot mark an application as sent or record an interview or offer: only you can.

## Run it on a server

There is no published image yet. Build your own and use `compose.production.yml`; its header explains the steps. Put the app behind HTTPS and set `CAREERPILOT_PUBLIC_URL`. Read [`SECURITY.md`](../../SECURITY.md) and [`docs/security/SECURITY_PLAN.md`](../../docs/security/SECURITY_PLAN.md) first.

## Checks

```bash
yarn lint
yarn typecheck
yarn test                         # database tests need DATABASE_URL pointing at a PostgreSQL
yarn test:e2e                     # Playwright (needs the app and a database)
```

More for contributors in [`DEVELOPMENT.md`](DEVELOPMENT.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md). What the app contacts and stores is described in [`PRIVACY.md`](PRIVACY.md).
