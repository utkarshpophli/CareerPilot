import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { boardAdapter, BOARD_SOURCES, BoardError, isBoardSource, sourceOfAddress, type BoardPosting, type BoardSource } from "@/lib/job-search/boards";
import { ACTIONS, recordActivity, recordActivitySafe } from "@/lib/ledger";
import { logServerError } from "@/lib/log";
import { ServiceError } from "@/lib/service-error";

import { reportAsRun } from "./runs";

// Tracked companies as a service (ADR 0003): employers whose own job board is
// watched. Adding one only records a name; a scan reads each enabled board in
// turn, keeps how it went (so a broken board shows as broken), and returns the
// postings that match. Reading public job boards sends nothing and decides
// nothing about the owner's search: scoring and keeping postings come later.

export const MAX_COMPANIES = 200;
const NAME_MAX = 100;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const DEFAULT_BUDGET_MS = 90_000;

/** A name that is one line of plain text. */
const cleanName = (value: string) => value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);

export type AddCompanyInput = {
  /** Omit when `board` is the company's own careers address. */
  source?: BoardSource;
  /** A board name such as "stripe", or its careers address on the source's own site. */
  board: string;
  /** What to call it; the board name when omitted. */
  name?: string;
};

export type CompanyView = { id: string; source: BoardSource; slug: string; region: string; name: string; enabled: boolean; lastScanAt: Date | null; lastOkAt: Date | null; lastError: string; lastFound: number };

async function add(db: PrismaClient, input: AddCompanyInput): Promise<CompanyView & { created: boolean }> {
  const board = input.board.trim();
  if (!board) throw new ServiceError("bad_request", "Say which board: its name, or its careers address.");
  const source = input.source ?? sourceOfAddress(board);
  if (!source) throw new ServiceError("bad_request", `Say which source it is on (${BOARD_SOURCES.join(", ")}), or paste the company's own careers address.`);
  if (!isBoardSource(source)) throw new ServiceError("bad_request", `The source must be one of ${BOARD_SOURCES.join(", ")}.`);
  const ref = boardAdapter(source).refFrom(board);
  if (!ref) throw new ServiceError("bad_request", `That is not a ${boardAdapter(source).name} board name or address.`);
  const region = ref.region ?? "";

  const existing = await db.trackedCompany.findUnique({ where: { source_slug_region: { source, slug: ref.slug, region } } });
  if (existing) return { ...existing, created: false };
  if ((await db.trackedCompany.count()) >= MAX_COMPANIES) throw new ServiceError("conflict", `At most ${MAX_COMPANIES} companies can be watched. Remove one in Settings first.`);

  const name = cleanName(input.name ?? "") || ref.slug;
  try {
    const row = await db.$transaction(async (tx) => {
      const created = await tx.trackedCompany.create({ data: { source, slug: ref.slug, region, name } });
      await recordActivity(tx, { action: ACTIONS.companyAdded, summary: `Watching ${name} on ${boardAdapter(source).name}`, targetType: "company", targetId: created.id });
      return created;
    });
    return { ...row, created: true };
  } catch (error) {
    // Two requests added the same board at once: the other one won.
    if ((error as { code?: unknown }).code === "P2002") {
      const won = await db.trackedCompany.findUniqueOrThrow({ where: { source_slug_region: { source, slug: ref.slug, region } } });
      return { ...won, created: false };
    }
    throw error;
  }
}

/** Starts watching an employer's job board. Reported as a run when an assistant does it. */
export const addCompany = (db: PrismaClient, input: AddCompanyInput) =>
  reportAsRun(
    db,
    { kind: "companies.add", title: `Watch ${cleanName(input.name ?? "") || input.board.trim().slice(0, 80) || "a company"}` },
    () => add(db, input),
    (company) => ({ summary: company.created ? `Now watching ${company.name}` : `Already watching ${company.name}`, data: { created: company.created } }),
  );

/** Every watched company by name, with how its last scan went. */
export const listCompanies = (db: PrismaClient): Promise<CompanyView[]> => db.trackedCompany.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] });

export type ScanOptions = {
  /** Only these companies; every enabled one when omitted. */
  ids?: string[];
  /** Every word must appear in the title or description. */
  keywords?: string;
  /** Part of the location; remote postings match any place. */
  place?: string;
  limit?: number;
  /** Stop starting new boards after this long (a scan runs inside the web process); the rest are left for the next scan. */
  budgetMs?: number;
};

export type ScanResult = {
  scanned: number;
  companies: { id: string; name: string; found: number; error?: string; skipped?: true }[];
  /** Boards not reached because the time was up. */
  skipped: number;
  /** How many postings matched before the limit cut the list. */
  matched: number;
  /** Newest first. */
  postings: BoardPosting[];
};

type Adapters = (source: BoardSource) => ReturnType<typeof boardAdapter>;

