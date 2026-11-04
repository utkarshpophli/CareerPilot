import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/toast";
import type { CompanyListItem } from "@/lib/services/companies";

import { addCompanyAction, removeCompanyAction, scanNowAction, setCompanyEnabledAction } from "./companies-actions";
import { CompaniesSection } from "./companies-section";

vi.mock("./companies-actions", () => ({ addCompanyAction: vi.fn(), setCompanyEnabledAction: vi.fn(), removeCompanyAction: vi.fn(), scanNowAction: vi.fn() }));
vi.mock("@/components/toast", () => {
  const toast = vi.fn();
  return { toast, toastResult: (result: { ok: boolean; error?: string; toast?: string }) => (result.ok ? (result.toast && toast(result.toast), result) : (toast(result.error), result)) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/settings", useSearchParams: () => new URLSearchParams() }));

const company = (extra: Partial<CompanyListItem> = {}): CompanyListItem => ({
  id: "c1",
  source: "GREENHOUSE",
  slug: "acme",
  region: "",
  name: "Acme",
  enabled: true,
  lastScanAt: "2026-11-02T09:00:00.000Z",
  lastOkAt: "2026-11-02T09:00:00.000Z",
  lastError: "",
  lastFound: 12,
  ...extra,
});

beforeEach(() => {
  vi.mocked(toast).mockReset();
  vi.mocked(addCompanyAction).mockReset().mockImplementation(async (input) => ({ ok: true, data: company({ id: "c9", name: input.name || input.board, slug: input.board, lastScanAt: null, lastOkAt: null, lastFound: 0 }), toast: "Now watching." }));
  vi.mocked(setCompanyEnabledAction).mockReset().mockImplementation(async ({ id, enabled }) => ({ ok: true, data: { id, enabled }, toast: "Done." }));
  vi.mocked(removeCompanyAction).mockReset().mockImplementation(async ({ id }) => ({ ok: true, data: { id }, toast: "Removed." }));
  vi.mocked(scanNowAction).mockReset();
});

describe("CompaniesSection", () => {
  it("lists each company with its source, board and how the last scan went", () => {
    render(
      <CompaniesSection
        initial={[company(), company({ id: "c2", name: "Gone", slug: "gone", lastOkAt: null, lastError: "The source has no such board. Check the name.", lastFound: 0 }), company({ id: "c3", name: "Paused", slug: "paused", enabled: false }), company({ id: "c4", name: "Fresh", slug: "fresh", lastScanAt: null, lastOkAt: null, lastFound: 0 })]}
      />,
    );
    const rows = within(screen.getByRole("list", { name: "Watched companies" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Acme");
    expect(rows[0]).toHaveTextContent("Greenhouse · acme");
    expect(rows[0]).toHaveTextContent("12 postings");
    // Listed by name: Acme, Fresh, Gone, Paused.
    expect(rows[1]).toHaveTextContent("Not read yet");
    expect(rows[2]).toHaveTextContent("Could not be read: The source has no such board. Check the name.");
    expect(rows[3]).toHaveTextContent("Paused");
  });

  it("says what an empty list means", () => {
    render(<CompaniesSection initial={[]} />);
    expect(screen.getByText(/No companies are watched yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Scan now" })).toBeDisabled();
  });

  it("adds a company from a careers link and shows it at once", async () => {
    render(<CompaniesSection initial={[]} />);
    await userEvent.type(screen.getByLabelText("Job board name or careers link"), "https://job-boards.greenhouse.io/stripe");
    await userEvent.click(screen.getByRole("button", { name: "Watch" }));
    expect(addCompanyAction).toHaveBeenCalledWith({ board: "https://job-boards.greenhouse.io/stripe" });
    expect(await screen.findByText("Greenhouse · https://job-boards.greenhouse.io/stripe")).toBeInTheDocument();
  });

  it("sends the source and name when they are given, and shows the server's reason when it refuses", async () => {
    vi.mocked(addCompanyAction).mockResolvedValueOnce({ ok: false, error: "Say which source it is on (GREENHOUSE, LEVER, ASHBY, WORKABLE, RECRUITEE, TEAMTAILOR), or paste the company's own careers address." });
    render(<CompaniesSection initial={[]} />);
    await userEvent.type(screen.getByLabelText("Job board name or careers link"), "stripe");
    await userEvent.click(screen.getByRole("button", { name: "Watch" }));
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/which source/i));
    await userEvent.selectOptions(screen.getByLabelText("Source"), "LEVER");
    await userEvent.type(screen.getByLabelText("Name (optional)"), "Stripe");
    await userEvent.click(screen.getByRole("button", { name: "Watch" }));
    expect(addCompanyAction).toHaveBeenLastCalledWith({ board: "stripe", source: "LEVER", name: "Stripe" });
  });

  it("pauses and resumes a company, and names it in the button", async () => {
    render(<CompaniesSection initial={[company()]} />);
    await userEvent.click(screen.getByRole("button", { name: "Pause Acme" }));
    expect(setCompanyEnabledAction).toHaveBeenCalledWith({ id: "c1", enabled: false });
    expect(screen.getByRole("listitem", { name: undefined })).toHaveTextContent("Paused");
    await userEvent.click(screen.getByRole("button", { name: "Resume Acme" }));
    expect(setCompanyEnabledAction).toHaveBeenLastCalledWith({ id: "c1", enabled: true });
  });

  it("asks before removing, and says that saved postings stay", async () => {
    render(<CompaniesSection initial={[company()]} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Acme" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/saved postings stay/i);
    expect(removeCompanyAction).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove company" }));
    expect(removeCompanyAction).toHaveBeenCalledWith({ id: "c1" });
    expect(screen.queryByText("Acme")).toBeNull();
  });

  it("scans now, shows what was found and how each board went, and links to the Review page", async () => {
    vi.mocked(scanNowAction).mockResolvedValueOnce({ ok: true, data: { scanned: 1, added: 4, closed: 1, failed: 0, skipped: 0, companies: [company({ lastFound: 20 })] }, toast: "Scanned 1 board: 4 new, 1 closed." });
    render(<CompaniesSection initial={[company()]} />);
    await userEvent.click(screen.getByRole("button", { name: "Scan now" }));
    expect(await screen.findByText(/4 new, 1 closed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the Review page" })).toHaveAttribute("href", "/review");
    expect(screen.getByText(/20 postings/)).toBeInTheDocument();
  });

  it("shows the reason when a scan cannot run", async () => {
    vi.mocked(scanNowAction).mockResolvedValueOnce({ ok: false, error: "Something went wrong." });
    render(<CompaniesSection initial={[company()]} />);
    await userEvent.click(screen.getByRole("button", { name: "Scan now" }));
    expect(toast).toHaveBeenCalledWith("Something went wrong.");
  });
});
