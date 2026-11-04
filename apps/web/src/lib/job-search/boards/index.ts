import { ashby } from "./ashby";
import { recruitee } from "./recruitee";
import { teamtailor } from "./teamtailor";
import { workable } from "./workable";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { BOARD_SOURCES, type BoardAdapter, type BoardSource } from "./types";

export { BOARD_SOURCES, BoardError, type BoardAdapter, type BoardPosting, type BoardRef, type BoardSource } from "./types";

const ADAPTERS: Record<BoardSource, BoardAdapter> = { GREENHOUSE: greenhouse, LEVER: lever, ASHBY: ashby, WORKABLE: workable, RECRUITEE: recruitee, TEAMTAILOR: teamtailor };

export const isBoardSource = (value: string): value is BoardSource => (BOARD_SOURCES as readonly string[]).includes(value);

export const boardAdapter = (source: BoardSource): BoardAdapter => ADAPTERS[source];

/** The board source whose own address this is, for a pasted careers link; null for a bare name or an address nobody here owns. */
export function sourceOfAddress(input: string): BoardSource | null {
  if (!/^https?:\/\//i.test(input.trim())) return null;
  return BOARD_SOURCES.find((source) => ADAPTERS[source].refFrom(input) !== null) ?? null;
}
