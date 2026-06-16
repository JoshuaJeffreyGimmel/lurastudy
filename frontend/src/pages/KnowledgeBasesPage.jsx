import React, { useCallback, useEffect, useState } from "react";
import {
  addDocumentToKnowledgeBase,
  createKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBase,
  listDocuments,
  listKnowledgeBases,
  removeDocumentFromKnowledgeBase,
} from "../api/client.js";
import "./KnowledgeBasesPage.css";

export default function KnowledgeBasesPage() {
  const [kbs, setKbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchKbs = useCallback(() => {
    return listKnowledgeBases()
      .then((data) => setKbs(data.knowledge_bases))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetchKbs().finally(() => setLoading(false));
  }, [fetchKbs]);

  function handleCreated(kb) {
    setKbs((prev) => [{ ...kb, document_count: kb.documents?.length ?? 0 }, ...prev]);
    setShowCreate(false);
  }

  async function handleDelete(kb) {
    if (!window.confirm(`Delete knowledge base "${kb.name}"? This will not delete the documents.`)) return;
    try {
      await deleteKnowledgeBase(kb.id);
      setKbs((prev) => prev.filter((k) => k.id !== kb.id));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="kb-page">
      <div className="kb-header">
        <div>
          <h1>Knowledge Bases</h1>
          <p className="subtitle">Group documents into collections for multi-document flashcard generation.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + New Knowledge Base
        </button>
      </div>

      {error && (
        <div className="banner banner-error" onClick={() => setError(null)} style={{ cursor: "pointer" }}>
          ⚠ {error} <span style={{ float: "right", opacity: 0.6 }}>✕</span>
        </div>
      )}

      {showCreate && (
        <CreateKnowledgeBaseModal
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}

      <section className="kb-list-section">
        {loading ? (
          <p><span className="spinner" />Loading…</p>
        ) : kbs.length === 0 ? (
          <div className="banner banner-info">
            No knowledge bases yet. Create one to group documents together.
          </div>
        ) : (
          <div className="kb-list">
            {kbs.map((kb) => (
              <KnowledgeBaseCard
                key={kb.id}
                kb={kb}
                onDelete={() => handleDelete(kb)}
                onUpdated={(updated) =>
                  setKbs((prev) =>
                    prev.map((k) =>
                      k.id === updated.id
                        ? { ...updated, document_count: updated.documents?.length ?? 0 }
                        : k
                    )
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Create Knowledge Base Modal ──────────────────────────────────────────────

function CreateKnowledgeBaseModal({ onCreated, onClose }) {
  const [name, setName] = useState("");
  const [documents, setDocuments] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    listDocuments()
      .then((data) => setDocuments(data.documents.filter((d) => d.status === "ready")))
      .catch((e) => setError(e.message));
  }, []);

  function toggleDoc(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const kb = await createKnowledgeBase(name.trim(), [...selectedIds]);
      onCreated(kb);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Knowledge Base</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="banner banner-error">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="form-label">
            Name
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Biology Semester 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </label>

          <div className="form-label">
            Documents <span className="form-hint">(optional — add later too)</span>
            <div className="doc-checklist">
              {documents.length === 0 ? (
                <p className="form-hint">No ready documents available.</p>
              ) : (
                documents.map((doc) => (
                  <label key={doc.id} className="doc-check-item">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(doc.id)}
                      onChange={() => toggleDoc(doc.id)}
                    />
                    <span>{doc.original_filename}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
              {saving ? <><span className="spinner" />Creating…</> : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Knowledge Base Card ──────────────────────────────────────────────────────

function KnowledgeBaseCard({ kb, onDelete, onUpdated }) {
  const [expanded, setExpanded] = useState(false);
  const [fullKb, setFullKb] = useState(null);
  const [allDocs, setAllDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [error, setError] = useState(null);

  async function handleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (fullKb) return; // already loaded
    setLoadingDocs(true);
    try {
      const [kbData, docsData] = await Promise.all([
        getKnowledgeBase(kb.id),
        listDocuments(),
      ]);
      setFullKb(kbData);
      setAllDocs(docsData.documents.filter((d) => d.status === "ready"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingDocs(false);
    }
  }

  async function handleAddDoc(docId) {
    try {
      const updated = await addDocumentToKnowledgeBase(kb.id, docId);
      setFullKb(updated);
      onUpdated(updated);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleRemoveDoc(docId) {
    try {
      const updated = await removeDocumentFromKnowledgeBase(kb.id, docId);
      setFullKb(updated);
      onUpdated(updated);
    } catch (e) {
      setError(e.message);
    }
  }

  const kbDocIds = new Set((fullKb?.documents ?? []).map((d) => d.id));
  const availableToAdd = allDocs.filter((d) => !kbDocIds.has(d.id));

  return (
    <div className="kb-card card">
      <div className="kb-card-header" onClick={handleExpand} style={{ cursor: "pointer" }}>
        <div className="kb-card-info">
          <div className="kb-name">{kb.name}</div>
          <div className="kb-meta">
            <span>{kb.document_count} document{kb.document_count !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{new Date(kb.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="kb-card-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn-secondary" onClick={handleExpand}>
            {expanded ? "▲ Collapse" : "▼ Manage"}
          </button>
          <button className="btn-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="kb-card-body">
          {error && <div className="banner banner-error">{error}</div>}
          {loadingDocs ? (
            <p><span className="spinner" />Loading…</p>
          ) : (
            <>
              <div className="kb-section-label">Documents in this Knowledge Base</div>
              {(fullKb?.documents ?? []).length === 0 ? (
                <p className="form-hint">No documents yet.</p>
              ) : (
                <ul className="kb-doc-list">
                  {(fullKb?.documents ?? []).map((doc) => (
                    <li key={doc.id} className="kb-doc-item">
                      <span>{doc.original_filename}</span>
                      <button
                        className="btn-danger btn-sm"
                        onClick={() => handleRemoveDoc(doc.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {availableToAdd.length > 0 && (
                <>
                  <div className="kb-section-label" style={{ marginTop: "1rem" }}>
                    Add Documents
                  </div>
                  <ul className="kb-doc-list">
                    {availableToAdd.map((doc) => (
                      <li key={doc.id} className="kb-doc-item">
                        <span>{doc.original_filename}</span>
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => handleAddDoc(doc.id)}
                        >
                          + Add
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
