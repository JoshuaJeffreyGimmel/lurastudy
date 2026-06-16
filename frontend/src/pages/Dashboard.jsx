import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteDocument,
  generateFlashcards,
  listDocuments,
  listKnowledgeBases,
  uploadDocument,
} from "../api/client.js";
import UploadZone from "../components/UploadZone.jsx";
import "./Dashboard.css";

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [showNewDeck, setShowNewDeck] = useState(false);
  const navigate = useNavigate();

  const fetchDocuments = useCallback(() => {
    return listDocuments()
      .then((data) => setDocuments(data.documents))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetchDocuments().finally(() => setLoading(false));
  }, [fetchDocuments]);

  async function handleUpload(file) {
    setUploading(true);
    setError(null);
    try {
      const doc = await uploadDocument(file);
      setDocuments((prev) => [doc, ...prev]);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate(doc) {
    setGeneratingId(doc.id);
    setError(null);
    try {
      const deck = await generateFlashcards({ documentId: doc.id, maxCards: 20 });
      navigate(`/study/${deck.id}`);
    } catch (e) {
      setError(e.message);
      setGeneratingId(null);
    }
  }

  async function handleDelete(doc) {
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
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Upload study materials and generate AI flashcards instantly.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNewDeck(true)}>
          ✨ New Deck
        </button>
      </div>

      {error && (
        <div className="banner banner-error" onClick={() => setError(null)} style={{ cursor: "pointer" }}>
          ⚠ {error} <span style={{ float: "right", opacity: 0.6 }}>✕</span>
        </div>
      )}

      {showNewDeck && (
        <NewDeckModal
          onClose={() => setShowNewDeck(false)}
          onCreated={(deck) => navigate(`/study/${deck.id}`)}
        />
      )}

      <section className="upload-section card">
        <h2>Upload Document</h2>
        <UploadZone onUpload={handleUpload} uploading={uploading} />
      </section>

      <section className="documents-section">
        <h2>Your Documents</h2>
        {loading ? (
          <p><span className="spinner" />Loading…</p>
        ) : documents.length === 0 ? (
          <div className="banner banner-info">
            No documents yet. Upload a PDF, TXT, or Markdown file above to get started.
          </div>
        ) : (
          <div className="document-list">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                generating={generatingId === doc.id}
                onGenerate={() => handleGenerate(doc)}
                onDelete={() => handleDelete(doc)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── New Deck Modal ───────────────────────────────────────────────────────────

function NewDeckModal({ onClose, onCreated }) {
  const [sourceType, setSourceType] = useState("document"); // "document" | "knowledge_base"
  const [documents, setDocuments] = useState([]);
  const [kbs, setKbs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [selectedKbId, setSelectedKbId] = useState("");
  const [maxCards, setMaxCards] = useState(20);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    Promise.all([listDocuments(), listKnowledgeBases()])
      .then(([docsData, kbsData]) => {
        const readyDocs = docsData.documents.filter((d) => d.status === "ready");
        setDocuments(readyDocs);
        setKbs(kbsData.knowledge_bases);
        if (readyDocs.length > 0) setSelectedDocId(readyDocs[0].id);
        if (kbsData.knowledge_bases.length > 0) setSelectedKbId(kbsData.knowledge_bases[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingOptions(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const params = { maxCards: Number(maxCards) };
      if (sourceType === "document") {
        params.documentId = selectedDocId;
      } else {
        params.knowledgeBaseId = selectedKbId;
      }
      const deck = await generateFlashcards(params);
      onCreated(deck);
    } catch (e) {
      setError(e.message);
      setGenerating(false);
    }
  }

  const canSubmit =
    !generating &&
    !loadingOptions &&
    ((sourceType === "document" && selectedDocId) ||
      (sourceType === "knowledge_base" && selectedKbId));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✨ New Flashcard Deck</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="banner banner-error" style={{ margin: "0 1.5rem" }}>{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Source type toggle */}
          <div className="form-label">
            Source
            <div className="source-toggle">
              <button
                type="button"
                className={`source-toggle-btn ${sourceType === "document" ? "active" : ""}`}
                onClick={() => setSourceType("document")}
              >
                📄 Single Document
              </button>
              <button
                type="button"
                className={`source-toggle-btn ${sourceType === "knowledge_base" ? "active" : ""}`}
                onClick={() => setSourceType("knowledge_base")}
              >
                🗂 Knowledge Base
              </button>
            </div>
          </div>

          {/* Document selector */}
          {sourceType === "document" && (
            <div className="form-label">
              Document
              {loadingOptions ? (
                <p className="form-hint"><span className="spinner" />Loading…</p>
              ) : documents.length === 0 ? (
                <p className="form-hint">No ready documents. Upload and process a document first.</p>
              ) : (
                <select
                  className="form-input"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  required
                >
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.original_filename}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Knowledge Base selector */}
          {sourceType === "knowledge_base" && (
            <div className="form-label">
              Knowledge Base
              {loadingOptions ? (
                <p className="form-hint"><span className="spinner" />Loading…</p>
              ) : kbs.length === 0 ? (
                <p className="form-hint">
                  No knowledge bases yet.{" "}
                  <a href="/knowledge-bases" style={{ color: "var(--color-primary)" }}>
                    Create one
                  </a>{" "}
                  first.
                </p>
              ) : (
                <select
                  className="form-input"
                  value={selectedKbId}
                  onChange={(e) => setSelectedKbId(e.target.value)}
                  required
                >
                  {kbs.map((kb) => (
                    <option key={kb.id} value={kb.id}>
                      {kb.name} ({kb.document_count} doc{kb.document_count !== 1 ? "s" : ""})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Card count */}
          <div className="form-label">
            Number of Cards
            <input
              className="form-input"
              type="number"
              min={1}
              max={50}
              value={maxCards}
              onChange={(e) => setMaxCards(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={generating}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!canSubmit}>
              {generating ? (
                <><span className="spinner" />Generating…</>
              ) : (
                "✨ Generate"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({ doc, generating, onGenerate, onDelete }) {
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
        <button
          className="btn-primary"
          onClick={onGenerate}
          disabled={doc.status !== "ready" || generating}
          title={doc.status !== "ready" ? "Document must be ready before generating" : ""}
        >
          {generating ? (
            <><span className="spinner" />Generating…</>
          ) : (
            "✨ Generate Flashcards"
          )}
        </button>
        <button className="btn-danger" onClick={onDelete} disabled={generating}>
          Delete
        </button>
      </div>
    </div>
  );
}
