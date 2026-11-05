"use client";

import type { Unit } from "@/lib/application-data";
import { atsSummary, lintUnits } from "@/lib/ats-lint";

/**
 * What applicant-tracking parsers may trip over in the resume, with "Make ATS-safe" for the characters it can
 * fix itself (M7.3). Nothing when the resume is clean. The fix is a version, so it can be undone.
 */
export function AtsNotice({ units, onFix, busy }: { units: Unit[]; onFix: () => void; busy: boolean }) {
  const findings = lintUnits(units);
  if (findings.length === 0) return null;
  const { fixable } = atsSummary(findings);
  return (
    <div role="note" aria-label="ATS check" className="flex flex-col gap-1.5 rounded-card border border-line-card bg-card px-4 py-3 text-meta">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-muted">Some applicant-tracking systems read this resume badly:</p>
        {fixable > 0 && (
          <button type="button" onClick={onFix} disabled={busy} className="text-ink underline underline-offset-2 hover:text-muted disabled:opacity-60">
            Make ATS-safe
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-0.5 text-ink">
        {findings.map((finding) => (
          <li key={finding.rule}>
            {finding.message}
            {!finding.fixable && <span className="text-muted"> · yours to shorten</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
