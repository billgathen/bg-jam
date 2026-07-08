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

export const emptyChart = () => ({
  A: { rows: [Array(8).fill("/"), Array(8).fill("/")] },
  B: { rows: [Array(8).fill("/"), Array(8).fill("/")] },
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
