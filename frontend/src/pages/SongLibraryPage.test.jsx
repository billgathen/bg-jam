import { MemoryRouter } from "react-router-dom";
import { ROUTER_FUTURE_FLAGS } from "../routerFuture.js";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteSong, exportMiniComic, listSongs } from "../api.js";
import SongLibraryPage from "./SongLibraryPage.jsx";

vi.mock("../api.js", () => ({
  listSongs: vi.fn(),
  deleteSong: vi.fn(),
  exportMiniComic: vi.fn(),
}));

const SONGS = [
  { id: 1, title: "Arkansas Traveler", updated_at: "2026-07-07T00:00:00Z" },
  { id: 2, title: "Billy in the Lowground", updated_at: "2026-07-07T00:00:00Z" },
  { id: 3, title: "Sailor's Hornpipe", updated_at: "2026-07-07T00:00:00Z" },
];

function renderPage() {
  return render(
    <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
      <SongLibraryPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listSongs.mockResolvedValue(SONGS);
  exportMiniComic.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
  // The export flow clicks a real <a href="blob:..."> to trigger a browser
  // download; jsdom doesn't implement that navigation, so stub it out.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

describe("SongLibraryPage", () => {
  it("lists all songs from the API", async () => {
    renderPage();
    for (const song of SONGS) {
      expect(await screen.findByText(song.title)).toBeInTheDocument();
    }
  });

  it("disables export until at least one song is selected", async () => {
    renderPage();
    await screen.findByText("Arkansas Traveler");
    expect(screen.getByRole("button", { name: /Export Mini-Comic/ })).toBeDisabled();
  });

  it("Select All checks every song and enables export with the right count", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Arkansas Traveler");

    await user.click(screen.getByRole("button", { name: "Select All" }));

    SONGS.forEach((song) => {
      expect(screen.getByLabelText(`Select ${song.title} for export`)).toBeChecked();
    });
    expect(screen.getByRole("button", { name: "Export Mini-Comic (3)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Deselect All" })).toBeInTheDocument();
  });

  it("Deselect All clears every checkbox", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Arkansas Traveler");

    await user.click(screen.getByRole("button", { name: "Select All" }));
    await user.click(screen.getByRole("button", { name: "Deselect All" }));

    SONGS.forEach((song) => {
      expect(screen.getByLabelText(`Select ${song.title} for export`)).not.toBeChecked();
    });
    expect(screen.getByRole("button", { name: /Export Mini-Comic/ })).toBeDisabled();
  });

  it("exports only the selected songs", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Arkansas Traveler");

    await user.click(screen.getByLabelText("Select Arkansas Traveler for export"));
    await user.click(screen.getByLabelText("Select Sailor's Hornpipe for export"));
    await user.click(screen.getByRole("button", { name: "Export Mini-Comic (2)" }));

    await waitFor(() => expect(exportMiniComic).toHaveBeenCalledWith([1, 3]));
  });

  it("deletes a song after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteSong.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText("Arkansas Traveler");

    const row = screen.getByText("Arkansas Traveler").closest("li");
    await user.click(within(row).getByRole("button", { name: "Delete Arkansas Traveler" }));

    expect(deleteSong).toHaveBeenCalledWith(1);
  });

  it("does not delete when confirmation is declined", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    await screen.findByText("Arkansas Traveler");

    const row = screen.getByText("Arkansas Traveler").closest("li");
    await user.click(within(row).getByRole("button", { name: "Delete Arkansas Traveler" }));

    expect(deleteSong).not.toHaveBeenCalled();
  });

  it("shows an empty state when there are no songs", async () => {
    listSongs.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/No songs yet/)).toBeInTheDocument();
  });
});
