// Greenhouse board source. Ported from career-ops (MIT, Santiago Fernández de
// Valderrama): upstream/career-ops/providers/greenhouse.mjs. Verdict:
// docs/sources/greenhouse.md.

import { htmlToText, MAX_DESCRIPTION } from "./html-text";
import { requestBoardJson, validSlug } from "./request";
import { BoardError, type BoardAdapter, type BoardPosting, type BoardRef } from "./types";

const API_HOST = "boards-api.greenhouse.io";
const BOARD_HOSTS = new Set(["boards.greenhouse.io", "boards.eu.greenhouse.io", "job-boards.greenhouse.io", "job-boards.eu.greenhouse.io"]);

/** A board from a slug or an address on Greenhouse's own hosts, read from the parsed address (never a pattern over the raw text, which also matched another site's path or query). */
function refFrom(input: string): BoardRef | null {
  const text = input.trim();
  if (validSlug(text)) return { slug: text };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const segments = url.pathname.split("/").filter(Boolean);
  let slug: string | undefined;
  if (url.hostname === API_HOST) slug = segments[0] === "v1" && segments[1] === "boards" ? segments[2] : undefined;
  else if (BOARD_HOSTS.has(url.hostname)) slug = segments[0] === "embed" ? (url.searchParams.get("for") ?? undefined) : segments[0];
  return slug && validSlug(slug) ? { slug } : null;
}

function epochToIso(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const time = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

const idOf = (raw: unknown): string | undefined => {
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const id = String(raw).trim();
  return id === "" ? undefined : id;
};

const WORK_MODEL = /^(?:hybrid|in[-\s]?office|on[-\s]?site|distributed|remote|flexible)$/i;

/** True when a location is only a work model ("Hybrid", "Distributed; Hybrid"): the city is then in /offices. "Hybrid - London" is already filterable and left alone. */
export function isWorkModelOnly(name: unknown): boolean {
  if (typeof name !== "string") return false;
  const parts = name.split(";").map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((part) => WORK_MODEL.test(part));
}

/** Job id to the offices it is open in, from /offices (offices contain departments, which contain jobs; offices nest). */
export function buildOfficeMap(json: unknown): Map<unknown, Set<string>> {
  const map = new Map<unknown, Set<string>>();
  const walk = (offices: unknown) => {
    if (!Array.isArray(offices)) return;
    for (const office of offices as Record<string, unknown>[]) {
      if (!office || typeof office !== "object") continue;
      const name = typeof office.name === "string" ? office.name.trim() : "";
      if (name) {
        for (const department of Array.isArray(office.departments) ? (office.departments as Record<string, unknown>[]) : []) {
          for (const job of Array.isArray(department?.jobs) ? (department.jobs as Record<string, unknown>[]) : []) {
            if (!job || job.id == null) continue;
            if (!map.has(job.id)) map.set(job.id, new Set());
            map.get(job.id)!.add(name);
          }
        }
      }
      walk(office.children);
    }
  };
  walk((json as { offices?: unknown } | null)?.offices);
  return map;
}

type RawJob = { id?: unknown; requisition_id?: unknown; title?: unknown; absolute_url?: unknown; first_published?: unknown; location?: { name?: unknown }; content?: unknown };

const usable = (json: unknown): RawJob[] => {
  const jobs = (json as { jobs?: unknown } | null)?.jobs;
  return Array.isArray(jobs) ? (jobs as RawJob[]).filter((job) => job && typeof job.absolute_url === "string" && job.absolute_url && idOf(job.id) !== undefined) : [];
};

/** Postings from a /jobs?content=true answer. `offices` is the optional /offices answer, used only where a location hides its city. */
export function parseGreenhouse(json: unknown, ref: BoardRef, company: string, offices?: unknown): BoardPosting[] {
  const officeMap = offices ? buildOfficeMap(offices) : null;
  return usable(json).map((job) => {
    let location = typeof job.location?.name === "string" ? job.location.name : "";
    const where = officeMap?.get(job.id);
    // Sorted, because Greenhouse does not promise an order and a changing string would look like a changed posting.
    if (where && where.size > 0 && isWorkModelOnly(location)) location = [location, ...[...where].sort()].join(" · ");
    return {
      source: "GREENHOUSE",
      externalId: `${ref.slug}:${idOf(job.id)}`,
      ...(idOf(job.requisition_id) ? { requisitionId: idOf(job.requisition_id) } : {}),
      title: typeof job.title === "string" ? job.title : "",
      company,
      location,
      remote: null,
      url: job.absolute_url as string,
      description: htmlToText(job.content, { cap: MAX_DESCRIPTION }),
      postedAt: epochToIso(job.first_published),
      salary: null,
    };
  });
}

export const greenhouse: BoardAdapter = {
  source: "GREENHOUSE",
  name: "Greenhouse",
  hosts: [API_HOST],
  refFrom,
  async fetchBoard(ref, company, context = {}) {
    if (!validSlug(ref.slug)) throw new BoardError("bad-slug", "That is not a Greenhouse board name.");
    const base = `https://${API_HOST}/v1/boards/${encodeURIComponent(ref.slug)}`;
    const options = { hosts: [API_HOST], signal: context.signal, fetchImpl: context.fetchImpl, sleep: context.sleep };
    // content=true puts every posting's body in the one answer (no request per posting).
    const json = await requestBoardJson(`${base}/jobs?content=true`, { ...options, maxBytes: 25 * 1024 * 1024 });
    let offices: unknown;
    if (usable(json).some((job) => isWorkModelOnly(job.location?.name))) {
      // Best effort: a scan never fails because the second lookup did, and a board without /offices is common.
      offices = await requestBoardJson(`${base}/offices`, { ...options, maxBytes: 25 * 1024 * 1024 }).catch(() => undefined);
    }
    return parseGreenhouse(json, ref, company, offices);
  },
};
