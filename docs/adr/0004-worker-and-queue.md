# ADR 0004: A separate worker on a PostgreSQL queue (pg-boss)

Status: proposed after a spike. Date: 2026-11-04. Roadmap tasks 5.2 to 5.5.

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

## Consequences and what is not decided

- **One more process in the compose files and the CapRover definition.** A deployment that runs only the web process keeps working: a job enqueued with no worker waits, and the screen says "waiting for the worker" rather than "running". Until the worker ships, scans stay in the web process as they are today.
- **Recovery takes up to a minute or two**, not seconds. That is fine for scans and checks and is shown as such in the run.
- **Not yet done:** the worker entrypoint, the Docker/compose changes, moving the first job type over, and a smoke test of the production image with a worker. These are the next steps of 5.2; this ADR only records that the library does what the plan needs. It is proposed, not accepted, until the first job type runs through it in the image.
- **Tokens and cost (5.4)** do not depend on the queue: they need the AI providers to report the tokens each call used, which they do not today (`ChatAnswer` carries text and a cut-off flag only). That is its own change.
