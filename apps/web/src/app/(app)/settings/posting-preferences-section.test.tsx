import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/toast";
import { DEFAULT_SCAN_PREFERENCES } from "@/lib/settings";

import { saveScanPreferences } from "./actions";
import { PostingPreferencesSection } from "./posting-preferences-section";

vi.mock("./actions", () => ({ saveScanPreferences: vi.fn() }));
vi.mock("@/components/toast", () => {
  const toast = vi.fn();
  // As the real one does: a refusal is shown as a toast, and the result is passed on.
  return { toast, toastResult: (result: { ok: boolean; error?: string }) => (result.ok ? result : (toast(result.error), result)) };
});

beforeEach(() => {
  vi.mocked(saveScanPreferences).mockReset().mockImplementation(async (preferences) => ({ ok: true, data: { ...preferences, minSalary: preferences.minSalary }, toast: "Saved." }) as never);
  vi.mocked(toast).mockReset();
});

describe("PostingPreferencesSection", () => {
  it("starts from what is stored, with remote work as 'not sure' by default", () => {
    render(<PostingPreferencesSection initial={DEFAULT_SCAN_PREFERENCES} />);
    expect(screen.getByRole("heading", { name: "Posting preferences" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Not sure/ })).toBeChecked();
    expect(screen.getByLabelText("Lowest yearly pay")).toHaveValue(null);
    expect(screen.getByLabelText("Words to avoid")).toHaveValue("");
    expect(screen.getByLabelText("Companies to avoid")).toHaveValue("");
  });

  it("shows what was saved, one item per line", () => {
    render(<PostingPreferencesSection initial={{ remote: "no", minSalary: { amount: 60000, currency: "EUR" }, excludeKeywords: ["unpaid", "commission only"], excludeCompanies: ["Evil Corp"] }} />);
    expect(screen.getByRole("radio", { name: /^No,/ })).toBeChecked();
    expect(screen.getByLabelText("Lowest yearly pay")).toHaveValue(60000);
    expect(screen.getByLabelText("Currency")).toHaveValue("EUR");
    expect(screen.getByLabelText("Words to avoid")).toHaveValue("unpaid\ncommission only");
    expect(screen.getByLabelText("Companies to avoid")).toHaveValue("Evil Corp");
  });

  it("saves a remote-work choice at once, with everything else as it was", async () => {
    render(<PostingPreferencesSection initial={{ ...DEFAULT_SCAN_PREFERENCES, excludeKeywords: ["unpaid"] }} />);
    await userEvent.click(screen.getByRole("radio", { name: /^Yes/ }));
    expect(saveScanPreferences).toHaveBeenCalledWith({ remote: "yes", minSalary: null, excludeKeywords: ["unpaid"], excludeCompanies: [] });
  });

  it("saves the lists when you leave the field, trimmed, without blanks or repeats", async () => {
    render(<PostingPreferencesSection initial={DEFAULT_SCAN_PREFERENCES} />);
    await userEvent.type(screen.getByLabelText("Words to avoid"), "  unpaid  \n\nUnpaid\ncommission only");
    await userEvent.tab();
    expect(saveScanPreferences).toHaveBeenCalledWith({ remote: "unknown", minSalary: null, excludeKeywords: ["unpaid", "commission only"], excludeCompanies: [] });
  });

  it("saves the lowest pay with its currency, and clears it when emptied", async () => {
    render(<PostingPreferencesSection initial={DEFAULT_SCAN_PREFERENCES} />);
    await userEvent.type(screen.getByLabelText("Lowest yearly pay"), "55000");
    await userEvent.tab();
    expect(saveScanPreferences).not.toHaveBeenCalled(); // a currency is needed with an amount
    expect(screen.getByRole("alert")).toHaveTextContent(/currency/i);
    await userEvent.type(screen.getByLabelText("Currency"), "usd");
    await userEvent.tab();
    expect(saveScanPreferences).toHaveBeenLastCalledWith({ remote: "unknown", minSalary: { amount: 55000, currency: "USD" }, excludeKeywords: [], excludeCompanies: [] });
    await userEvent.clear(screen.getByLabelText("Lowest yearly pay"));
    await userEvent.tab();
    expect(saveScanPreferences).toHaveBeenLastCalledWith({ remote: "unknown", minSalary: null, excludeKeywords: [], excludeCompanies: [] });
  });

  it("refuses more than thirty lines and says so, saving nothing", async () => {
    render(<PostingPreferencesSection initial={DEFAULT_SCAN_PREFERENCES} />);
    const box = screen.getByLabelText("Words to avoid");
    await userEvent.click(box);
    await userEvent.paste(Array.from({ length: 31 }, (_, index) => `word ${index}`).join("\n"));
    await userEvent.tab();
    expect(saveScanPreferences).not.toHaveBeenCalled();
    expect(screen.getByText(/at most 30/i)).toBeInTheDocument();
  });

  it("says what the server said when it refuses", async () => {
    vi.mocked(saveScanPreferences).mockResolvedValueOnce({ ok: false, error: "Something went wrong." });
    render(<PostingPreferencesSection initial={DEFAULT_SCAN_PREFERENCES} />);
    await userEvent.click(screen.getByRole("radio", { name: /^No,/ }));
    expect(toast).toHaveBeenCalledWith("Something went wrong.");
  });
});
