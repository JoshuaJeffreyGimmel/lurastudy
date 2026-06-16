import React from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import KnowledgeBasesPage from "./pages/KnowledgeBasesPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import StudyPage from "./pages/StudyPage.jsx";
import { deleteDeck, listDecks } from "./api/client.js";

export default function App() {
  return (
    <div className="app-layout">
      <nav className="app-nav">
        <span className="brand">📚 LuraStudy</span>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/decks">My Decks</NavLink>
        <NavLink to="/knowledge-bases">Knowledge Bases</NavLink>
        <NavLink to="/settings" className="nav-settings">⚙ Settings</NavLink>
      </nav>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/decks" element={<DecksPage />} />
          <Route path="/knowledge-bases" element={<KnowledgeBasesPage />} />
          <Route path="/study/:deckId" element={<StudyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

// ─── Decks list page ──────────────────────────────────────────────────────────
function DecksPage() {
  const [decks, setDecks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    listDecks()
      .then((data) => setDecks(data.decks))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p><span className="spinner" />Loading decks…</p>;
  if (error) return <div className="banner banner-error">{error}</div>;
  if (!decks.length)
    return (
      <div className="banner banner-info">
        No decks yet. Upload a document on the Dashboard and generate flashcards!
      </div>
    );

  return (
    <div>
      <h1 style={{ marginBottom: "1.5rem", fontSize: "1.5rem" }}>My Flashcard Decks</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {decks.map((deck) => (
          <DeckRow
            key={deck.id}
            deck={deck}
            onDelete={() => setDecks((d) => d.filter((x) => x.id !== deck.id))}
          />
        ))}
      </div>
    </div>
  );
}

function DeckRow({ deck, onDelete }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete(e) {
    e.stopPropagation();
    if (!window.confirm(`Delete deck "${deck.title}"?`)) return;
    setDeleting(true);
    try {
      await deleteDeck(deck.id);
      onDelete();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
      }}
      onClick={() => navigate(`/study/${deck.id}`)}
    >
      <div>
        <div style={{ fontWeight: 600 }}>{deck.title}</div>
        <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
          {deck.card_count} cards · {new Date(deck.created_at).toLocaleDateString()}
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          className="btn-primary"
          style={{ fontSize: "0.85rem" }}
          onClick={(e) => { e.stopPropagation(); navigate(`/study/${deck.id}`); }}
        >
          Study
        </button>
        <button
          className="btn-danger"
          onClick={handleDelete}
          disabled={deleting}
          style={{ fontSize: "0.85rem" }}
        >
          {deleting ? "…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
