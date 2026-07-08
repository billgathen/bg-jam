import { Routes, Route } from "react-router-dom";
import SongLibraryPage from "./pages/SongLibraryPage.jsx";
import SongEditorPage from "./pages/SongEditorPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SongLibraryPage />} />
      <Route path="/songs/new" element={<SongEditorPage />} />
      <Route path="/songs/:id" element={<SongEditorPage />} />
    </Routes>
  );
}
