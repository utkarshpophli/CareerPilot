// What a run's steps say about why (M5.3): where the information came from, which prompt or scorer made a judgement, and
// what was decided. The app's own steps and an assistant's (POST /api/v1/runs/{id}/events with these keys in `data`) use the
// same four plain-text keys, and the run page shows them before the counts. Text only, one line, never a document.

export const STEP_FIELDS = ["source", "promptVersion", "scorerVersion", "decision"] as const;
export type StepField = (typeof STEP_FIELDS)[number];
export type StepDetail = Partial<Record<StepField, string>>;

export const STEP_TEXT_MAX = 200;

const oneLine = (value: string) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > STEP_TEXT_MAX ? `${text.slice(0, STEP_TEXT_MAX - 1)}…` : text;
};

/** Step data from the replay fields and the counts; an empty field is left out. */
export function stepData(input: StepDetail & Record<string, string | number | boolean | null | undefined>): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === "") continue;
    out[key] = (STEP_FIELDS as readonly string[]).includes(key) && typeof value === "string" ? oneLine(value) : value;
  }
  return out;
}

/** The replay fields of a step's stored data, tidied for display, and everything else (null when nothing else). */
export function readStep(data: unknown): { detail: StepDetail; rest: Record<string, unknown> | null } {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return { detail: {}, rest: null };
  const detail: StepDetail = {};
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if ((STEP_FIELDS as readonly string[]).includes(key) && typeof value === "string" && value.trim()) detail[key as StepField] = oneLine(value);
    else rest[key] = value;
  }
  return { detail, rest: Object.keys(rest).length > 0 ? rest : null };
}
