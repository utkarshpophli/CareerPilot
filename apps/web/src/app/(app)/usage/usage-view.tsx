import type { UsageGroup, UsageSummary } from "@/lib/usage-summary";

const count = (value: number) => value.toLocaleString("en-US");
const plural = (value: number, word: string) => `${count(value)} ${word}${value === 1 ? "" : "s"}`;

function Table({ name, keyHeading, groups }: { name: string; keyHeading: string; groups: UsageGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <table className="w-full max-w-[720px] border-collapse text-sm">
      <caption className="pb-2 text-left font-medium">{name}</caption>
      <thead>
        <tr className="border-b border-line-card text-left text-meta text-muted">
          <th scope="col" className="py-1.5 pr-4 font-normal">
            {keyHeading}
          </th>
          <th scope="col" className="py-1.5 pr-4 text-right font-normal">
            Calls
          </th>
          <th scope="col" className="py-1.5 pr-4 text-right font-normal">
            Tokens in
          </th>
          <th scope="col" className="py-1.5 text-right font-normal">
            Tokens out
          </th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => (
          <tr key={group.key} className="border-b border-line-card/60 last:border-0">
            <th scope="row" className="py-1.5 pr-4 text-left font-normal break-all">
              {group.key}
            </th>
            <td className="py-1.5 pr-4 text-right tabular-nums">{count(group.calls)}</td>
            <td className="py-1.5 pr-4 text-right tabular-nums">{count(group.inputTokens)}</td>
            <td className="py-1.5 text-right tabular-nums">{count(group.outputTokens)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The Usage page (M5.4): what the AI calls of the last days used, by day, model, task and who asked. */
export function UsageView({ summary, days }: { summary: UsageSummary; days: number }) {
  if (summary.calls === 0) return <p className="text-sm text-muted">No AI calls in the last {days} days.</p>;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <p>
          {plural(summary.calls, "call")} in the last {days} days: {count(summary.inputTokens)} tokens in, {count(summary.outputTokens)} out.
        </p>
        {summary.unmeasured > 0 && (
          <p className="text-meta text-muted">
            {plural(summary.unmeasured, "call")} came back without token numbers; those are counted as calls and add nothing to the totals.
          </p>
        )}
        <p className="text-meta text-muted">
          Tokens are what each provider reported for the call. CareerPilot does not know what your provider charges, so no money is shown; multiply by the price on your provider&apos;s page. A model that runs on your own
          machine costs nothing but time.
        </p>
      </div>
      <Table name="By day" keyHeading="Day" groups={summary.byDay} />
      <Table name="By model" keyHeading="Model" groups={summary.byModel} />
      <Table name="By task" keyHeading="Task" groups={summary.byTask} />
      <Table name="Who asked" keyHeading="Who" groups={summary.byActor} />
    </div>
  );
}
