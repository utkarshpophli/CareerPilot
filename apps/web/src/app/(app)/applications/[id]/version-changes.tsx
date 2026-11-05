import type { UnitChange } from "@/lib/text-diff";

const KIND_WORDS: Record<UnitChange["kind"], string> = { same: "", changed: "Changed", added: "Added", removed: "Removed" };

/** What one version changed, part by part: removed words struck through, added words highlighted (M7.2). */
export function VersionChanges({ first, changes }: { first: boolean; changes: UnitChange[] }) {
  if (first) return <p className="text-meta text-muted">This is the first version, so there is nothing before it to compare.</p>;
  if (changes.length === 0) return <p className="text-meta text-muted">Nothing changed in the text.</p>;
  return (
    <ul aria-label="What changed" className="flex flex-col gap-2.5">
      {changes.map((change) => (
        <li key={change.id} className="flex flex-col gap-0.5 text-meta">
          <span className="font-medium text-ink">
            {change.label} <span className="font-normal text-muted">· {KIND_WORDS[change.kind]}</span>
          </span>
          <span className="break-words whitespace-pre-wrap">
            {change.parts.map((part, index) =>
              part.type === "del" ? (
                <del key={index} className="bg-danger-surface text-danger">
                  <span className="sr-only">Removed: </span>
                  {part.text}
                </del>
              ) : part.type === "add" ? (
                <ins key={index} className="bg-warning-surface text-ink no-underline">
                  <span className="sr-only">Added: </span>
                  {part.text}
                </ins>
              ) : (
                <span key={index} className="text-muted">
                  {part.text}
                </span>
              ),
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
