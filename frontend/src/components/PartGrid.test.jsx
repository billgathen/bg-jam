import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import PartGrid from "./PartGrid.jsx";

function ControlledPartGrid({ initialPart }) {
  const [part, setPart] = useState(initialPart);
  return <PartGrid partName="A" part={part} onChange={setPart} />;
}

function makePart(bars = 8) {
  return {
    bars,
    rows: [Array(bars).fill("/"), Array(bars).fill("/")],
  };
}

describe("PartGrid", () => {
  it("renders a bold single-letter part label instead of 'A Part'", () => {
    render(<PartGrid partName="A" part={makePart()} onChange={() => {}} />);
    expect(screen.getByText("A", { selector: ".part-letter" })).toBeInTheDocument();
    expect(screen.queryByText("A Part")).toBeNull();
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
    const part = makePart(8); // 16 cells
    render(<PartGrid partName="A" part={part} onChange={() => {}} />);
    const row1 = screen.getByRole("group", { name: "A Part, ending 1" });
    const cells = row1.querySelectorAll("button.cell");
    const length = part.rows[0].length;
    expect(cells).toHaveLength(length);
    cells.forEach((cell, i) => {
      const isBoundary = i % 2 === 1 && i !== length - 1;
      expect(cell.classList.contains("measure-end")).toBe(isBoundary);
    });
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
    expect(updated.bars).toBe(part.bars);
    expect(updated.rows[1][1]).toBe("4");
    // everything else is untouched
    expect(updated.rows[0]).toEqual(part.rows[0]);
    expect(updated.rows[1].filter((_, i) => i !== 1)).toEqual(
      part.rows[1].filter((_, i) => i !== 1)
    );
  });

  describe("bars dropdown", () => {
    it("defaults to showing the part's current bar count", () => {
      render(<PartGrid partName="A" part={makePart(10)} onChange={() => {}} />);
      expect(screen.getByRole("combobox", { name: "Number of bars for A Part" })).toHaveValue("10");
    });

    it("offers exactly 8 through 12 bars as options", () => {
      render(<PartGrid partName="A" part={makePart()} onChange={() => {}} />);
      const select = screen.getByRole("combobox", { name: "Number of bars for A Part" });
      const values = [...select.options].map((o) => o.value);
      expect(values).toEqual(["8", "9", "10", "11", "12"]);
    });

    it("increasing bars pads existing rows with hold slashes at the end", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const part = makePart(8);
      part.rows[0][0] = "1"; // put a real chord in to confirm it's preserved
      render(<PartGrid partName="A" part={part} onChange={onChange} />);

      await user.selectOptions(
        screen.getByRole("combobox", { name: "Number of bars for A Part" }),
        "10"
      );

      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0];
      expect(updated.bars).toBe(10);
      expect(updated.rows[0]).toHaveLength(10);
      expect(updated.rows[1]).toHaveLength(10);
      expect(updated.rows[0].slice(0, 8)).toEqual(part.rows[0]);
      expect(updated.rows[0].slice(8)).toEqual(["/", "/"]);
    });

    it("decreasing bars truncates rows from the end", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const part = makePart(12);
      part.rows[0] = part.rows[0].map((_, i) => String((i % 7) + 1));
      render(<PartGrid partName="A" part={part} onChange={onChange} />);

      await user.selectOptions(
        screen.getByRole("combobox", { name: "Number of bars for A Part" }),
        "8"
      );

      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0];
      expect(updated.bars).toBe(8);
      expect(updated.rows[0]).toHaveLength(8);
      expect(updated.rows[0]).toEqual(part.rows[0].slice(0, 8));
    });

    it("selecting an odd bar count rounds both rows up to the next even cell count", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const part = makePart(8);
      render(<PartGrid partName="A" part={part} onChange={onChange} />);

      await user.selectOptions(
        screen.getByRole("combobox", { name: "Number of bars for A Part" }),
        "9"
      );

      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0];
      // 9 bars = 5 real bars on the 1st ending + 4 real + 1 completely
      // blank padding bar on the 2nd, so both rows render at the same
      // 10-cell width. The padding bar is "" (blank), not "/" (hold).
      expect(updated.bars).toBe(9);
      expect(updated.rows[0]).toHaveLength(10);
      expect(updated.rows[1]).toHaveLength(10);
      expect(updated.rows[0].slice(-2)).toEqual(["/", "/"]);
      expect(updated.rows[1].slice(-2)).toEqual(["", ""]);
    });

    it("switching from 9 to 10 replaces the blank padding bar with a real one", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const part = {
        bars: 9,
        rows: [Array(10).fill("/"), [...Array(8).fill("/"), "", ""]],
      };
      render(<PartGrid partName="A" part={part} onChange={onChange} />);

      await user.selectOptions(
        screen.getByRole("combobox", { name: "Number of bars for A Part" }),
        "10"
      );

      const updated = onChange.mock.calls[0][0];
      expect(updated.bars).toBe(10);
      expect(updated.rows[0]).toHaveLength(10);
      expect(updated.rows[1]).toHaveLength(10);
      expect(updated.rows[1]).not.toContain("");
    });

    it("switching 9 -> 11 -> 12 never leaves a stale or doubled-up blank bar", async () => {
      const user = userEvent.setup();
      const initialPart = {
        bars: 9,
        rows: [Array(10).fill("/"), [...Array(8).fill("/"), "", ""]],
      };
      render(<ControlledPartGrid initialPart={initialPart} />);
      const select = () => screen.getByRole("combobox", { name: "Number of bars for A Part" });

      await user.selectOptions(select(), "11");
      let row2 = screen.getByRole("group", { name: "A Part, ending 2" });
      expect(row2.children).toHaveLength(12);
      expect([...row2.children].filter((el) => el.classList.contains("cell-blank"))).toHaveLength(2);

      await user.selectOptions(select(), "12");
      row2 = screen.getByRole("group", { name: "A Part, ending 2" });
      expect(row2.children).toHaveLength(12);
      expect([...row2.children].filter((el) => el.classList.contains("cell-blank"))).toHaveLength(0);
    });
  });

  describe("blank padding cells", () => {
    it("renders as non-interactive, non-focusable divs rather than Cell buttons", () => {
      const part = {
        bars: 9,
        rows: [Array(10).fill("/"), [...Array(8).fill("/"), "", ""]],
      };
      render(<PartGrid partName="A" part={part} onChange={() => {}} />);
      const row2 = screen.getByRole("group", { name: "A Part, ending 2" });
      const lastTwo = [...row2.children].slice(-2);

      lastTwo.forEach((el) => {
        expect(el.tagName).toBe("DIV");
        expect(el).toHaveClass("cell-blank");
        expect(el).toHaveAttribute("aria-hidden", "true");
        expect(el).not.toHaveAttribute("tabindex");
        expect(el.querySelector("button")).toBeNull();
      });
    });

    it("is skipped by keyboard Tab navigation", async () => {
      const user = userEvent.setup();
      const part = {
        bars: 9,
        rows: [Array(10).fill("/"), [...Array(8).fill("/"), "", ""]],
      };
      render(
        <>
          <PartGrid partName="A" part={part} onChange={() => {}} />
          <button type="button">after</button>
        </>
      );
      const row2 = screen.getByRole("group", { name: "A Part, ending 2" });
      const realCells = row2.querySelectorAll("button.cell");

      // Focus the last real cell in row 2, then tabbing forward must skip
      // straight past the trailing blanks to the "after" button.
      await user.click(realCells[realCells.length - 1]);
      await user.tab();
      expect(screen.getByText("after")).toHaveFocus();
    });
  });
});
