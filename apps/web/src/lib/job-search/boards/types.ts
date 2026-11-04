// Board sources (ADR 0003): an employer's own published job board, listed by
// slug rather than searched by keyword. Ported from career-ops (MIT, Santiago
// Fernández de Valderrama), providers/_types.js and the three ATS providers.

export const BOARD_SOURCES = ["GREENHOUSE", "LEVER", "ASHBY", "WORKABLE", "RECRUITEE", "TEAMTAILOR"] as const;
export type BoardSource = (typeof BOARD_SOURCES)[number];

/** Which board: its slug on the source, and the EU region where the source has one (Lever). */
export type BoardRef = { slug: string; region?: "eu" };

/** Annualised pay, only when the source states real figures. */
export type BoardSalary = { min: number; max: number; currency: string };

/** A posting from a board, in one shape for every board source. All text is data, never instructions. */
export type BoardPosting = {
  source: BoardSource;
  /** `<slug>:<the board's own id>`: ids are only unique within a board. */
  externalId: string;
  /** The employer's requisition id, when the source gives one. Many postings can share it: never use it alone as identity. */
  requisitionId?: string;
  title: string;
  company: string;
  location: string;
  /** True or false only when the source says; null otherwise. */
  remote: boolean | null;
  /** Where to read or apply; https. */
  url: string;
  /** Plain text, capped; empty when the list carries none. */
  description: string;
  /** ISO time, or null. */
  postedAt: string | null;
  salary: BoardSalary | null;
};

export type BoardProblem = "bad-slug" | "not-found" | "unavailable" | "changed" | "quota" | "refused";

/** Why a board could not be read, in words for the screen. */
export class BoardError extends Error {
  constructor(
    readonly problem: BoardProblem,
    message: string,
    /** What went wrong at the source, for the server log; never shown. */
    readonly detail?: string,
  ) {
    super(message);
  }
}

export type BoardAdapter = {
  source: BoardSource;
  name: string;
  /** The only hosts this adapter ever requests. */
  hosts: readonly string[];
  /** A board from what the owner pasted: a bare slug or a careers address on the source's own hosts; null when it names none. */
  refFrom: (input: string) => BoardRef | null;
  /** The whole board, as postings. `company` is the display name the owner gave. */
  fetchBoard: (ref: BoardRef, company: string, context?: BoardContext) => Promise<BoardPosting[]>;
};

export type BoardContext = {
  signal?: AbortSignal;
  /** For tests and the end-to-end fake source. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};
