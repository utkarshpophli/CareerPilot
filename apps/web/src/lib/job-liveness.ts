import { boardAdapter, BoardError, type BoardRef, type BoardSource } from "@/lib/job-search/boards";
import type { BoardContext } from "@/lib/job-search/boards/types";
import { validSlug } from "@/lib/job-search/boards/request";

// Is a posting still open (roadmap M4d.2, the part that needs no browser)?
// Ported in spirit from career-ops's liveness-api.mjs (MIT): ask the employer's
// own board. Conservative by design, as upstream: "closed" only on a clear
// signal, and anything doubtful is "unknown", because a wrong "closed" costs a
// real job and a wrong "unknown" costs a click. Pages that need a browser are
// M5's.

export type Liveness = {
  state: "open" | "closed" | "unknown";
  /** One plain sentence saying how that was found out, or why it could not be. */
  note: string;
};

export type BoardPostingRef = { source: BoardSource; ref: BoardRef; externalId: string };

const GREENHOUSE_HOSTS = new Set(["boards.greenhouse.io", "boards.eu.greenhouse.io", "job-boards.greenhouse.io", "job-boards.eu.greenhouse.io"]);
const LEVER_HOSTS: Record<string, "eu" | undefined> = { "jobs.lever.co": undefined, "jobs.eu.lever.co": "eu" };
const ASHBY_HOST = "jobs.ashbyhq.com";
const UUIDISH = /^[A-Za-z0-9-]{8,64}$/;

/** The board and posting a posting's own address names, read from the parsed address; null for anything else. */
export function boardPostingOf(address: string): BoardPostingRef | null {
  let url: URL;
  try {
    url = new URL(address.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const [slug, second, third] = segments;
  if (!slug || !validSlug(slug)) return null;
  if (GREENHOUSE_HOSTS.has(url.hostname)) {
    return second === "jobs" && third && /^\d{1,20}$/.test(third) ? { source: "GREENHOUSE", ref: { slug }, externalId: `${slug}:${third}` } : null;
  }
  if (url.hostname in LEVER_HOSTS) {
    return second && UUIDISH.test(second) ? { source: "LEVER", ref: { slug, region: LEVER_HOSTS[url.hostname] }, externalId: `${slug}:${second}` } : null;
  }
  if (url.hostname === ASHBY_HOST) {
    return second && UUIDISH.test(second) ? { source: "ASHBY", ref: { slug }, externalId: `${slug}:${second}` } : null;
  }
  return null;
}

/** What the last scan of the board that listed this posting said (lib/services/scanned-postings.ts); null when no scan ever listed it. */
export function livenessFromScan(scan: { closedAt: Date | null; lastSeenAt: Date } | null): Liveness | null {
  if (!scan) return null;
  return scan.closedAt
    ? { state: "closed", note: "The employer's board no longer lists it (your last scan of that board)." }
    : { state: "open", note: "The employer's board listed it when it was last scanned." };
}

const CANNOT_TELL = "Can't tell from here: this link isn't a posting on Greenhouse, Lever or Ashby. Add the company under Settings → Watched companies and scan it, or open the link.";

export async function checkLiveness(address: string, { scan = null, ...context }: BoardContext & { scan?: { closedAt: Date | null; lastSeenAt: Date } | null } = {}): Promise<Liveness> {
  const posting = boardPostingOf(address);
  if (!posting) return livenessFromScan(scan) ?? { state: "unknown", note: CANNOT_TELL };

  const adapter = boardAdapter(posting.source);
  let listed;
  try {
    listed = await adapter.fetchBoard(posting.ref, posting.ref.slug, context);
  } catch (error) {
    if (!(error instanceof BoardError)) throw error;
    return { state: "unknown", note: `Can't tell: ${adapter.name} didn't give the board (${error.message.replace(/\.$/, "")}).` };
  }

  // An empty answer proves nothing: boards that suddenly list nothing are far more often a hiccup than a company closing every role.
  if (listed.length === 0) return { state: "unknown", note: `Can't tell: ${adapter.name} listed no postings for this board right now.` };
  if (listed.some((item) => item.externalId === posting.externalId)) return { state: "open", note: `${adapter.name} still lists it.` };
  if (posting.source === "LEVER") {
    return { state: "unknown", note: "Can't tell: Lever's public list leaves some open postings out, so a missing one may still be open. Open the link to see." };
  }
  return { state: "closed", note: `${adapter.name} no longer lists it on the employer's board.` };
}
