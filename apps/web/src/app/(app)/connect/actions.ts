"use server";

import { z } from "zod";

import { action, ActionError } from "@/lib/action";
import { assistantsSeenSince, listConnectedAssistants } from "@/lib/connect/assistants";
import { startOfDay } from "@/lib/connect/day";
import { OPENCODE_REDIRECT_URI } from "@/lib/connect/instructions";
import { prisma } from "@/lib/prisma";
import { loadSettings, saveSettings } from "@/lib/settings-data";
import { lastKnownTimeZone } from "@/lib/time-zone";

/** The most apps the connector's allow-list holds, as in Settings → MCP connector. */
const MAX_REDIRECTS = 10;

/**
 * Gets the connector ready for OpenCode: turns it on if it is off, and allows
 * the callback address OpenCode signs in through. Both are things the person
 * would otherwise do by hand in Settings → MCP connector.
 */
export const prepareOpenCode = action(z.object({}), async () => {
  const settings = await loadSettings();
  const redirects = settings.connectorRedirects.includes(OPENCODE_REDIRECT_URI) ? settings.connectorRedirects : [...settings.connectorRedirects, OPENCODE_REDIRECT_URI];
  if (redirects.length > MAX_REDIRECTS) throw new ActionError(`That's ${MAX_REDIRECTS} apps already. Remove one in Settings → MCP connector first.`);
  await saveSettings({
    connectorRedirects: redirects,
    ...(settings.connectorEnabledAt ? {} : { connectorEnabledAt: new Date().toISOString() }),
  });
  return { connectorOn: true, redirectAllowed: true };
});

/** What "Test connection" polls: the assistants that called after `since`. */
export const checkConnection = action(z.object({ since: z.iso.datetime() }), async ({ since }) => {
  const now = new Date();
  return { seen: await assistantsSeenSince(prisma, new Date(since), startOfDay(now, await lastKnownTimeZone())) };
});

/** The current list, for the screen to refresh after a token is made or revoked. */
export const refreshAssistants = action(z.object({}), async () => {
  return { assistants: await listConnectedAssistants(prisma, startOfDay(new Date(), await lastKnownTimeZone())) };
});
