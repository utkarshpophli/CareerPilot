"use client";

import Link from "next/link";

import { useLiveRuns } from "@/hooks/use-live-runs";
import type { RunView } from "@/lib/runs-view";

import { actorLabel, statusLabel, when } from "./run-format";

/** One run as a row: what it is, who is doing it, how far it got, and what it did last. */
export function RunRow({ run, timeZone }: { run: RunView; timeZone?: string }) {
  const failed = run.status === "FAILED" || run.stalled;
  return (
    <li className="flex flex-col gap-1 px-5 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link href={`/runs/${run.id}`} className="font-medium underline">
          {run.title}
        </Link>
        <span className={`rounded-full border px-2 text-meta ${failed ? "border-danger text-danger" : "border-line-field text-muted"}`}>{statusLabel(run)}</span>
        <span className="text-meta text-muted">{actorLabel(run)}</span>
        <time dateTime={run.startedAt} className="text-meta text-muted tabular-nums">
          {when(run.startedAt, timeZone)}
        </time>
      </div>
      <p className="text-meta text-muted">
        {run.stepCount} {run.stepCount === 1 ? "step" : "steps"}
        {run.status === "RUNNING" ? (run.lastStep ? `. Now: ${run.lastStep}` : ". Starting.") : run.summary ? `. ${run.summary}` : ""}
      </p>
    </li>
  );
}

/** The Runs screen's list, kept live: a step an agent reports appears here without a refresh. */
export function RunsList({ initial, timeZone }: { initial: RunView[]; timeZone?: string }) {
  const runs = useLiveRuns(initial);
  if (runs.length === 0) {
    return (
      <div className="flex max-w-[620px] flex-col gap-2 text-muted">
        <p>No runs yet. When an assistant or the command line starts a piece of work, it shows up here and updates as it goes.</p>
        <p>
          Make a token in <Link className="underline" href="/settings">Settings</Link>, then try <code className="rounded bg-input px-1">pilot run start scan &quot;Daily scan&quot;</code>.
        </p>
      </div>
    );
  }
  return (
    <ol aria-live="polite" className="flex flex-col divide-y divide-line-card rounded-panel border border-line-card bg-card">
      {runs.map((run) => (
        <RunRow key={run.id} run={run} timeZone={timeZone} />
      ))}
    </ol>
  );
}
