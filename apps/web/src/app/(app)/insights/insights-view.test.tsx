import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { computeInsights, type InsightApplication } from "@/lib/insights";

import { InsightsView } from "./insights-view";

vi.mock("next/navigation", () => ({ usePathname: () => null, useRouter: () => ({}), useSearchParams: () => new URLSearchParams() }));

const now = new Date("2026-11-04T10:00:00Z");

const applications: InsightApplication[] = [
  {
    id: "a",
    title: "Engineer at Acme",
    createdAt: new Date("2026-11-03T09:00:00Z"),
    sentAt: new Date("2026-11-03T10:00:00Z"),
    status: "INTERVIEW",
    furthestStage: "INTERVIEW",
    origin: "MANUAL",
    postingUrl: "https://jobs.lever.co/acme/1",
    postingSource: null,
    documents: [{ kind: "RESUME", themeName: "Ledger", versionCauses: ["WRITTEN", "REFINED", "REFINED"] }],
  },
];

describe("InsightsView", () => {
  it("says so when there is nothing to count", () => {
    render(<InsightsView insights={computeInsights([], now)} />);
    expect(screen.getByText(/nothing to count yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows platforms, templates and resume revisions", () => {
    render(<InsightsView insights={computeInsights(applications, now)} />);

    const platform = screen.getByRole("table", { name: "By platform" });
    const lever = within(platform).getByRole("row", { name: /lever/ });
    expect(within(lever).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["1", "1", "1", "1", "0", "100%"]);

    const template = screen.getByRole("table", { name: "By resume template" });
    expect(within(template).getByRole("row", { name: /Ledger/ })).toBeInTheDocument();

    const revisions = screen.getByRole("region", { name: "Resume revisions" });
    expect(revisions).toHaveTextContent("2 in total, 2.0 per application.");
    expect(within(revisions).getByText("Changed in chat: 2")).toBeInTheDocument();
    expect(within(revisions).getByRole("link", { name: "Engineer at Acme" })).toHaveAttribute("href", "/applications/a");
  });

  it("has every weekly number in a table for screen readers", () => {
    render(<InsightsView insights={computeInsights(applications, now)} />);
    const weekly = screen.getByRole("table", { name: "Applications per week" });
    expect(within(weekly).getAllByRole("row")).toHaveLength(13);
  });
});
