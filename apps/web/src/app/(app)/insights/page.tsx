import type { Metadata } from "next";

import { loadInsights } from "@/lib/insights-data";

import { InsightsView } from "./insights-view";

export const metadata: Metadata = { title: "Insights" };

/** What the search adds up to: platforms, resume templates and revisions, and what got replies. Read fresh on each visit. */
export default async function InsightsPage() {
  return <InsightsView insights={await loadInsights()} />;
}
