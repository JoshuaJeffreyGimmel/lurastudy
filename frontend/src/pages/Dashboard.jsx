import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createDeck,
  deleteDocument,
  listDecks,
  listDocuments,
  uploadDocument,
} from "../api/client.js";
import UploadZone from "../components/UploadZone.jsx";
import "./Dashboard.css";

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showNewDeck, setShowNewDeck] = useState(false);
  const navigate = useNavigate();

  const fetchData = useCallback(() => {
    return Promise.all([listDocuments(), listDecks()])
      .then(([docsData, decksData]) => {
        setDocuments(docsData.documents.slice(0, 5));
        setDecks(decksData.decks.slice(0, 4));
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  async function handleUpload(file) {
    setUploading(true);
    setError(null);
    try {
      const doc = await uploadDocument(file);
      setDocuments((prev) => [doc, ...prev].slice(0, 5));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDoc(doc) {
    if (!window.confirm(`Delete "${doc.original_filename}"?`)) return;
    try {
      await deleteDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="dashboard">
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <div className="dashboard-hero">
        <div className="hero-text">
          <h1>Welcome to LuraStudy</h1>
          <p className="subtitle">
            Your AI-powered study workspace. Create decks, upload documents, and let AI generate flashcards for you.
          </p>
        </div>
        <div className="hero-actions">
          <button className="btn-primary hero-btn" onClick={() => setShowNewDeck(true)}>
            ✨ New Deck
          </button>
          <button className="btn-secondary hero-btn" onClick={() => navigate("/decks")}>
            📚 My Decks
          </button>
        </div>
      </div>

      {error && (
        <div className="banner banner-error" onClick={() => setError(null)} style={{ cursor: "pointer" }}>
          ⚠ {error} <span style={{ float: "right", opacity: 0.6 }}>✕</span>
        </div>
      )}

      {showNewDeck && (
        <NewDeckModal
          onClose={() => setShowNewDeck(false)}
          onCreated={(deck) => navigate(`/decks/${deck.id}`)}
        />
      )}

      {/* ─── Quick Upload ──────────────────────────────────────────────────── */}
      <section className="upload-section card">
        <h2>Quick Upload</h2>
        <p className="section-subtitle">Upload a document to your library, then add it to a deck.</p>
        <UploadZone onUpload={handleUpload} uploading={uploading} />
      </section>

      {/* ─── Recent Decks ─────────────────────────────────────────────────── */}
      <section className="dashboard-section">
        <div className="section-header">
          <h2>Recent Decks</h2>
          <button className="btn-secondary btn-sm-text" onClick={() => navigate("/decks")}>
            View all →
          </button>
        </div>
        {loading ? (
          <p><span className="spinner" />Loading…</p>
        ) : decks.length === 0 ? (
          <div className="banner banner-info">
            No decks yet. Click "✨ New Deck" to create your first study workspace.
          </div>
        ) : (
          <div className="deck-grid">
            {decks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onClick={() => navigate(`/decks/${deck.id}`)}
              />
            ))}
            <div
              className="deck-card deck-card-new card"
              onClick={() => setShowNewDeck(true)}
            >
              <div className="deck-card-new-inner">
                <span className="deck-card-new-icon">+</span>
                <span>New Deck</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ─── Recent Documents ─────────────────────────────────────────────── */}
      <section className="dashboard-section">
        <div className="section-header">
          <h2>Recent Documents</h2>
        </div>
        {loading ? (
          <p><span className="spinner" />Loading…</p>
        ) : documents.length === 0 ? (
          <div className="banner banner-info">
            No documents yet. Upload a PDF, TXT, or Markdown file above.
          </div>
        ) : (
          <div className="document-list">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onDelete={() => handleDeleteDoc(doc)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Deck Card ────────────────────────────────────────────────────────────────

function DeckCard({ deck, onClick }) {
  return (
    <div className="deck-card card" onClick={onClick} style={{ cursor: "pointer" }}>
      <div className="deck-card-icon">📖</div>
      <div className="deck-card-title">{deck.title}</div>
      {deck.description && (
        <div className="deck-card-desc">{deck.description}</div>
      )}
      <div className="deck-card-meta">
        <span>{deck.source_count} source{deck.source_count !== 1 ? "s" : ""}</span>
        <span>·</span>
        <span>{deck.card_count} card{deck.card_count !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

// ─── New Deck Modal ───────────────────────────────────────────────────────────

function NewDeckModal({ onClose, onCreated }) {
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
    } catch (e) {
      setError(e.message);
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

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({ doc, onDelete }) {
  const statusClass = {
    ready: "badge-ready",
    processing: "badge-processing",
    error: "badge-error",
  }[doc.status] || "badge-processing";

  const fileSizeLabel = doc.file_size < 1024 * 1024
    ? `${(doc.file_size / 1024).toFixed(1)} KB`
    : `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="document-row card">
      <div className="doc-info">
        <div className="doc-name">{doc.original_filename}</div>
        <div className="doc-meta">
          <span className={`badge ${statusClass}`}>{doc.status}</span>
          <span className="doc-size">{fileSizeLabel}</span>
          <span className="doc-date">{new Date(doc.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="doc-actions">
        <button className="btn-danger" onClick={onDelete} style={{ fontSize: "0.85rem" }}>
          Delete
        </button>
      </div>
    </div>
  );
}
