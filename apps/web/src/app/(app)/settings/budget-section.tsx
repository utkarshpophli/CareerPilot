"use client";

import { useState } from "react";

import { useTrackSave } from "@/components/save-tracker";
import { toastResult } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { describeBudget, type Budget, type BudgetState } from "@/lib/ai/budget";
import type { ModelPrice } from "@/lib/ai/pricing";

import { saveBudget } from "./actions";
import { SettingsSectionIntro } from "./settings-screen";

export type BudgetView = { prices: ModelPrice[]; budget: Budget; state: BudgetState };

const priceLine = (price: ModelPrice) => `${price.model}, ${price.currency}, ${price.inputPerMillion}, ${price.outputPerMillion}`;

/** The prices typed one per line as "model, currency, input per million, output per million"; or the line to fix. */
function parsePrices(text: string): { prices: ModelPrice[] } | { error: string } {
  const prices: ModelPrice[] = [];
  const lines = text.split("\n");
  for (const [index, raw] of lines.entries()) {
    if (!raw.trim()) continue;
    const parts = raw.split(",").map((part) => part.trim());
    const [model, currency, input, output] = parts;
    const inputPerMillion = Number(input);
    const outputPerMillion = Number(output);
    const fine = parts.length === 4 && model && /^[A-Za-z]{3}$/.test(currency) && input !== "" && output !== "" && Number.isFinite(inputPerMillion) && Number.isFinite(outputPerMillion) && inputPerMillion >= 0 && outputPerMillion >= 0;
    if (!fine) return { error: `Line ${index + 1}: give the model, the currency and two prices, like claude-sonnet-5, EUR, 3, 15.` };
    prices.push({ model, currency: currency.toUpperCase(), inputPerMillion, outputPerMillion });
  }
  return prices.length > 50 ? { error: "At most 50 prices." } : { prices };
}

/**
 * Settings → Budget (M5.5): the prices you pay per model, and a monthly cap in money, in tokens, or both. Only hosted
 * models count; one on your own machine costs nothing. At a cap the AI either stops with a clear message or switches
 * to a cheaper model you name. Every field saves when you leave it. No prices are built in: they are yours.
 */
