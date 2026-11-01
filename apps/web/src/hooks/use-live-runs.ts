"use client";

import { useEffect, useState } from "react";

import type { RunView } from "@/lib/runs-view";

/**
 * The runs list kept live through Server-Sent Events. Starts from what the
 * server already rendered, so the first paint is complete; the browser
 * reconnects by itself if the stream drops.
 */
export function useLiveRuns(initial: RunView[]): RunView[] {
  const [runs, setRuns] = useState(initial);
  useEffect(() => {
    const source = new EventSource("/api/runs/stream");
    source.onmessage = (event: MessageEvent<string>) => setRuns((JSON.parse(event.data) as { runs: RunView[] }).runs);
    return () => source.close();
  }, []);
  return runs;
}
