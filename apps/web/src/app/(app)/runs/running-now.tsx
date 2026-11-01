"use client";

import Link from "next/link";

import { useLiveRuns } from "@/hooks/use-live-runs";
import type { RunView } from "@/lib/runs-view";

import { RunRow } from "./runs-list";

/** Dashboard card: the runs going on right now, live. Quiet when nothing is. */
export function RunningNow({ initial, timeZone }: { initial: RunView[]; timeZone?: string }) {
  const running = useLiveRuns(initial).filter((run) => run.status === "RUNNING");
  return (
    <section aria-labelledby="running-heading" className="flex flex-col gap-3 rounded-panel border border-line-card bg-card pt-[26px] pb-3">
      <div className="flex items-baseline justify-between gap-4 px-7">
        <h2 id="running-heading" className="font-serif text-section">
          Running now
        </h2>
        <Link href="/runs" className="text-meta underline">
          All runs
        </Link>
      </div>
      {running.length === 0 ? (
        <p className="px-7 pb-2 text-sm text-muted">Nothing is running. When an assistant starts a scan or a draft, you will see it here.</p>
      ) : (
        <ol aria-live="polite" className="flex flex-col divide-y divide-line-card">
          {running.map((run) => (
            <RunRow key={run.id} run={run} timeZone={timeZone} />
          ))}
        </ol>
      )}
    </section>
  );
}
