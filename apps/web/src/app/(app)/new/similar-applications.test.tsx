// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Duplicate } from "@/lib/duplicate-guard";

import { findSimilarApplications } from "./actions";
import { SimilarApplications } from "./similar-applications";

vi.mock("./actions", () => ({ findSimilarApplications: vi.fn() }));

const details = { title: "", company: "Acme", role: "Designer", location: "Berlin", mode: "", salary: "", deadline: "" };
const sent: Duplicate = { id: "a1", title: "Designer · Acme", status: "SENT", relation: "same-role", sentDaysAgo: 12, withinCooldown: true };

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(findSimilarApplications).mockReset();
});

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
}

describe("the notice about applications you already have", () => {
  it("shows nothing when there are none", async () => {
    vi.mocked(findSimilarApplications).mockResolvedValue({ ok: true, data: [] });
    render(<SimilarApplications details={details} postingUrl="" />);
    await settle();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("links to each one and says how it repeats the opening and where it stands", async () => {
    vi.mocked(findSimilarApplications).mockResolvedValue({ ok: true, data: [sent] });
    render(<SimilarApplications details={details} postingUrl="https://x.test/1" />);
    await settle();
    const note = screen.getByRole("note", { name: "Applications you already have" });
    expect(note).toHaveTextContent("You applied for this lately.");
    expect(screen.getByRole("link", { name: "Designer · Acme" })).toHaveAttribute("href", "/applications/a1");
    expect(note).toHaveTextContent("the same company, role and place, sent 12 days ago (inside the 90-day wait)");
    expect(findSimilarApplications).toHaveBeenCalledWith({ company: "Acme", role: "Designer", location: "Berlin", postingUrl: "https://x.test/1" });
  });

  it("uses the milder wording when nothing was sent lately, and asks once while the details settle", async () => {
    vi.mocked(findSimilarApplications).mockResolvedValue({ ok: true, data: [{ ...sent, status: "DRAFT", sentDaysAgo: null, withinCooldown: false }] });
    const { rerender } = render(<SimilarApplications details={{ ...details, company: "A" }} postingUrl="" />);
    rerender(<SimilarApplications details={{ ...details, company: "Ac" }} postingUrl="" />);
    rerender(<SimilarApplications details={details} postingUrl="" />);
    await settle();
    expect(findSimilarApplications).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("note")).toHaveTextContent("You may already have this.");
  });

  it("shows nothing when the check fails", async () => {
    vi.mocked(findSimilarApplications).mockResolvedValue({ ok: false, error: "No." } as never);
    render(<SimilarApplications details={details} postingUrl="" />);
    await settle();
    expect(screen.queryByRole("note")).toBeNull();
  });
});
