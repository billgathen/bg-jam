const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res;
}

export const DEFAULT_BARS = 8;
export const BAR_OPTIONS = [8, 9, 10, 11, 12];

// `bars` is the combined total across both ending rows, split as evenly as
// possible (e.g. 9 -> 5 on the 1st ending, 4 + a blank padding bar on the
// 2nd, so both rows render at the same width). An odd count therefore
// rounds up to the next even cell count, applied uniformly to both rows.
export function cellsForBars(bars) {
  return bars + (bars % 2);
}

const emptyPart = (bars = DEFAULT_BARS) => {
  const length = cellsForBars(bars);
  return { bars, rows: [Array(length).fill("/"), Array(length).fill("/")] };
};

export const emptyChart = () => ({
  A: emptyPart(),
  B: emptyPart(),
});

export async function listSongs() {
  const res = await request("/api/songs");
  return res.json();
}

export async function getSong(id) {
  const res = await request(`/api/songs/${id}`);
  return res.json();
}

export async function createSong(song) {
  const res = await request("/api/songs", {
    method: "POST",
    body: JSON.stringify(song),
  });
  return res.json();
}

export async function updateSong(id, song) {
  const res = await request(`/api/songs/${id}`, {
    method: "PUT",
    body: JSON.stringify(song),
  });
  return res.json();
}

export async function deleteSong(id) {
  await request(`/api/songs/${id}`, { method: "DELETE" });
}

export async function exportMiniComic(songIds) {
  const res = await request("/api/export/mini-comic", {
    method: "POST",
    body: JSON.stringify({ song_ids: songIds }),
  });
  return res.blob();
}
