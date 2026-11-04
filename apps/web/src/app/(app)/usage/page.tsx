import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { userTimeZone } from "@/lib/time-zone";
import { loadUsageRows } from "@/lib/usage-data";
import { summarizeUsage } from "@/lib/usage-summary";

import { UsageView } from "./usage-view";

export const metadata: Metadata = { title: "Usage" };

const DAYS = 30;
/** What the AI calls used, in tokens: by day, model, task and who asked. */
export default async function UsagePage() {
  const [rows, timeZone] = await Promise.all([
    loadUsageRows(DAYS),
    userTimeZone(),
  ]);
  return (
    <>
      <PageHeader title="Usage" description="The tokens your AI calls used, so you can see what a scan, a draft or an assistant costs you in your provider's terms." />
      <div className="flex flex-col gap-4 px-10 pb-10">
        <UsageView summary={summarizeUsage(rows, timeZone ?? "UTC")} days={DAYS} />
      </div>
    </>
  );
}
