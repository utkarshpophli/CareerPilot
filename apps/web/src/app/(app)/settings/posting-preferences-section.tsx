"use client";

import { useState } from "react";

import { useTrackSave } from "@/components/save-tracker";
import { toastResult } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ScanPreferences } from "@/lib/settings";

import { saveScanPreferences } from "./actions";
import { SettingsSectionIntro } from "./settings-screen";

const REMOTE: { value: ScanPreferences["remote"]; label: string }[] = [
  { value: "yes", label: "Yes, I want remote work" },
  { value: "no", label: "No, I do not want remote work" },
  { value: "unknown", label: "Not sure, or I do not mind" },
];

const MAX_LINES = 30;
/** One entry per line, trimmed, without blanks or repeats (whatever the case). */
const toLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, all) => line && all.findIndex((other) => other.toLowerCase() === line.toLowerCase()) === index);

/**
 * Settings → Posting preferences: what scans score postings against besides your profile (which has no field for
 * remote work, pay or things to avoid). Every control saves on its own, and the postings already kept are scored
 * again. Nothing here is guessed: until you say, remote work is "not sure" and there is no minimum.
 */
export function PostingPreferencesSection({ initial }: { initial: ScanPreferences }) {
  const track = useTrackSave();
  const [remote, setRemote] = useState(initial.remote);
  const [amount, setAmount] = useState(initial.minSalary ? String(initial.minSalary.amount) : "");
  const [currency, setCurrency] = useState(initial.minSalary?.currency ?? "");
  const [keywords, setKeywords] = useState(initial.excludeKeywords.join("\n"));
  const [companies, setCompanies] = useState(initial.excludeCompanies.join("\n"));
  const [errors, setErrors] = useState<{ pay?: string; keywords?: string; companies?: string }>({});

  /** Checks what is typed, and saves it if it makes sense; otherwise says what is wrong and saves nothing. */
  const save = async (next: { remote?: ScanPreferences["remote"]; amount?: string; currency?: string; keywords?: string; companies?: string }) => {
    const values = { remote, amount, currency, keywords, companies, ...next };
    const problems: typeof errors = {};
    let minSalary: ScanPreferences["minSalary"] = null;
    const typed = values.amount.trim();
    // No amount means no minimum, whatever is left in the currency box.
    if (typed) {
      const number = Number(typed);
      if (!typed || !Number.isInteger(number) || number < 1) problems.pay = "Give the yearly amount as a whole number.";
      else if (!/^[A-Za-z]{3}$/.test(values.currency.trim())) problems.pay = "Give the currency as three letters, such as EUR.";
      else minSalary = { amount: number, currency: values.currency.trim().toUpperCase() };
    }
    const excludeKeywords = toLines(values.keywords);
    const excludeCompanies = toLines(values.companies);
    if (excludeKeywords.length > MAX_LINES) problems.keywords = `At most ${MAX_LINES} words or phrases.`;
    if (excludeCompanies.length > MAX_LINES) problems.companies = `At most ${MAX_LINES} companies.`;
    if (excludeKeywords.some((item) => item.length > 80)) problems.keywords = "Each one is at most 80 characters.";
    if (excludeCompanies.some((item) => item.length > 80)) problems.companies = "Each one is at most 80 characters.";
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    toastResult(await track(saveScanPreferences({ remote: values.remote, minSalary, excludeKeywords, excludeCompanies })));
  };

  return (
    <>
      <SettingsSectionIntro title="Posting preferences">
        What the Review page scores postings against, besides your profile. Your profile says nothing about remote work, pay or what to avoid, so say it here. A posting that mentions a word you avoid, or comes from a company you avoid, is scored 0.
      </SettingsSectionIntro>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-label font-medium text-ink">Remote work</legend>
        {REMOTE.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="remote"
              value={option.value}
              checked={remote === option.value}
              onChange={() => {
                setRemote(option.value);
                void save({ remote: option.value });
              }}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-start gap-3">
        <Input
          label="Lowest yearly pay"
          type="number"
          min={1}
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          onBlur={() => void save({})}
          hint="Postings that state pay in the same currency are checked against it. Leave empty for no minimum."
          className="w-56"
        />
        <Input label="Currency" value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value)} onBlur={() => void save({})} className="w-24" />
      </div>
      {errors.pay && (
        <p role="alert" className="text-label text-danger">
          {errors.pay}
        </p>
      )}

      <Textarea
        label="Words to avoid"
        hint="One per line, for example “commission only”."
        rows={4}
        value={keywords}
        onChange={(event) => setKeywords(event.target.value)}
        onBlur={() => void save({})}
        error={errors.keywords}
      />
      <Textarea label="Companies to avoid" hint="One per line." rows={3} value={companies} onChange={(event) => setCompanies(event.target.value)} onBlur={() => void save({})} error={errors.companies} />
    </>
  );
}
