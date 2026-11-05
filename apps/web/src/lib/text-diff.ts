import type { Unit } from "./application-data";

// What changed between two versions of a document (M7.2): a word-level diff of each part. Pure.

export type DiffPart = { type: "same" | "add" | "del"; text: string };

/** Beyond this many token pairs the middle of two texts is shown as replaced, instead of working out the smallest diff. */
const MAX_CELLS = 1_500_000;

const tokens = (text: string) => text.match(/\s+|\S+/g) ?? [];

/** Joins neighbouring pieces of one type, and puts removed text before added text inside each changed run. */
function merge(pieces: DiffPart[]): DiffPart[] {
  const result: DiffPart[] = [];
  let run: DiffPart[] = [];
  const flush = () => {
    for (const type of ["del", "add"] as const) {
      const text = run.filter((piece) => piece.type === type).map((piece) => piece.text).join("");
      if (text) result.push({ type, text });
    }
    run = [];
  };
  for (const piece of pieces) {
    if (piece.type === "same") {
      flush();
      const last = result[result.length - 1];
      if (last?.type === "same") last.text += piece.text;
      else result.push({ ...piece });
    } else {
      run.push(piece);
    }
  }
  flush();
  return result;
}

/** The words that were removed and added to turn `before` into `after`, with the unchanged text between them. */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const head = a.slice(0, start).map((text): DiffPart => ({ type: "same", text }));
  const tail = a.slice(endA).map((text): DiffPart => ({ type: "same", text }));
  const x = a.slice(start, endA);
  const y = b.slice(start, endB);

  let middle: DiffPart[];
  if (x.length * y.length > MAX_CELLS) {
    middle = [...x.map((text): DiffPart => ({ type: "del", text })), ...y.map((text): DiffPart => ({ type: "add", text }))];
  } else {
    // Longest common subsequence of the middle, then walked back into pieces.
    const width = y.length + 1;
    const table = new Uint16Array((x.length + 1) * width);
    for (let i = x.length - 1; i >= 0; i--) {
      for (let j = y.length - 1; j >= 0; j--) {
        table[i * width + j] = x[i] === y[j] ? table[(i + 1) * width + j + 1]! + 1 : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
      }
    }
    middle = [];
    let i = 0;
    let j = 0;
    while (i < x.length || j < y.length) {
      if (i < x.length && j < y.length && x[i] === y[j]) {
        middle.push({ type: "same", text: x[i]! });
        i++;
        j++;
      } else if (j < y.length && (i === x.length || table[i * width + j + 1]! >= table[(i + 1) * width + j]!)) {
        middle.push({ type: "add", text: y[j]! });
        j++;
      } else {
        middle.push({ type: "del", text: x[i]! });
        i++;
      }
    }
  }
  return merge([...head, ...middle, ...tail]);
}

export type UnitChange = { id: string; label: string; kind: "same" | "changed" | "added" | "removed"; parts: DiffPart[] };

/** Each part of the newer document in its order, then the parts only the older one had. */
export function diffUnits(before: Unit[], after: Unit[]): UnitChange[] {
  const old = new Map(before.map((unit) => [unit.id, unit]));
  const seen = new Set<string>();
  const changes: UnitChange[] = [];
  for (const unit of after) {
    seen.add(unit.id);
    const previous = old.get(unit.id);
    if (!previous) changes.push({ id: unit.id, label: unit.label, kind: "added", parts: unit.text ? [{ type: "add", text: unit.text }] : [] });
    else if (previous.text === unit.text) changes.push({ id: unit.id, label: unit.label, kind: "same", parts: unit.text ? [{ type: "same", text: unit.text }] : [] });
    else changes.push({ id: unit.id, label: unit.label, kind: "changed", parts: diffWords(previous.text, unit.text) });
  }
  for (const unit of before) {
    if (!seen.has(unit.id)) changes.push({ id: unit.id, label: unit.label, kind: "removed", parts: unit.text ? [{ type: "del", text: unit.text }] : [] });
  }
  return changes;
}

/** True when any part was added, removed or changed. */
export const hasChanges = (changes: UnitChange[]) => changes.some((change) => change.kind !== "same");
