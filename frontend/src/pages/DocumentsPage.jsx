import React, { useCallback, useEffect, useState } from "react";
import { listDecks, listDocuments } from "../api/client.js";
import DocumentPreviewModal from "../components/DocumentPreviewModal.jsx";
import "./DocumentsPage.css";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null); // doc to preview, or null

  const fetchData = useCallback(() => {
    return Promise.all([listDocuments(), listDecks()])
      .then(([docsData, decksData]) => {
        setDocuments(docsData.documents);
        setDecks(decksData.decks);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  // Build a map: documentId → [deckTitle, ...]
  const docToDeckNames = buildDocToDeckMap(decks);

  return (
    <div className="docs-page">
      <div className="docs-page-header">
        <div>
          <h1>Documents</h1>
          <p className="subtitle">
            All uploaded documents and the decks they belong to.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="banner banner-error"
          onClick={() => setError(null)}
          style={{ cursor: "pointer" }}
        >
          ⚠ {error} <span style={{ float: "right", opacity: 0.6 }}>✕</span>
        </div>
      )}

      {loading ? (
        <p>
          <span className="spinner" />
          Loading…
        </p>
      ) : documents.length === 0 ? (
        <div className="banner banner-info">
          No documents yet. Upload a PDF, TXT, or Markdown file from the Home
          page.
        </div>
      ) : (
        <div className="docs-table-wrapper card">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Size</th>
                <th>Status</th>
                <th>Deck(s)</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  deckNames={docToDeckNames[doc.id] ?? []}
                  onPreview={() => setPreviewDoc(doc)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a map of { documentId: [deckTitle, ...] } from the decks list.
 * Each deck has a source_documents array with document objects.
 */
function buildDocToDeckMap(decks) {
  const map = {};
  for (const deck of decks) {
    for (const doc of deck.source_documents ?? []) {
      if (!map[doc.id]) map[doc.id] = [];
      map[doc.id].push(deck.title);
    }
  }
  return map;
}

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({ doc, deckNames, onPreview }) {
  const statusClass =
    {
      ready: "badge-ready",
      processing: "badge-processing",
      error: "badge-error",
    }[doc.status] || "badge-processing";

  const fileSizeLabel =
    doc.file_size < 1024 * 1024
      ? `${(doc.file_size / 1024).toFixed(1)} KB`
      : `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <tr className="docs-row">
      <td className="docs-cell docs-cell-name">
        <span className="docs-filename">{doc.original_filename}</span>
      </td>
      <td className="docs-cell">
        <span className="docs-filetype">{doc.file_type.toUpperCase()}</span>
      </td>
      <td className="docs-cell docs-cell-muted">{fileSizeLabel}</td>
      <td className="docs-cell">
        <span className={`badge ${statusClass}`}>{doc.status}</span>
      </td>
      <td className="docs-cell docs-cell-decks">
        {deckNames.length === 0 ? (
          <span className="docs-no-deck">—</span>
        ) : (
          <div className="docs-deck-tags">
            {deckNames.map((name) => (
              <span key={name} className="docs-deck-tag">
                {name}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="docs-cell docs-cell-muted">
        {new Date(doc.created_at).toLocaleDateString()}
      </td>
      <td className="docs-cell docs-cell-actions">
        <button
          className="docs-preview-btn"
          onClick={onPreview}
          title="Preview extracted text"
          disabled={doc.status === "processing"}
        >
          🔍 Preview
        </button>
      </td>
    </tr>
  );
}
