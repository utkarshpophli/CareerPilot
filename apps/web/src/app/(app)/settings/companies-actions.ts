"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { action, ActionError } from "@/lib/action";
import { BOARD_SOURCES } from "@/lib/job-search/boards";
import { prisma } from "@/lib/prisma";
import { loadProfile } from "@/lib/profile-data";
import { ServiceError } from "@/lib/service-error";
import { addCompany, listCompanies, removeCompany, scanCompanies, setCompanyEnabled, toCompanyListItem } from "@/lib/services/companies";
import { preferencesFor } from "@/lib/services/preferences";
import { loadSettings } from "@/lib/settings-data";

// Settings → Watched companies: the owner's side. Adding, pausing and scanning are things an assistant can also do
// (through the REST API, the CLI and MCP); removing is only here, by design.

async function plain<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ServiceError) throw new ActionError(error.message);
    throw error;
  }
}

export const addCompanyAction = action(
  z.object({ board: z.string().trim().min(1).max(500), source: z.enum(BOARD_SOURCES).optional(), name: z.string().max(200).optional() }),
  async (input, { toast }) => {
    const company = await plain(() => addCompany(prisma, input));
    revalidatePath("/settings");
    toast(company.created ? `Now watching ${company.name}.` : `Already watching ${company.name}.`);
    return toCompanyListItem(company);
  },
);

export const setCompanyEnabledAction = action(z.object({ id: z.string().min(1).max(64), enabled: z.boolean() }), async ({ id, enabled }, { toast }) => {
  const result = await plain(() => setCompanyEnabled(prisma, id, enabled));
  revalidatePath("/settings");
  toast(enabled ? `Watching ${result.name} again.` : `${result.name} is paused.`);
  return { id, enabled: result.enabled };
});

export const removeCompanyAction = action(z.object({ id: z.string().min(1).max(64) }), async ({ id }, { toast }) => {
  const result = await plain(() => removeCompany(prisma, id));
  revalidatePath("/settings");
  revalidatePath("/review");
  toast(`Removed ${result.name}.`);
  return { id };
});

/**
 * "Scan now": reads every watched board (one at a time, within a minute and a half), keeps and scores what it finds,
 * and answers with how each board went. The postings themselves are on the Review page.
 */
export const scanNowAction = action(z.object({}), async (_input, { toast }) => {
  const preferences = preferencesFor(await loadProfile(), (await loadSettings()).scanPreferences);
  const result = await scanCompanies(prisma, { preferences, limit: 1 });
  const failed = result.companies.filter((company) => company.error).length;
  revalidatePath("/settings");
  revalidatePath("/review");
  toast(
    result.scanned === 0
      ? "Nothing to scan. Add a company first, or turn one back on."
      : `Scanned ${result.scanned} board${result.scanned === 1 ? "" : "s"}: ${result.added} new, ${result.closed} closed${failed ? `, ${failed} could not be read` : ""}.`,
  );
  return {
    scanned: result.scanned,
    added: result.added,
    closed: result.closed,
    failed,
    skipped: result.skipped,
    companies: (await listCompanies(prisma)).map(toCompanyListItem),
  };
});
