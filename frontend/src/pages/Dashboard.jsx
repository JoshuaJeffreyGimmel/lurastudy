import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteDocument,
  generateFlashcards,
  listDocuments,
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
      const deck = await generateFlashcards(doc.id, 20);
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
        <h1>Dashboard</h1>
        <p className="subtitle">Upload study materials and generate AI flashcards instantly.</p>
      </div>

      {error && (
        <div className="banner banner-error" onClick={() => setError(null)} style={{ cursor: "pointer" }}>
          ⚠ {error} <span style={{ float: "right", opacity: 0.6 }}>✕</span>
        </div>
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
