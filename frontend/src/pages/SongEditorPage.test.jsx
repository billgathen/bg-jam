import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { ROUTER_FUTURE_FLAGS } from "../routerFuture.js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSong, getSong, updateSong } from "../api.js";
import SongEditorPage from "./SongEditorPage.jsx";

vi.mock("../api.js", async () => {
  const actual = await vi.importActual("../api.js");
  return {
    ...actual,
    createSong: vi.fn(),
    getSong: vi.fn(),
    updateSong: vi.fn(),
  };
});

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderEditor(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]} future={ROUTER_FUTURE_FLAGS}>
      <LocationDisplay />
      <Routes>
        <Route path="/" element={<div>Library Page</div>} />
        <Route path="/songs/new" element={<SongEditorPage />} />
        <Route path="/songs/:id" element={<SongEditorPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const SAVED_SONG = {
  id: 42,
  title: "Arkansas Traveler",
  chart: {
    A: { rows: [["1", "4", "5", "1", "5", "/", "/", "/"], ["1", "4", "5", "1", "/", "4", "5", "1"]] },
    B: { rows: [["1", "4", "1", "5", "1", "4", "1", "5"], ["1", "4", "1", "5", "1", "4", "5", "1"]] },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SongEditorPage — creating a new song", () => {
  it("starts with a default title and a blank chart of hold slashes", () => {
    renderEditor("/songs/new");
    expect(screen.getByLabelText("Song title")).toHaveValue("Untitled Tune");
    expect(screen.getAllByRole("button", { name: /hold\. Activate to edit\./ })).toHaveLength(32);
  });

  it("lets the user type a title and edit a cell with mouse + keyboard, then save", async () => {
    const user = userEvent.setup();
    createSong.mockResolvedValue(SAVED_SONG);
    // After creating, the page navigates to /songs/42 and re-fetches by id.
    getSong.mockResolvedValue(SAVED_SONG);
    renderEditor("/songs/new");

    const titleInput = screen.getByLabelText("Song title");
    await user.clear(titleInput);
    await user.type(titleInput, "My New Tune");

    const firstCell = screen.getByRole("button", { name: /A Part, ending 1, measure 1, beat 1/ });
    await user.click(firstCell);
    await user.keyboard("1{Enter}");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createSong).toHaveBeenCalledTimes(1));
    const payload = createSong.mock.calls[0][0];
    expect(payload.title).toBe("My New Tune");
    expect(payload.chart.A.rows[0][0]).toBe("1");

    // On success it navigates to the newly created song's own URL.
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/songs/42"));
  });

  it("shows an error and stays on the page if saving fails", async () => {
    const user = userEvent.setup();
    createSong.mockRejectedValue(new Error("500: boom"));
    renderEditor("/songs/new");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("500: boom");
    expect(screen.getByTestId("location")).toHaveTextContent("/songs/new");
  });

  it("navigates back to the library without saving", async () => {
    const user = userEvent.setup();
    renderEditor("/songs/new");

    await user.click(screen.getByRole("button", { name: "← Library" }));

    expect(await screen.findByText("Library Page")).toBeInTheDocument();
    expect(createSong).not.toHaveBeenCalled();
  });
});

describe("SongEditorPage — editing an existing song", () => {
  it("loads the song and displays its title and chart", async () => {
    getSong.mockResolvedValue(SAVED_SONG);
    renderEditor("/songs/42");

    expect(await screen.findByLabelText("Song title")).toHaveValue("Arkansas Traveler");
    expect(getSong).toHaveBeenCalledWith("42");
    expect(
      screen.getByRole("button", { name: /A Part, ending 1, measure 1, beat 1: 1\./ })
    ).toBeInTheDocument();
  });

  it("saves edits made via keyboard and mouse", async () => {
    const user = userEvent.setup();
    getSong.mockResolvedValue(SAVED_SONG);
    updateSong.mockResolvedValue({ ...SAVED_SONG, title: "Renamed" });
    renderEditor("/songs/42");

    const titleInput = await screen.findByLabelText("Song title");
    await user.clear(titleInput);
    await user.type(titleInput, "Renamed");

    const cell = screen.getByRole("button", { name: /A Part, ending 1, measure 1, beat 1/ });
    await user.click(cell);
    await user.keyboard("6m{Enter}");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateSong).toHaveBeenCalledTimes(1));
    expect(updateSong).toHaveBeenCalledWith("42", expect.objectContaining({ title: "Renamed" }));
    expect(updateSong.mock.calls[0][1].chart.A.rows[0][0]).toBe("6m");
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
  });

  it("shows a load error if the song can't be fetched", async () => {
    getSong.mockRejectedValue(new Error("404: not found"));
    renderEditor("/songs/999");

    expect(await screen.findByRole("alert")).toHaveTextContent("404: not found");
  });
});
