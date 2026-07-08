import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App.jsx";

// A tiny in-memory fake standing in for the backend, so this test exercises
// the real component tree and real react-router navigation end to end
// instead of asserting on individually mocked call arguments.
vi.mock("./api.js", async () => {
  const actual = await vi.importActual("./api.js");
  let songs = [];
  let nextId = 1;

  return {
    ...actual,
    listSongs: vi.fn(async () =>
      songs.map(({ id, title, updated_at }) => ({ id, title, updated_at }))
    ),
    getSong: vi.fn(async (id) => songs.find((s) => String(s.id) === String(id))),
    createSong: vi.fn(async (song) => {
      const created = { id: nextId++, ...song, updated_at: new Date().toISOString() };
      songs.push(created);
      return created;
    }),
    updateSong: vi.fn(async (id, song) => {
      const idx = songs.findIndex((s) => String(s.id) === String(id));
      songs[idx] = { ...songs[idx], ...song, updated_at: new Date().toISOString() };
      return songs[idx];
    }),
    deleteSong: vi.fn(async (id) => {
      songs = songs.filter((s) => String(s.id) !== String(id));
    }),
    exportMiniComic: vi.fn(async () => new Blob(["pdf"], { type: "application/pdf" })),
    __reset: () => {
      songs = [];
      nextId = 1;
    },
  };
});

import * as api from "./api.js";

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.__reset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

describe("full CRUD workflow through real navigation, mouse clicks, and keyboard input", () => {
  it("creates, reads, updates, and deletes a song", async () => {
    const user = userEvent.setup();
    renderApp();

    // --- CREATE: library -> New Song -> type title -> click+type a chord -> Save
    expect(await screen.findByText(/No songs yet/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New Song" }));

    const titleInput = await screen.findByLabelText("Song title");
    await user.clear(titleInput);
    await user.type(titleInput, "Arkansas Traveler");

    const firstCell = screen.getByRole("button", { name: /A Part, ending 1, measure 1, beat 1/ });
    await user.click(firstCell);
    await user.keyboard("1{Enter}");
    expect(
      screen.getByRole("button", { name: /A Part, ending 1, measure 1, beat 1: 1\./ })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.createSong).toHaveBeenCalledTimes(1));

    // --- READ: back to the library, the new song is listed
    await user.click(screen.getByRole("button", { name: "← Library" }));
    expect(await screen.findByText("Arkansas Traveler")).toBeInTheDocument();

    // --- UPDATE: open it via the Edit link, change title + a cell, Save
    await user.click(screen.getByRole("link", { name: "Edit Arkansas Traveler" }));
    const editTitle = await screen.findByLabelText("Song title");
    expect(editTitle).toHaveValue("Arkansas Traveler");
    await user.clear(editTitle);
    await user.type(editTitle, "Arkansas Traveler (Renamed)");

    const cellToEdit = screen.getByRole("button", { name: /A Part, ending 1, measure 1, beat 1/ });
    await user.click(cellToEdit);
    await user.keyboard("6m{Enter}");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.updateSong).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");

    await user.click(screen.getByRole("button", { name: "← Library" }));
    expect(await screen.findByText("Arkansas Traveler (Renamed)")).toBeInTheDocument();
    expect(screen.queryByText("Arkansas Traveler", { exact: true })).toBeNull();

    // --- DELETE: confirm dialog -> gone from the list
    const row = screen.getByText("Arkansas Traveler (Renamed)").closest("li");
    await user.click(
      within(row).getByRole("button", { name: "Delete Arkansas Traveler (Renamed)" })
    );

    await waitFor(() => expect(api.deleteSong).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/No songs yet/)).toBeInTheDocument();
  });

  it("select-all, export, and cancel-without-saving also work end to end", async () => {
    const user = userEvent.setup();
    renderApp();

    // seed two songs through the real create flow
    for (const title of ["Song One", "Song Two"]) {
      await user.click(screen.getByRole("button", { name: "New Song" }));
      const titleInput = await screen.findByLabelText("Song title");
      await user.clear(titleInput);
      await user.type(titleInput, title);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await user.click(screen.getByRole("button", { name: "← Library" }));
      await screen.findByText(title);
    }

    // cancel-without-saving: opening a song and navigating away shouldn't call updateSong
    await user.click(screen.getByRole("link", { name: "Edit Song One" }));
    await screen.findByLabelText("Song title");
    await user.click(screen.getByRole("button", { name: "← Library" }));
    expect(api.updateSong).not.toHaveBeenCalled();

    // select all, export
    await user.click(screen.getByRole("button", { name: "Select All" }));
    await user.click(screen.getByRole("button", { name: "Export Mini-Comic (2)" }));

    await waitFor(() => expect(api.exportMiniComic).toHaveBeenCalledWith([1, 2]));
  });
});
