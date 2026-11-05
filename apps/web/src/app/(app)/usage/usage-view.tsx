import Link from "next/link";

import { describeBudget, type BudgetState } from "@/lib/ai/budget";
import type { Money, UsageGroup, UsageSummary } from "@/lib/usage-summary";

const count = (value: number) => value.toLocaleString("en-US");
/** 4.5 EUR, 0.0081 EUR; "under 0.0001" for less. */
const money = (item: Money) => `${item.amount > 0 && item.amount < 0.0001 ? "under 0.0001" : Number(item.amount.toFixed(4)).toString()} ${item.currency}`;
const moneyList = (items: Money[]) => items.map(money).join(", ");
const costCell = (group: UsageGroup) => (group.cost.length > 0 ? moneyList(group.cost) : group.unpriced > 0 ? "no price" : group.free > 0 ? "free" : "none");
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
          <th scope="col" className="py-1.5 pr-4 text-right font-normal">
            Tokens out
          </th>
          <th scope="col" className="py-1.5 text-right font-normal">
            Cost
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
            <td className="py-1.5 pr-4 text-right tabular-nums">{count(group.outputTokens)}</td>
            <td className="py-1.5 text-right tabular-nums">{costCell(group)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The Usage page (M5.4): what the AI calls of the last days used, by day, model, task and who asked. */
export function UsageView({ summary, days, budget }: { summary: UsageSummary; days: number; budget: BudgetState }) {
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
        {summary.cost.length > 0 && <p>Money: {moneyList(summary.cost)}.</p>}
        {summary.unpriced > 0 && (
          <p className="text-meta text-muted">
            {plural(summary.unpriced, "call")} to a hosted model {summary.unpriced === 1 ? "has" : "have"} no price, so {summary.unpriced === 1 ? "it is" : "they are"} not in the money total.
          </p>
        )}
        <p className="text-meta text-muted">
          Tokens are what each provider reported for the call. The prices are the ones you entered under Settings → Budget; none are built in. A model that runs on your own machine costs nothing but time.
        </p>
        <p className="text-sm" aria-live="polite">
          {describeBudget(budget)}{" "}
          <Link href="/settings?section=budget" className="underline underline-offset-2">
            Budget settings
          </Link>
        </p>
      </div>
      <Table name="By day" keyHeading="Day" groups={summary.byDay} />
      <Table name="By model" keyHeading="Model" groups={summary.byModel} />
      <Table name="By task" keyHeading="Task" groups={summary.byTask} />
      <Table name="Who asked" keyHeading="Who" groups={summary.byActor} />
    </div>
  );
}
