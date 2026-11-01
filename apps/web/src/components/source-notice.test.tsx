import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SourceNotice } from "./source-notice";

describe("SourceNotice", () => {
  it("names the licence and links to the source of this version", () => {
    render(<SourceNotice sourceUrl="https://github.com/utkarshpophli/CareerPilot/tree/abc1234" commit="abc1234" />);
    expect(screen.getByText(/GNU Affero General Public License/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Source code/ });
    expect(link).toHaveAttribute("href", "https://github.com/utkarshpophli/CareerPilot/tree/abc1234");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByText(/abc1234/)).toBeInTheDocument();
  });

  it("works without a known commit", () => {
    render(<SourceNotice sourceUrl="https://github.com/utkarshpophli/CareerPilot" commit={null} />);
    expect(screen.getByRole("link", { name: /Source code/ })).toHaveAttribute("href", "https://github.com/utkarshpophli/CareerPilot");
    expect(screen.queryByText(/version built from/)).not.toBeInTheDocument();
  });
});
