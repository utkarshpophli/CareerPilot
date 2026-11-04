# ADR 0004: A separate worker on a PostgreSQL queue (pg-boss)

Status: accepted for the board scan once the image smoke test in CI passes (see "Built"); other job types follow. Date: 2026-11-04. Roadmap tasks 5.2 to 5.5.

## Context

Scans, liveness checks, the agent's daily run and backups run inside the web process today. A restart loses the work in flight (`lib/jobs/runner.ts` finds unfinished jobs by key and starts again only when someone opens the page). M5 moves them to a worker that survives restarts, runs on a schedule, and can be watched.

## The spike

`pg-boss` 12.38.0 (MIT, Node 22.12 or newer, uses the `pg` driver the app already depends on) was run against a scratch database on the same PostgreSQL 16 the app uses, from a script outside the repository. What was seen, not what the documentation promises:

| Question | Result |
|---|---|
| Does it install its own tables, away from ours? | Yes, in its own schema (`queue` here). Nothing in `public` is touched, so Prisma migrations do not see it. |
| Can the same work be queued twice by accident? | With a plain queue, yes: two `send` calls with the same `singletonKey` made two jobs. With `policy: "short"` the second call returned `null` and no second job was made. A scan of one board uses `policy: "short"` and the board's id as key. |
| Does work survive a worker that dies mid-job? | Yes. A worker took the job (state `active`) and the process exited. A new worker, started later, got the same job back (`retry_count` 1) and completed it. With a 5 s expiry it came back about a minute after the first worker died: pg-boss's maintenance runs about once a minute, so recovery is not instant. |
| Can it run things on a schedule? | Yes. `schedule("scan", "* * * * *", data)` stored a cron schedule in the database; it survives restarts and is shared by every worker. |
| What does the app need to depend on? | One package, no second server, no Redis. |

## Decision

Use pg-boss for the queue and schedules, in a separate process (`node worker.js`) from the same image, started by the same `start.sh` family of commands. The web process only enqueues. Each queue sets `policy: "short"` where a duplicate is a mistake (one scan per board, one check per application), `retryLimit` of 2 and an expiry sized to the longest the job may run. What a worker does is the services the doors already call (`scanCompanies`, `checkApplicationPosting`, the agent run), reported as runs, so a queued job and a clicked one look the same in Activity.

## Built (2026-11-04)

- **One job type moved: the board scan.** `scanOneBoard` (services/companies.ts) reads one watched board; the web process's loop and the worker's jobs both call it. Queue `board-scan`, one job per board, `policy: short` with the company id as key, one retry, 10 minutes to finish. Queue `board-scan-all` is the schedule's tick and queues every enabled board.
- **The worker** is `src/worker/` (`worker.ts` is testable, `main.ts` the process). It is bundled by esbuild like the seed (`/app/tools/worker.mjs` in the image, `yarn worker` in development) and needs the web process's environment. It waits for the web process's migrations (and only for those: a bad setting stops it at once with its own message), installs the queue's tables, serves the queues, writes a heartbeat row every 30 seconds and removes it on SIGTERM after finishing the job in hand.
- **Switching it on:** `CAREERPILOT_WORKER=on` makes Settings → Scan now queue the boards instead of reading them in the web process ("Queued 3 boards for the worker"); `CAREERPILOT_SCAN_SCHEDULE` (a cron expression) makes the worker scan every watched board on a schedule. `compose.production.yml` runs a `worker` service and turns it on by default; unset or `off` keeps everything in the web process, no worker needed. `/api/health` reports `worker: ok | stale | none` and stays healthy without one.
- **Assistants' scans (REST, CLI, MCP) are not moved**: they answer with the matching postings in the same call, so they still read the boards inline. Only the owner's Scan now and the schedule use the queue.
- **Tests:** a real worker against the test database (queue a scan, see it read, the ledger line recorded as the scheduler, the heartbeat present and gone after stop, a duplicate refused while one waits), the handlers, the status rule, the health route, the compose file, and `scripts/smoke-image.mjs --worker`, which CI runs on the built image: it starts the web container and a worker container, waits for `/api/health` to report the worker, queues a scan of a board that does not exist, and waits for the worker to record the result. Run locally from the bundle against Postgres: the same round trip worked.
- **Not tested:** the crash recovery above is the spike's finding, not an automated test (it takes about a minute); a worker killed mid-scan has not been exercised in the image.

## Consequences and what is not decided

- **One more process in the compose file.** A deployment that runs only the web process keeps working with `CAREERPILOT_WORKER` off. With it on and no worker running, a queued scan waits (the screen says it was queued for the worker; the health check says `worker: none`). CapRover's single-container definition is unchanged and stays in the web process.
- **Recovery takes up to a minute or two**, not seconds. That is fine for scans and checks and is shown as such in the run.
- **Still to move:** liveness checks, the agent's daily run, backups.
- **Tokens and cost (5.4)** do not depend on the queue: they need the AI providers to report the tokens each call used, which they do not today (`ChatAnswer` carries text and a cut-off flag only). That is its own change.
