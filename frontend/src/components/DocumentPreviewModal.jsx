import React, { useEffect, useRef, useState } from "react";
import { getDocumentChunks } from "../api/client.js";
import "./DocumentPreviewModal.css";

/**
 * DocumentPreviewModal
 *
 * Opens a full-screen overlay showing all extracted text chunks for a document.
 * Lets users verify what the ingestion pipeline actually extracted.
 *
 * Props:
 *   doc      — the document object { id, original_filename, file_type, status }
 *   onClose  — callback to close the modal
 */
export default function DocumentPreviewModal({ doc, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const overlayRef = useRef(null);

  useEffect(() => {
    getDocumentChunks(doc.id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [doc.id]);

  // Close on Escape key
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Close on overlay click (not modal card click)
  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  const fileIcon =
    doc.file_type === "pdf" ? "📕" : doc.file_type === "md" ? "📝" : "📄";

  const filteredChunks = data
    ? data.chunks.filter((c) =>
        search.trim() === "" ||
        c.content.toLowerCase().includes(search.trim().toLowerCase())
      )
    : [];

  return (
    <div
      className="doc-preview-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
    >
      <div className="doc-preview-modal">
        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div className="doc-preview-header">
          <div className="doc-preview-title">
            <span className="doc-preview-icon">{fileIcon}</span>
            <div>
              <h2 className="doc-preview-name">{doc.original_filename}</h2>
              {data && (
                <p className="doc-preview-meta">
                  {data.total_chunks} chunk{data.total_chunks !== 1 ? "s" : ""} extracted
                </p>
              )}
            </div>
          </div>
          <button className="doc-preview-close" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>

        {/* ─── Search bar ──────────────────────────────────────────────── */}
        {data && data.total_chunks > 0 && (
          <div className="doc-preview-search-bar">
            <span className="doc-preview-search-icon">🔍</span>
            <input
              className="doc-preview-search"
              type="text"
              placeholder="Search within extracted text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                className="doc-preview-search-clear"
                onClick={() => setSearch("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* ─── Body ────────────────────────────────────────────────────── */}
        <div className="doc-preview-body">
          {loading && (
            <div className="doc-preview-loading">
              <span className="spinner" />
              Loading extracted text…
            </div>
          )}

          {error && (
            <div className="banner banner-error doc-preview-error">
              ⚠ {error}
            </div>
          )}

          {!loading && !error && data && data.total_chunks === 0 && (
            <div className="doc-preview-empty">
              <div className="doc-preview-empty-icon">📭</div>
              <h3>No chunks found</h3>
              <p>
                This document has no extracted text chunks. It may still be
                processing, or text extraction may have failed.
              </p>
            </div>
          )}

          {!loading && !error && data && data.total_chunks > 0 && (
            <>
              {search.trim() !== "" && (
                <p className="doc-preview-results-label">
                  {filteredChunks.length === 0
                    ? "No chunks match your search."
                    : `Showing ${filteredChunks.length} of ${data.total_chunks} chunk${data.total_chunks !== 1 ? "s" : ""}`}
                </p>
              )}
              <div className="doc-preview-chunks">
                {filteredChunks.map((chunk) => (
                  <ChunkCard
                    key={chunk.id}
                    chunk={chunk}
                    highlight={search.trim()}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chunk Card ───────────────────────────────────────────────────────────────

function ChunkCard({ chunk, highlight }) {
  return (
    <div className="chunk-card">
      <div className="chunk-card-header">
        <span className="chunk-index">Chunk #{chunk.chunk_index + 1}</span>
        <span className="chunk-length">{chunk.content.length} chars</span>
      </div>
      <p className="chunk-content">
        {highlight ? (
          <HighlightedText text={chunk.content} query={highlight} />
        ) : (
          chunk.content
        )}
      </p>
    </div>
  );
}

// ─── Text Highlighter ─────────────────────────────────────────────────────────

function HighlightedText({ text, query }) {
  if (!query) return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="chunk-highlight">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
