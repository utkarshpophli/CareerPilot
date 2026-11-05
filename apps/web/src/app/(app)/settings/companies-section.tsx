"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { toastResult } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CompanyListItem } from "@/lib/services/companies";

import { addCompanyAction, removeCompanyAction, scanNowAction, setCompanyEnabledAction } from "./companies-actions";
import { SettingsSectionIntro } from "./settings-screen";

const SOURCES = [
  { value: "GREENHOUSE", label: "Greenhouse" },
  { value: "LEVER", label: "Lever" },
  { value: "ASHBY", label: "Ashby" },
  { value: "WORKABLE", label: "Workable" },
  { value: "RECRUITEE", label: "Recruitee" },
  { value: "TEAMTAILOR", label: "Teamtailor" },
  { value: "ATLASSIAN", label: "Atlassian" },
] as const;
const sourceName = (source: string) => SOURCES.find((entry) => entry.value === source)?.label ?? source;

const byName = (a: CompanyListItem, b: CompanyListItem) => a.name.localeCompare(b.name);
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** How the last scan of a board went, in words. */
function health(company: CompanyListItem): string {
  if (!company.enabled) return "Paused. It is not read until you resume it.";
  if (company.lastError) return `Could not be read: ${company.lastError}`;
  if (!company.lastOkAt) return "Not read yet.";
  return `${plural(company.lastFound, "posting")}, last read ${company.lastOkAt.slice(0, 10)}.`;
}

/**
 * Settings → Watched companies (M4b.5): the employers whose own job boards (Greenhouse, Lever, Ashby, Workable, Recruitee, Teamtailor, Atlassian) are read for
 * you. What they list lands on the Review page. Assistants can add a board and scan too; only you can remove one.
 */
export function CompaniesSection({ initial }: { initial: CompanyListItem[] }) {
  const [companies, setCompanies] = useState([...initial].sort(byName));
  const [board, setBoard] = useState("");
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CompanyListItem | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = toastResult(await addCompanyAction({ board, ...(source ? { source: source as (typeof SOURCES)[number]["value"] } : {}), ...(name.trim() ? { name } : {}) }));
    setBusy(false);
    if (!result.ok) return;
    setCompanies((current) => [...current.filter((entry) => entry.id !== result.data.id), result.data].sort(byName));
    setBoard("");
    setName("");
  };

  const toggle = async (company: CompanyListItem) => {
    const result = toastResult(await setCompanyEnabledAction({ id: company.id, enabled: !company.enabled }));
    if (result.ok) setCompanies((current) => current.map((entry) => (entry.id === company.id ? { ...entry, enabled: result.data.enabled } : entry)));
  };

  const remove = async (company: CompanyListItem) => {
    const result = toastResult(await removeCompanyAction({ id: company.id }));
    if (result.ok) setCompanies((current) => current.filter((entry) => entry.id !== company.id));
  };

  const scan = async () => {
    setScanning(true);
    setScanned(null);
    const result = toastResult(await scanNowAction({}));
    setScanning(false);
    if (!result.ok) return;
    setCompanies([...result.data.companies].sort(byName));
    if (result.data.queued !== undefined) {
      const { queued, alreadyWaiting = 0, worker } = result.data;
      const waiting = alreadyWaiting ? ` (${alreadyWaiting} already waiting)` : "";
      setScanned(
        queued === 0
          ? "Nothing new to queue."
          : worker === "ok"
            ? `Queued ${plural(queued, "board")} for the worker${waiting}. The Review page fills as they finish.`
            : `Queued ${plural(queued, "board")}${waiting}, but no worker is running right now. ${queued === 1 ? "It waits" : "They wait"} until one starts.`,
      );
      return;
    }
    setScanned(
      result.data.scanned === 0
        ? "Nothing was scanned."
        : `Scanned ${plural(result.data.scanned, "board")}: ${result.data.added} new, ${result.data.closed} closed${result.data.failed ? `, ${result.data.failed} could not be read` : ""}.`,
    );
  };

  return (
    <>
      <SettingsSectionIntro title="Watched companies">
        Employers whose own job boards on Greenhouse, Lever, Ashby, Workable, Recruitee, Teamtailor or Atlassian are read for you. Paste a company&apos;s careers link, or give the name of its board and where it is. What they list lands on the Review page, scored against your profile. Postings are read from the employer&apos;s public board, one company at a time.
      </SettingsSectionIntro>

      <form onSubmit={(event) => void add(event)} className="flex flex-wrap items-end gap-3">
        <Input label="Job board name or careers link" value={board} onChange={(event) => setBoard(event.target.value)} className="min-w-[280px] flex-1" required />
        <Select label="Source" value={source} onChange={(event) => setSource(event.target.value)} hint="Leave on automatic for a careers link.">
          <option value="">Automatic (from the link)</option>
          {SOURCES.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </Select>
        <Input label="Name (optional)" value={name} onChange={(event) => setName(event.target.value)} className="w-56" />
        <Button type="submit" disabled={busy || !board.trim()}>
          Watch
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => void scan()} disabled={scanning || companies.length === 0}>
          {scanning ? "Scanning…" : "Scan now"}
        </Button>
        {scanned && (
          <p role="status" className="text-sm">
            {scanned} <Link href="/review" className="underline underline-offset-2">Open the Review page</Link>
          </p>
        )}
      </div>

      {companies.length === 0 ? (
        <p className="max-w-[560px] text-lead text-pretty text-muted">No companies are watched yet. Add one above.</p>
      ) : (
        <ul aria-label="Watched companies" className="flex flex-col gap-2">
          {companies.map((company) => (
            <li key={company.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line-card px-4 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{company.name}</span>
                <span className="text-meta text-muted">
                  {sourceName(company.source)} · {company.slug}
                  {company.region ? ` (${company.region.toUpperCase()})` : ""}
                </span>
                <span className={company.lastError && company.enabled ? "text-meta text-warning" : "text-meta text-muted"}>{health(company)}</span>
              </div>
              <span className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => void toggle(company)}>
                  <span>
                    {company.enabled ? "Pause" : "Resume"} <span className="sr-only">{company.name}</span>
                  </span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(event) => {
                    returnFocus.current = event.currentTarget;
                    setRemoving(company);
                  }}
                >
                  <span>
                    Remove <span className="sr-only">{company.name}</span>
                  </span>
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? "company"}?`}
        description="It will no longer be read. Postings you saved or dismissed stay as they are, and saved postings stay on the Review page; the rest are closed."
        confirmLabel="Remove company"
        returnFocusTo={returnFocus}
        onConfirm={() => removing && void remove(removing)}
      />
    </>
  );
}
