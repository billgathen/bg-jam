import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import PartGrid from "./PartGrid.jsx";

function makePart() {
  return {
    rows: [
      ["1", "/", "/", "/", "5", "/", "/", "/"],
      ["1", "/", "/", "/", "5", "/", "/", "1"],
    ],
  };
}

describe("PartGrid", () => {
  it("renders the part label with no ending badges", () => {
    render(<PartGrid partName="A" part={makePart()} onChange={() => {}} />);
    expect(screen.getByText("A Part")).toBeInTheDocument();
    // Ending badges (circled 1 / 2) were removed from the header.
    expect(screen.queryByText("1", { selector: ".badge" })).toBeNull();
    expect(screen.queryByText("2", { selector: ".badge" })).toBeNull();
  });

  it("renders both ending rows as labeled groups", () => {
    render(<PartGrid partName="A" part={makePart()} onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "A Part, ending 1" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "A Part, ending 2" })).toBeInTheDocument();
  });

  it("marks measure-boundary cells but not the last cell in a row", () => {
    render(<PartGrid partName="A" part={makePart()} onChange={() => {}} />);
    const row1 = screen.getByRole("group", { name: "A Part, ending 1" });
    const cells = row1.querySelectorAll("button.cell");
    expect(cells).toHaveLength(8);
    // measure boundaries fall after beat 2 of each measure: indices 1, 3, 5
    [1, 3, 5].forEach((i) => expect(cells[i]).toHaveClass("measure-end"));
    [0, 2, 4, 6, 7].forEach((i) => expect(cells[i]).not.toHaveClass("measure-end"));
  });

  it("updates only the edited cell and preserves the rest of the chart", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const part = makePart();
    render(<PartGrid partName="A" part={part} onChange={onChange} />);

    const row2 = screen.getByRole("group", { name: "A Part, ending 2" });
    const cells = row2.querySelectorAll("button.cell");
    await user.click(cells[1]); // second cell of the second row, currently "/"
    await user.keyboard("4{Enter}");

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0];
    expect(updated.rows[1][1]).toBe("4");
    // everything else is untouched
    expect(updated.rows[0]).toEqual(part.rows[0]);
    expect(updated.rows[1].filter((_, i) => i !== 1)).toEqual(
      part.rows[1].filter((_, i) => i !== 1)
    );
  });
});
