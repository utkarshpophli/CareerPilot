import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Unit } from "@/lib/application-data";

import { AtsNotice } from "./ats-notice";

const unit = (id: string, text: string): Unit => ({ id, label: id, text });

describe("the ATS notice", () => {
  it("shows nothing for a clean resume", () => {
    render(<AtsNotice units={[unit("summary", "Plain text.")]} onFix={vi.fn()} busy={false} />);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("lists what it found and offers to fix the characters it can", async () => {
    const onFix = vi.fn();
    render(<AtsNotice units={[unit("summary", "A — B — C"), unit("experience:1", "“q”")]} onFix={onFix} busy={false} />);
    const note = screen.getByRole("note", { name: "ATS check" });
    expect(note).toHaveTextContent("2 long dashes (—)");
    expect(note).toHaveTextContent("2 curly double quotes");
    await userEvent.click(screen.getByRole("button", { name: "Make ATS-safe" }));
    expect(onFix).toHaveBeenCalledTimes(1);
  });

  it("disables the button while it works", () => {
    render(<AtsNotice units={[unit("summary", "A — B")]} onFix={vi.fn()} busy />);
    expect(screen.getByRole("button", { name: "Make ATS-safe" })).toBeDisabled();
  });

  it("only notes what the owner has to shorten, with no button", () => {
    render(<AtsNotice units={[unit("experience:1", "x ".repeat(200))]} onFix={vi.fn()} busy={false} />);
    expect(screen.getByRole("note")).toHaveTextContent("yours to shorten");
    expect(screen.queryByRole("button", { name: "Make ATS-safe" })).toBeNull();
  });
});