const matches = (posting: BoardPosting, words: string[], place: string) => {
  const text = `${posting.title} ${posting.description}`.toLowerCase();
  if (!words.every((word) => text.includes(word))) return false;
  return !place || posting.remote === true || posting.location.toLowerCase().includes(place);
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** What a failed board says: a BoardError's words are written for people; anything else is a bug whose text stays in the log. */
function reasonFor(company: string, error: unknown): string {
  if (error instanceof BoardError) {
    if (error.problem === "changed" || error.problem === "unavailable") logServerError(`board ${company}`, new Error(error.detail ?? error.message));
    return error.message;
  }
  logServerError(`board ${company}`, error);
  return "It failed unexpectedly; the server log has the details.";
}

/**
 * Reads the enabled boards one at a time (one request at a time to a host, as
 * the sources ask), records how each went, and returns the postings that match.
 * A board that fails does not stop the others. Reported as a run, a step per
 * board, when an assistant scans; the ledger gets one line of counts either way.
 */
export const scanCompanies = (db: PrismaClient, options: ScanOptions = {}, { adapters = boardAdapter, now: clock = Date.now }: { adapters?: Adapters; now?: () => number } = {}): Promise<ScanResult> =>
  reportAsRun(
    db,
    { kind: "companies.scan", title: options.keywords?.trim() ? `Scan boards for ${options.keywords.trim().slice(0, 80)}` : "Scan watched boards" },
    async ({ step }) => {
      const rows = await db.trackedCompany.findMany({ where: { enabled: true, ...(options.ids ? { id: { in: options.ids } } : {}) }, orderBy: [{ name: "asc" }, { id: "asc" }] });
      const words = (options.keywords ?? "").toLowerCase().split(/\s+/).filter(Boolean);
      const place = (options.place ?? "").trim().toLowerCase();
      const found: BoardPosting[] = [];
      const companies: ScanResult["companies"] = [];
      const startedAt = clock();
      const budget = options.budgetMs ?? DEFAULT_BUDGET_MS;

      for (const row of rows) {
        if (clock() - startedAt >= budget) {
          companies.push({ id: row.id, name: row.name, found: 0, skipped: true });
          await step(`${row.name}: not reached, the time was up`);
          continue;
        }
        const now = new Date();
        try {
          const postings = await adapters(row.source).fetchBoard({ slug: row.slug, ...(row.region === "eu" ? { region: "eu" as const } : {}) }, row.name);
          await db.trackedCompany.update({ where: { id: row.id }, data: { lastScanAt: now, lastOkAt: now, lastError: "", lastFound: postings.length } });
          companies.push({ id: row.id, name: row.name, found: postings.length });
          found.push(...postings.filter((posting) => matches(posting, words, place)));
          await step(`${row.name}: ${plural(postings.length, "posting")}`, { found: postings.length });
        } catch (error) {
          const reason = reasonFor(row.name, error);
          await db.trackedCompany.update({ where: { id: row.id }, data: { lastScanAt: now, lastError: reason } });
          companies.push({ id: row.id, name: row.name, found: 0, error: reason });
          await step(`${row.name}: could not be read (${reason})`);
        }
      }

      const limit = Math.min(MAX_LIMIT, Math.max(1, options.limit ?? DEFAULT_LIMIT));
      found.sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? "") || a.title.localeCompare(b.title));
      const failed = companies.filter((company) => company.error).length;
      const skipped = companies.filter((company) => company.skipped).length;
      await recordActivitySafe(db, {
        action: ACTIONS.boardsScanned,
        summary: `Scanned ${plural(companies.length - skipped, "board")}: ${companies.length - skipped - failed} worked, ${failed} did not${skipped ? `, ${skipped} not reached` : ""}`,
        targetType: "company",
        data: { scanned: companies.length - skipped, failed, skipped, found: found.length },
      });
      return { scanned: companies.length - skipped, skipped, companies, matched: found.length, postings: found.slice(0, limit) };
    },
    (result) => {
      const failed = result.companies.filter((company) => company.error).length;
      return {
        summary: `Scanned ${plural(result.scanned, "board")}: ${result.scanned - failed} worked, ${failed} did not${result.skipped ? `, ${result.skipped} not reached` : ""}; ${plural(result.matched, "posting")}`,
        data: { scanned: result.scanned, failed, skipped: result.skipped, matched: result.matched },
      };
    },
  );

/** A posting from a board as an assistant sees it in a list: a snippet and a link, never the whole text. */
export function boardPostingSummary(posting: BoardPosting) {
  return {
    source: posting.source,
    externalId: posting.externalId,
    title: posting.title,
    company: posting.company,
    location: posting.location || undefined,
    remote: posting.remote ?? undefined,
    salary: posting.salary ?? undefined,
    posted: posting.postedAt?.slice(0, 10),
    url: posting.url,
    snippet: posting.description.replace(/\s+/g, " ").slice(0, 280),
  };
}
