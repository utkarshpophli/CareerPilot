"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useLiveRuns } from "@/hooks/use-live-runs";
import type { RunView } from "@/lib/runs-view";

const signature = (run: RunView) => `${run.status}:${run.stepCount}:${run.stalled}`;

/** Re-reads the page when this run takes a step, finishes or stalls, so the timeline stays current. Renders nothing. */
export function LiveRefresh({ run }: { run: RunView }) {
  const router = useRouter();
  const live = useLiveRuns([run]).find((candidate) => candidate.id === run.id);
  const seen = useRef(signature(run));
  useEffect(() => {
    if (!live) return;
    const now = signature(live);
    if (now === seen.current) return;
    seen.current = now;
    router.refresh();
  }, [live, router]);
  return null;
}
