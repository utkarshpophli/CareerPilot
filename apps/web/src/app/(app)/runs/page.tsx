import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { loadRunsSnapshot } from "@/lib/runs";
import { userTimeZone } from "@/lib/time-zone";

import { RunsList } from "./runs-list";

export const metadata: Metadata = { title: "Runs" };

/** Work in progress and recently finished: scans, evaluations and anything an assistant reports on, updated live. */
export default async function RunsPage() {
  const [runs, timeZone] = await Promise.all([loadRunsSnapshot(prisma), userTimeZone()]);
  return (
    <>
      <PageHeader title="Runs" description="What your assistants and schedules are doing right now, and what they did last. Each run shows its steps as they happen." />
      <div className="flex flex-col gap-4 px-10 pb-10">
        <RunsList initial={runs} timeZone={timeZone} />
      </div>
    </>
  );
}
