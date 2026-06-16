import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDeck, deleteDeck, listDecks } from "../api/client.js";
import "./DecksPage.css";

export default function DecksPage() {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const fetchDecks = useCallback(() => {
    return listDecks()
      .then((data) => setDecks(data.decks))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetchDecks().finally(() => setLoading(false));
  }, [fetchDecks]);

  function handleCreated(deck) {
    navigate(`/decks/${deck.id}`);
  }

  async function handleDelete(e, deck) {
    e.stopPropagation();
    if (!window.confirm(`Delete deck "${deck.title}"? This cannot be undone.`)) return;
    try {
      await deleteDeck(deck.id);
      setDecks((prev) => prev.filter((d) => d.id !== deck.id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="decks-page">
      <div className="decks-page-header">
        <div>
          <h1>My Decks</h1>
          <p className="subtitle">Each deck is a workspace for studying a topic — add sources, chat with AI, and generate flashcards.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          ✨ New Deck
        </button>
      </div>

      {error && (
        <div className="banner banner-error" onClick={() => setError(null)} style={{ cursor: "pointer" }}>
          ⚠ {error} <span style={{ float: "right", opacity: 0.6 }}>✕</span>
        </div>
      )}

      {showCreate && (
        <CreateDeckModal
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}

      {loading ? (
        <p><span className="spinner" />Loading decks…</p>
      ) : decks.length === 0 ? (
        <div className="decks-empty">
          <div className="decks-empty-icon">📚</div>
          <h2>No decks yet</h2>
          <p>Create your first deck to start studying. Add documents, chat with AI, and generate flashcards.</p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            ✨ Create Your First Deck
          </button>
        </div>
      ) : (
        <div className="decks-grid">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onClick={() => navigate(`/decks/${deck.id}`)}
              onDelete={(e) => handleDelete(e, deck)}
            />
          ))}
          <div
            className="deck-card-new card"
            onClick={() => setShowCreate(true)}
          >
            <div className="deck-card-new-inner">
              <span className="deck-card-new-icon">+</span>
              <span>New Deck</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Deck Card ────────────────────────────────────────────────────────────────

function DeckCard({ deck, onClick, onDelete }) {
  const updatedDate = new Date(deck.updated_at).toLocaleDateString();

  return (
    <div className="deck-card card" onClick={onClick}>
      <div className="deck-card-top">
        <div className="deck-card-icon">📖</div>
        <button
          className="deck-card-delete"
          onClick={onDelete}
          title="Delete deck"
        >
          ✕
        </button>
      </div>
      <div className="deck-card-title">{deck.title}</div>
      {deck.description && (
        <div className="deck-card-desc">{deck.description}</div>
      )}
      <div className="deck-card-footer">
        <div className="deck-card-stats">
          <span className="deck-stat">
            <span className="deck-stat-icon">📄</span>
            {deck.source_count} source{deck.source_count !== 1 ? "s" : ""}
          </span>
          <span className="deck-stat">
            <span className="deck-stat-icon">🃏</span>
            {deck.card_count} card{deck.card_count !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="deck-card-date">{updatedDate}</div>
      </div>
    </div>
  );
}

// ─── Create Deck Modal ────────────────────────────────────────────────────────

function CreateDeckModal({ onCreated, onClose }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const deck = await createDeck({ title: title.trim(), description: description.trim() || undefined });
      onCreated(deck);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✨ New Deck</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="banner banner-error" style={{ margin: "0 1.5rem" }}>{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="form-label">
            Deck Name
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Biology Exam, Chapter 5 Review…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </label>

          <label className="form-label">
            Description <span className="form-hint">(optional)</span>
            <input
              className="form-input"
              type="text"
              placeholder="What is this deck for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving || !title.trim()}>
              {saving ? <><span className="spinner" />Creating…</> : "Create Deck"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
