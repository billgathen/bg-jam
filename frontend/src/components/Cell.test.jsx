import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import Cell from "./Cell.jsx";

const LABEL = "A Part, ending 1, measure 1, beat 1";

describe("Cell display (not editing)", () => {
  it("renders a plain digit token", () => {
    render(<Cell token="5" label={LABEL} onChange={() => {}} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAccessibleName(`${LABEL}: 5. Activate to edit.`);
    expect(button.querySelector(".suffix-raised")).toBeNull();
    expect(button.querySelector(".suffix-flat")).toBeNull();
  });

  it("renders a hold slash", () => {
    render(<Cell token="/" label={LABEL} onChange={() => {}} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAccessibleName(`${LABEL}: hold. Activate to edit.`);
    expect(button.querySelector(".slash")).not.toBeNull();
  });

  it("renders a dominant-seventh suffix raised (superscript)", () => {
    render(<Cell token="27" label={LABEL} onChange={() => {}} />);
    const suffix = screen.getByRole("button").querySelector(".suffix-raised");
    expect(suffix).not.toBeNull();
    expect(suffix.textContent).toBe("7");
  });

  it("renders a minor suffix flat (smaller baseline text)", () => {
    render(<Cell token="6m" label={LABEL} onChange={() => {}} />);
    const suffix = screen.getByRole("button").querySelector(".suffix-flat");
    expect(suffix).not.toBeNull();
    expect(suffix.textContent).toBe("m");
  });

  it("applies the measure-end class when requested", () => {
    render(<Cell token="1" label={LABEL} onChange={() => {}} measureEnd />);
    expect(screen.getByRole("button")).toHaveClass("measure-end");
  });
});

describe("Cell editing", () => {
  it("enters edit mode with the existing value selected on click", async () => {
    const user = userEvent.setup();
    render(<Cell token="1" label={LABEL} onChange={() => {}} />);

    await user.click(screen.getByRole("button"));

    const input = screen.getByLabelText(LABEL);
    expect(input).toHaveValue("1");
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(1);
  });

  it("typing over the selection replaces rather than appends", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cell token="1" label={LABEL} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.keyboard("6m");
    expect(screen.getByLabelText(LABEL)).toHaveValue("6m");
  });

  it("commits a valid token on Enter and exits edit mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cell token="1" label={LABEL} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.keyboard("6m{Enter}");

    expect(onChange).toHaveBeenCalledWith("6m");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("commits a valid token on blur (Tab)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cell token="1" label={LABEL} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.keyboard("5");
    fireEvent.blur(screen.getByLabelText(LABEL));

    expect(onChange).toHaveBeenCalledWith("5");
  });

  it("clearing the value and committing turns it into a hold slash", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cell token="1" label={LABEL} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    const input = screen.getByLabelText(LABEL);
    await user.clear(input);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("/");
  });

  it("keeps invalid input visible instead of discarding it on Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cell token="1" label={LABEL} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    const input = screen.getByLabelText(LABEL);
    await user.clear(input);
    await user.keyboard("Am{Enter}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText(LABEL)).toHaveValue("Am");
    expect(screen.getByLabelText(LABEL)).toHaveClass("invalid");
    expect(screen.getByLabelText(LABEL)).toHaveAttribute("aria-invalid", "true");
  });

  it("blocks Tab from leaving an invalid cell", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cell token="1" label={LABEL} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    const input = screen.getByLabelText(LABEL);
    await user.clear(input);
    await user.keyboard("Am");

    const tabEvent = fireEvent.keyDown(input, { key: "Tab" });
    expect(tabEvent).toBe(false); // fireEvent returns false when preventDefault() was called
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Escape cancels editing without committing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cell token="1" label={LABEL} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.keyboard("6m{Escape}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button")).toHaveAccessibleName(`${LABEL}: 1. Activate to edit.`);
  });
});
