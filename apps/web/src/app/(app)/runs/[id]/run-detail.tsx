import Link from "next/link";

import type { ActivityEvent } from "@/generated/prisma/client";
import type { RunView } from "@/lib/runs-view";

import { actorLabel, statusLabel, when } from "../run-format";

const DATA_MAX = 300;

const details = (data: ActivityEvent["data"]) => {
  if (data === null || data === undefined) return "";
  const text = JSON.stringify(data);
  return text.length > DATA_MAX ? `${text.slice(0, DATA_MAX)}...` : text;
};

const seconds = (date: Date, timeZone: string | undefined) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", ...(timeZone ? { timeZone } : {}) }).format(date);

/** A run and its steps, oldest first: what was done, by whom, and what each step reported. */
export function RunDetail({ run, events, timeZone }: { run: RunView; events: ActivityEvent[]; timeZone?: string }) {
  const failed = run.status === "FAILED" || run.stalled;
  return (
    <div className="flex flex-col gap-4 px-10 pb-10">
      <dl className="grid max-w-[620px] grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-meta">
        <dt className="text-muted">Status</dt>
        <dd className={failed ? "text-danger" : undefined}>{statusLabel(run)}</dd>
        <dt className="text-muted">Started by</dt>
        <dd>{actorLabel(run)}</dd>
        <dt className="text-muted">Started</dt>
        <dd>{when(run.startedAt, timeZone)}</dd>
        {run.finishedAt && (
          <>
            <dt className="text-muted">Finished</dt>
            <dd>{when(run.finishedAt, timeZone)}</dd>
          </>
        )}
        <dt className="text-muted">Steps</dt>
        <dd>{run.stepCount}</dd>
        {run.applicationId && (
          <>
            <dt className="text-muted">Application</dt>
            <dd>
              <Link className="underline" href={`/applications/${run.applicationId}`}>
                Open
              </Link>
            </dd>
          </>
        )}
      </dl>
      {run.stalled && <p className="text-danger">No step for a long time. The assistant may have stopped without finishing this run.</p>}

      <ol className="flex flex-col divide-y divide-line-card rounded-panel border border-line-card bg-card">
        {events.map((event) => (
          <li key={event.id} className="flex flex-col gap-0.5 px-5 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <time dateTime={event.at.toISOString()} className="text-meta text-muted tabular-nums">
                {seconds(event.at, timeZone)}
              </time>
              <span className={event.outcome === "ERROR" ? "text-danger" : undefined}>
                {event.outcome === "ERROR" && <span className="sr-only">Failed: </span>}
                {event.summary}
              </span>
            </div>
            {details(event.data) && <code className="text-meta break-all text-muted">{details(event.data)}</code>}
          </li>
        ))}
      </ol>
      <Link href="/runs" className="self-start text-meta underline">
        All runs
      </Link>
    </div>
  );
}