export function BudgetSection({ initial }: { initial: BudgetView }) {
  const track = useTrackSave();
  const { budget } = initial;
  const [prices, setPrices] = useState(initial.prices.map(priceLine).join("\n"));
  const [amount, setAmount] = useState(budget.monthlyLimit ? String(budget.monthlyLimit.amount) : "");
  const [currency, setCurrency] = useState(budget.monthlyLimit?.currency ?? "");
  const [tokens, setTokens] = useState(budget.monthlyTokens ? String(budget.monthlyTokens) : "");
  const [warn, setWarn] = useState(String(budget.warnPercent));
  const [atLimit, setAtLimit] = useState(budget.atLimit);
  const [fallback, setFallback] = useState(budget.fallbackModel ?? "");
  const [errors, setErrors] = useState<{ prices?: string; money?: string; tokens?: string; warn?: string; fallback?: string }>({});

  const save = async (next: { atLimit?: Budget["atLimit"] } = {}) => {
    const values = { prices, amount, currency, tokens, warn, fallback, atLimit, ...next };
    const problems: typeof errors = {};
    const parsed = parsePrices(values.prices);
    if ("error" in parsed) problems.prices = parsed.error;

    let monthlyLimit: Budget["monthlyLimit"] = null;
    if (values.amount.trim()) {
      const number = Number(values.amount);
      if (!Number.isFinite(number) || number <= 0) problems.money = "Give the money cap as a number above 0.";
      else if (!/^[A-Za-z]{3}$/.test(values.currency.trim())) problems.money = "Give the money cap's currency as three letters, such as EUR.";
      else monthlyLimit = { amount: number, currency: values.currency.trim().toUpperCase() };
    }
    let monthlyTokens: Budget["monthlyTokens"] = null;
    if (values.tokens.trim()) {
      const number = Number(values.tokens);
      if (!Number.isInteger(number) || number < 1) problems.tokens = "Give the token cap as a whole number above 0.";
      else monthlyTokens = number;
    }
    const warnPercent = Number(values.warn);
    if (!Number.isInteger(warnPercent) || warnPercent < 1 || warnPercent > 99) problems.warn = "Give the warning level as a whole percent from 1 to 99.";
    if (values.atLimit === "fallback" && !values.fallback.trim()) problems.fallback = "Name the cheaper model to switch to.";
    setErrors(problems);
    if (Object.keys(problems).length > 0 || "error" in parsed) return;
    toastResult(
      await track(
        saveBudget({
          prices: parsed.prices,
          budget: { monthlyLimit, monthlyTokens, warnPercent, atLimit: values.atLimit, fallbackModel: values.fallback.trim() || null },
        }),
      ),
    );
  };

  return (
    <>
      <SettingsSectionIntro title="Budget">
        Cap what hosted AI models can cost you each month. Models on your own machine cost nothing and are not counted.
      </SettingsSectionIntro>

      <p className="text-sm" aria-live="polite">
        {describeBudget(initial.state)}
      </p>
      {initial.state.unpriced > 0 && (
        <p className="text-meta text-muted">
          {initial.state.unpriced} call{initial.state.unpriced === 1 ? "" : "s"} to a hosted model {initial.state.unpriced === 1 ? "has" : "have"} no price, so {initial.state.unpriced === 1 ? "it is" : "they are"} not in the money total. Add the model&apos;s price below, or use a token cap.
        </p>
      )}

      <Textarea
        label="Prices you pay"
        hint="One model per line: its exact name, the currency, then the price per million tokens in and out, like claude-sonnet-5, EUR, 3, 15. CareerPilot has no prices built in: take them from your provider's price page."
        rows={4}
        value={prices}
        onChange={(event) => setPrices(event.target.value)}
        onBlur={() => void save()}
        error={errors.prices}
      />

      <div className="flex flex-wrap items-start gap-3">
        <Input label="Money cap per month" type="number" min={0} step="any" value={amount} onChange={(event) => setAmount(event.target.value)} onBlur={() => void save()} className="w-56" hint="Leave empty for no money cap." />
        <Input label="Currency of the money cap" value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value)} onBlur={() => void save()} className="w-32" />
      </div>
      {errors.money && (
        <p role="alert" className="text-label text-danger">
          {errors.money}
        </p>
      )}
      <Input label="Token cap per month" type="number" min={0} inputMode="numeric" value={tokens} onChange={(event) => setTokens(event.target.value)} onBlur={() => void save()} className="w-56" hint="Tokens in and out of hosted models together. Needs no prices. Leave empty for no token cap." error={errors.tokens} />
      <Input label="Warn at (percent of a cap)" type="number" min={1} max={99} inputMode="numeric" value={warn} onChange={(event) => setWarn(event.target.value)} onBlur={() => void save()} className="w-56" error={errors.warn} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-label font-medium text-ink">At a cap</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="atLimit"
            checked={atLimit === "stop"}
            onChange={() => {
              setAtLimit("stop");
              void save({ atLimit: "stop" });
            }}
          />
          Stop: AI calls are refused until next month, with a message that says why.
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="atLimit"
            checked={atLimit === "fallback"}
            onChange={() => {
              setAtLimit("fallback");
              void save({ atLimit: "fallback" });
            }}
          />
          Switch to a cheaper model of the same provider.
        </label>
      </fieldset>
      <Input label="Cheaper model to switch to" value={fallback} onChange={(event) => setFallback(event.target.value)} onBlur={() => void save()} className="w-80" hint="Its exact name, as your provider lists it. It is not capped." error={errors.fallback} />
    </>
  );
}
