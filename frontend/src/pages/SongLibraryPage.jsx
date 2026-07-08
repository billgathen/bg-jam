import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteSong, exportMiniComic, listSongs } from "../api.js";

export default function SongLibraryPage() {
  const [songs, setSongs] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();

  const refresh = () => {
    setLoading(true);
    listSongs()
      .then(setSongs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = songs.length > 0 && selected.size === songs.length;
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(songs.map((s) => s.id)));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this song?")) return;
    await deleteSong(id);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    refresh();
  };

  const handleExport = async () => {
    setExporting(true);
    setError("");
    try {
      const blob = await exportMiniComic([...selected]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mini-comic.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Jam Songs</h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            className="button"
            disabled={selected.size === 0 || exporting}
            onClick={handleExport}
          >
            {exporting ? "Exporting…" : `Export Mini-Comic (${selected.size})`}
          </button>
          <button type="button" className="button primary" onClick={() => navigate("/songs/new")}>
            New Song
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" style={{ color: "#c0392b" }}>
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading…</p>
      ) : songs.length === 0 ? (
        <p>No songs yet. Create one to get started.</p>
      ) : (
        <>
          <button
            type="button"
            className="button"
            style={{ marginBottom: "0.75rem" }}
            onClick={toggleSelectAll}
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
          <ul className="library-list">
            {songs.map((song) => (
              <li key={song.id} className="library-item">
                <input
                  type="checkbox"
                  id={`select-${song.id}`}
                  checked={selected.has(song.id)}
                  onChange={() => toggle(song.id)}
                  aria-label={`Select ${song.title} for export`}
                />
                <label htmlFor={`select-${song.id}`}>
                  {song.title}
                  <span className="updated"> · updated {new Date(song.updated_at).toLocaleDateString()}</span>
                </label>
                <Link to={`/songs/${song.id}`} className="button" aria-label={`Edit ${song.title}`}>
                  Edit
                </Link>
                <button type="button" className="button" onClick={() => handleDelete(song.id)} aria-label={`Delete ${song.title}`}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
