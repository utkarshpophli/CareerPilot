/**
 * The licence and where to get the source (audit C-02). CareerPilot is licensed
 * under the GNU Affero General Public License v3.0 only: people who use a copy
 * over a network are entitled to its source. Shown on the sign-in page and in
 * Settings → About. Plain markup, so it works in server and client components.
 */
export function SourceNotice({ sourceUrl, commit }: { sourceUrl: string; commit: string | null }) {
  return (
    <p className="text-meta leading-[1.6] text-pretty text-muted">
      CareerPilot is free software under the GNU Affero General Public License v3.0 only.{" "}
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-2">
        Source code<span className="sr-only"> (opens in a new tab)</span>
      </a>
      {commit && <> for the version built from {commit.slice(0, 7)}</>}. If you run a modified copy for other people over a network, the licence requires you to offer them your source.
    </p>
  );
}
