import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PartGrid from "../components/PartGrid.jsx";
import { createSong, emptyChart, getSong, updateSong } from "../api.js";

export default function SongEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [title, setTitle] = useState("Untitled Tune");
  const [chart, setChart] = useState(emptyChart());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNew) return;
    getSong(id)
      .then((song) => {
        setTitle(song.title);
        setChart(song.chart);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      if (isNew) {
        const song = await createSong({ title, chart });
        setStatus("Saved.");
        navigate(`/songs/${song.id}`, { replace: true });
      } else {
        await updateSong(id, { title, chart });
        setStatus("Saved.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page">Loading…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <button type="button" className="button" onClick={() => navigate("/")}>
          ← Library
        </button>
        <button type="button" className="button primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <label htmlFor="song-title" style={{ display: "none" }}>
        Song title
      </label>
      <input
        id="song-title"
        className="title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Song title"
      />

      {status && (
        <p className="status-message" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="status-message" role="alert" style={{ color: "#c0392b" }}>
          {error}
        </p>
      )}

      <PartGrid partName="A" part={chart.A} onChange={(next) => setChart((c) => ({ ...c, A: next }))} />
      <PartGrid partName="B" part={chart.B} onChange={(next) => setChart((c) => ({ ...c, B: next }))} />
    </div>
  );
}
