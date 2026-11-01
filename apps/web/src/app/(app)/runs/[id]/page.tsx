import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getRun } from "@/lib/runs";
import { toRunView } from "@/lib/runs-view";
import { userTimeZone } from "@/lib/time-zone";

import { LiveRefresh } from "./live-refresh";
import { RunDetail } from "./run-detail";

export const metadata: Metadata = { title: "Run" };

/** One run with its steps, oldest first. Updates by itself while the run is going. */
export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const [{ id }, timeZone] = await Promise.all([params, userTimeZone()]);
  const found = await getRun(prisma, id);
  if (!found) notFound();
  const { events, ...row } = found;
  const run = toRunView(row);
  return (
    <>
      <PageHeader title={run.title} description={`A ${run.kind} run.`} />
      <RunDetail run={run} events={events} timeZone={timeZone} />
      {run.status === "RUNNING" && <LiveRefresh run={run} />}
    </>
  );
}
