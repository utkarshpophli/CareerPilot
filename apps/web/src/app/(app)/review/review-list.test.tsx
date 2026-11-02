import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/toast";
import type { ScanPosting } from "@/lib/services/scanned-postings";

import { setPostingStateAction } from "./actions";
import { ReviewList } from "./review-list";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/review", useSearchParams: () => new URLSearchParams() }));
vi.mock("./actions", () => ({ setPostingStateAction: vi.fn(async ({ state }: { state: string }) => ({ ok: true, data: { state, changed: true, title: "x" }, toast: `Done ${state}` })) }));
vi.mock("@/components/toast", () => ({ toast: vi.fn(), toastResult: (result: unknown) => result }));

const posting = (extra: Partial<ScanPosting> = {}): ScanPosting => ({
  id: "p1",
  source: "GREENHOUSE",
  externalId: "acme:1",
  title: "Senior Product Designer",
  company: "Acme",
  location: "Berlin",
  remote: null,
  url: "https://example.test/jobs/1",
  description: "Design systems in Figma. ".repeat(30),
  postedAt: new Date("2026-10-30T00:00:00Z"),
  salary: null,
  isNew: true,
  score: 91,
  band: "excellent",
  scoreReasons: ["The title matches the role you want: Product Designer", "Mentions 3 of your skills: Figma"],
  scoreRedFlags: ["Pay up to EUR 50,000 is below your minimum of EUR 60,000"],
  guardAlarm: false,
  ...extra,
});

beforeEach(() => vi.clearAllMocks());

/** The posting cards (not the reason lists inside them). */
const cards = () => within(screen.getByRole("list", { name: "Postings" })).getAllByRole("listitem").filter((item) => item.parentElement === screen.getByRole("list", { name: "Postings" }));

describe("ReviewList", () => {
  it("shows each posting with its score, why, what counts against it, and a link to read it", () => {
    render(<ReviewList postings={[posting()]} view="new" />);
    const item = cards()[0]!;
    expect(within(item).getByRole("link", { name: /Senior Product Designer/ })).toHaveAttribute("href", "https://example.test/jobs/1");
    expect(within(item).getByRole("link", { name: /Senior Product Designer/ })).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(within(item).getByRole("img", { name: "Score 91 of 100" })).toBeInTheDocument();
    expect(item).toHaveTextContent("Acme");
    expect(item).toHaveTextContent("Berlin");
    expect(item).toHaveTextContent("Mentions 3 of your skills: Figma");
    expect(item).toHaveTextContent("Pay up to EUR 50,000 is below");
    expect(item).toHaveTextContent("New");
  });

  it("says plainly when a posting has no score, and warns about text that tried to instruct an AI", () => {
    render(<ReviewList postings={[posting({ score: null, band: "", scoreReasons: [], scoreRedFlags: [], guardAlarm: true })]} view="new" />);
    const item = cards()[0]!;
    expect(within(item).queryByRole("img", { name: /Score/ })).toBeNull();
    expect(item).toHaveTextContent("Not scored");
    expect(within(item).getByRole("alert")).toHaveTextContent(/instruction-like/i);
  });

  it("shows what the board published as text only, never as markup or a link", () => {
    render(<ReviewList postings={[posting({ title: '<img src=x onerror="alert(1)">Designer', company: "<b>Acme</b>", description: '<script>alert(1)</script> [click](javascript:alert(1)) https://evil.test' })]} view="new" />);
    const item = cards()[0]!;
    expect(item.querySelector("img, b, script")).toBeNull();
    expect(item).toHaveTextContent('<img src=x onerror="alert(1)">Designer');
    expect(within(item).getAllByRole("link")).toHaveLength(1);
  });

  it("offers Save and Dismiss on a new posting, and the buttons name the posting", () => {
    render(<ReviewList postings={[posting()]} view="new" />);
    expect(screen.getByRole("button", { name: "Save Senior Product Designer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss Senior Product Designer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /back to review/i })).toBeNull();
  });

  it("offers the way back on saved and dismissed postings", () => {
    const { unmount } = render(<ReviewList postings={[posting()]} view="saved" />);
    expect(screen.getByRole("button", { name: "Move back to review Senior Product Designer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss Senior Product Designer" })).toBeInTheDocument();
    unmount();
    render(<ReviewList postings={[posting()]} view="dismissed" />);
    expect(screen.getByRole("button", { name: "Move back to review Senior Product Designer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Dismiss/ })).toBeNull();
  });

  it("saves a posting with one click, removes it from the list and says so", async () => {
    const user = userEvent.setup();
    render(<ReviewList postings={[posting(), posting({ id: "p2", title: "Researcher" })]} view="new" />);
    await user.click(screen.getByRole("button", { name: "Save Senior Product Designer" }));
    expect(setPostingStateAction).toHaveBeenCalledWith({ id: "p1", state: "SAVED" });
    expect(toast).toHaveBeenCalledWith("Done SAVED");
    expect(screen.queryByRole("link", { name: /Senior Product Designer/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Researcher/ })).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("keeps the posting and shows the reason when the server refuses", async () => {
    vi.mocked(setPostingStateAction).mockResolvedValueOnce({ ok: false, error: "That posting is no longer in the list." });
    const user = userEvent.setup();
    render(<ReviewList postings={[posting()]} view="new" />);
    await user.click(screen.getByRole("button", { name: "Dismiss Senior Product Designer" }));
    expect(toast).toHaveBeenCalledWith("That posting is no longer in the list.");
    expect(screen.getByRole("link", { name: /Senior Product Designer/ })).toBeInTheDocument();
  });

  it("says what an empty list means, differently for each view", () => {
    const { rerender } = render(<ReviewList postings={[]} view="new" />);
    expect(screen.getByText(/Nothing to review/i)).toBeInTheDocument();
    rerender(<ReviewList postings={[]} view="saved" />);
    expect(screen.getByText(/Nothing saved yet/i)).toBeInTheDocument();
    rerender(<ReviewList postings={[]} view="dismissed" />);
    expect(screen.getByText(/Nothing dismissed/i)).toBeInTheDocument();
  });
});
