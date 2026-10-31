import type { Metadata } from "next";

import { ActivityActor } from "@/generated/prisma/enums";
import { listActivity } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";
import { userTimeZone } from "@/lib/time-zone";

import { ActivityFeed, type ActivityView } from "./activity-feed";

export const metadata: Metadata = { title: "Activity" };

const VIEWS: Record<ActivityView, { actorKind?: ActivityActor }> = {
  all: {},
  you: { actorKind: ActivityActor.USER },
  mcp: { actorKind: ActivityActor.MCP },
  cli: { actorKind: ActivityActor.CLI },
  scheduler: { actorKind: ActivityActor.SCHEDULER },
  system: { actorKind: ActivityActor.SYSTEM },
};

const isView = (value: string | undefined): value is ActivityView => value !== undefined && Object.hasOwn(VIEWS, value);

/** Everything done in the app, by you or by an agent, newest first. `?actor=` narrows it; `?before=` pages back. */
export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  const params = await searchParams;
  const actor = typeof params.actor === "string" ? params.actor : undefined;
  const before = typeof params.before === "string" && params.before.length <= 64 ? params.before : undefined;
  const view: ActivityView = isView(actor) ? actor : "all";
  const [page, timeZone] = await Promise.all([listActivity(prisma, VIEWS[view], { before }), userTimeZone()]);
  return <ActivityFeed events={page.events} next={page.next} view={view} timeZone={timeZone} />;
}
