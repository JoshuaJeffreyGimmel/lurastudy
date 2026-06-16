import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addDocumentToDeck,
  chatWithDeck,
  generateDeckFlashcards,
  getDeck,
  listDocuments,
  removeDocumentFromDeck,
  updateDeck,
  uploadDocument,
} from "../api/client.js";
import "./DeckWorkspacePage.css";

// ─── Main Workspace ───────────────────────────────────────────────────────────

export default function DeckWorkspacePage() {
  const { deckId } = useParams();
  const navigate = useNavigate();

  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("chat"); // "chat" | "flashcards"

  const fetchDeck = useCallback(() => {
    return getDeck(deckId)
      .then((data) => setDeck(data))
      .catch((e) => setError(e.message));
  }, [deckId]);

  useEffect(() => {
    fetchDeck().finally(() => setLoading(false));
  }, [fetchDeck]);

  if (loading) {
    return (
      <div className="workspace-loading">
        <span className="spinner" />Loading workspace…
      </div>
    );
  }

  if (error) {
    return (
      <div className="workspace-error">
        <div className="banner banner-error">{error}</div>
        <button className="btn-secondary" onClick={() => navigate("/decks")}>← Back to Decks</button>
      </div>
    );
  }

  if (!deck) return null;

  return (
    <div className="workspace">
      {/* ─── Sidebar ──────────────────────────────────────────────────────── */}
      <WorkspaceSidebar
        deck={deck}
        onDeckUpdated={setDeck}
        onBack={() => navigate("/decks")}
      />

      {/* ─── Main Panel ───────────────────────────────────────────────────── */}
      <div className="workspace-main">
        {/* Tab bar */}
        <div className="workspace-tabs">
          <button
            className={`workspace-tab ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            💬 Chat
          </button>
          <button
            className={`workspace-tab ${activeTab === "flashcards" ? "active" : ""}`}
            onClick={() => setActiveTab("flashcards")}
          >
            🃏 Flashcards
            {deck.flashcards.length > 0 && (
              <span className="tab-badge">{deck.flashcards.length}</span>
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className="workspace-content">
          {activeTab === "chat" ? (
            <ChatPanel deck={deck} />
          ) : (
            <FlashcardsPanel deck={deck} onDeckUpdated={setDeck} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function WorkspaceSidebar({ deck, onDeckUpdated, onBack }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(deck.title);
  const [showAddSource, setShowAddSource] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const titleInputRef = useRef(null);

  useEffect(() => {
    setTitleValue(deck.title);
  }, [deck.title]);

  async function handleTitleSave() {
    if (!titleValue.trim() || titleValue.trim() === deck.title) {
      setEditingTitle(false);
      setTitleValue(deck.title);
      return;
    }
    try {
      const updated = await updateDeck(deck.id, { title: titleValue.trim() });
      onDeckUpdated(updated);
      setEditingTitle(false);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleRemoveSource(docId) {
    try {
      const updated = await removeDocumentFromDeck(deck.id, docId);
      onDeckUpdated(updated);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleUploadAndAdd(file) {
    setUploading(true);
    setError(null);
    try {
      const doc = await uploadDocument(file);
      const updated = await addDocumentToDeck(deck.id, doc.id);
      onDeckUpdated(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <aside className="workspace-sidebar">
      {/* Back button */}
      <button className="sidebar-back" onClick={onBack}>
        ← Decks
      </button>

      {/* Deck title */}
      <div className="sidebar-title-section">
        {editingTitle ? (
          <div className="sidebar-title-edit">
            <input
              ref={titleInputRef}
              className="sidebar-title-input"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSave();
                if (e.key === "Escape") {
                  setEditingTitle(false);
                  setTitleValue(deck.title);
                }
              }}
              autoFocus
            />
          </div>
        ) : (
          <h2
            className="sidebar-title"
            onClick={() => setEditingTitle(true)}
            title="Click to rename"
          >
            {deck.title}
            <span className="sidebar-title-edit-icon">✏</span>
          </h2>
        )}
        {deck.description && (
          <p className="sidebar-description">{deck.description}</p>
        )}
      </div>

      {error && (
        <div className="banner banner-error sidebar-error" onClick={() => setError(null)}>
          ⚠ {error}
        </div>
      )}

      {/* Sources section */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span className="sidebar-section-label">Sources</span>
          <button
            className="sidebar-add-btn"
            onClick={() => setShowAddSource(true)}
            title="Add source"
          >
            +
          </button>
        </div>

        {deck.source_documents.length === 0 ? (
          <div className="sidebar-empty-sources">
            <p>No sources yet.</p>
            <button
              className="btn-secondary sidebar-add-source-btn"
              onClick={() => setShowAddSource(true)}
            >
              + Add Source
            </button>
          </div>
        ) : (
          <ul className="sidebar-source-list">
            {deck.source_documents.map((doc) => (
              <li key={doc.id} className="sidebar-source-item">
                <span className="source-icon">
                  {doc.file_type === "pdf" ? "📕" : doc.file_type === "md" ? "📝" : "📄"}
                </span>
                <span className="source-name" title={doc.original_filename}>
                  {doc.original_filename}
                </span>
                <span className={`source-status badge badge-${doc.status === "ready" ? "ready" : doc.status === "error" ? "error" : "processing"}`}>
                  {doc.status}
                </span>
                <button
                  className="source-remove"
                  onClick={() => handleRemoveSource(doc.id)}
                  title="Remove from deck"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {uploading && (
          <div className="sidebar-uploading">
            <span className="spinner" />Processing…
          </div>
        )}
      </div>

      {showAddSource && (
        <AddSourceModal
          deckId={deck.id}
          existingDocIds={new Set(deck.source_documents.map((d) => d.id))}
          onClose={() => setShowAddSource(false)}
          onAdded={(updated) => {
            onDeckUpdated(updated);
            setShowAddSource(false);
          }}
          onUpload={handleUploadAndAdd}
        />
      )}
    </aside>
  );
}

// ─── Add Source Modal ─────────────────────────────────────────────────────────

function AddSourceModal({ deckId, existingDocIds, onClose, onAdded, onUpload }) {
  const [allDocs, setAllDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    listDocuments()
      .then((data) => setAllDocs(data.documents))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const availableDocs = allDocs.filter((d) => !existingDocIds.has(d.id) && d.status === "ready");

  async function handleAdd(docId) {
    setAdding(docId);
    setError(null);
    try {
      const updated = await addDocumentToDeck(deckId, docId);
      onAdded(updated);
    } catch (e) {
      setError(e.message);
      setAdding(null);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await onUpload(file);
      onClose();
    } catch (e) {
      setError(e.message);
      setUploading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Source</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="banner banner-error" style={{ margin: "0 1.5rem" }}>{error}</div>}

        <div className="modal-form">
          {/* Upload new */}
          <div className="add-source-section">
            <div className="add-source-label">Upload New Document</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              style={{ display: "none" }}
              onChange={handleFileChange}
              disabled={uploading}
            />
            <button
              className="btn-secondary add-source-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <><span className="spinner" />Uploading…</> : "📄 Upload PDF / TXT / MD"}
            </button>
          </div>

          {/* Pick from library */}
          <div className="add-source-section">
            <div className="add-source-label">From Your Library</div>
            {loading ? (
              <p className="form-hint"><span className="spinner" />Loading…</p>
            ) : availableDocs.length === 0 ? (
              <p className="form-hint">No other ready documents available.</p>
            ) : (
              <ul className="add-source-list">
                {availableDocs.map((doc) => (
                  <li key={doc.id} className="add-source-item">
                    <span className="source-name">{doc.original_filename}</span>
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => handleAdd(doc.id)}
                      disabled={adding === doc.id}
                    >
                      {adding === doc.id ? <span className="spinner" /> : "+ Add"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

function ChatPanel({ deck }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const hasReadySources = deck.source_documents.some((d) => d.status === "ready");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    const newMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setSending(true);

    try {
      // Build history (exclude the message we just added)
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const response = await chatWithDeck(deck.id, userMessage, history);
      setMessages([...newMessages, { role: "assistant", content: response.reply }]);
    } catch (e) {
      setError(e.message);
      // Remove the user message on error
      setMessages(messages);
    } finally {
      setSending(false);
    }
  }

  if (!hasReadySources) {
    return (
      <div className="chat-empty">
        <div className="chat-empty-icon">💬</div>
        <h3>No sources ready</h3>
        <p>Add at least one document to this deck to start chatting with AI about your study materials.</p>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">🤖</div>
            <h3>Ask me anything about your sources</h3>
            <p>I've read all the documents in this deck. Ask me questions, request summaries, or explore concepts.</p>
            <div className="chat-suggestions">
              {[
                "Summarize the key concepts",
                "What are the most important topics?",
                "Explain the main ideas in simple terms",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  className="chat-suggestion"
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))
        )}
        {sending && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-message-avatar">🤖</div>
            <div className="chat-message-bubble chat-thinking">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="banner banner-error chat-error" onClick={() => setError(null)}>
          ⚠ {error}
        </div>
      )}

      {/* Input */}
      <form className="chat-input-form" onSubmit={handleSend}>
        <input
          className="chat-input"
          type="text"
          placeholder="Ask a question about your sources…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button
          type="submit"
          className="btn-primary chat-send-btn"
          disabled={!input.trim() || sending}
        >
          {sending ? <span className="spinner" /> : "Send"}
        </button>
      </form>
    </div>
  );
}

function ChatMessage({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`chat-message ${isUser ? "chat-message-user" : "chat-message-assistant"}`}>
      {!isUser && <div className="chat-message-avatar">🤖</div>}
      <div className="chat-message-bubble">
        <p className="chat-message-text">{message.content}</p>
      </div>
      {isUser && <div className="chat-message-avatar chat-message-avatar-user">👤</div>}
    </div>
  );
}

// ─── Flashcards Panel ─────────────────────────────────────────────────────────

function FlashcardsPanel({ deck, onDeckUpdated }) {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [maxCards, setMaxCards] = useState(20);
  const [error, setError] = useState(null);

  const hasReadySources = deck.source_documents.some((d) => d.status === "ready");

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const updated = await generateDeckFlashcards(deck.id, maxCards);
      onDeckUpdated(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flashcards-panel">
      {/* Generate section */}
      <div className="flashcards-generate card">
        <div className="flashcards-generate-header">
          <div>
            <h3>Generate Flashcards</h3>
            <p className="generate-hint">
              AI will create flashcards from all {deck.source_documents.length} source{deck.source_documents.length !== 1 ? "s" : ""} in this deck.
              {deck.flashcards.length > 0 && " This will replace the existing cards."}
            </p>
          </div>
          <div className="generate-controls">
            <div className="generate-count-control">
              <label className="generate-count-label">Cards</label>
              <input
                type="number"
                className="generate-count-input"
                min={5}
                max={50}
                value={maxCards}
                onChange={(e) => setMaxCards(Number(e.target.value))}
                disabled={generating}
              />
            </div>
            <button
              className="btn-primary"
              onClick={handleGenerate}
              disabled={generating || !hasReadySources}
              title={!hasReadySources ? "Add at least one ready document first" : ""}
            >
              {generating ? (
                <><span className="spinner" />Generating…</>
              ) : (
                "✨ Generate"
              )}
            </button>
          </div>
        </div>
        {error && <div className="banner banner-error" style={{ marginTop: "1rem" }}>{error}</div>}
      </div>

      {/* Cards list */}
      {deck.flashcards.length === 0 ? (
        <div className="flashcards-empty">
          <div className="flashcards-empty-icon">🃏</div>
          <h3>No flashcards yet</h3>
          <p>Generate flashcards from your sources to start studying.</p>
        </div>
      ) : (
        <>
          <div className="flashcards-study-bar">
            <span className="flashcards-count">{deck.flashcards.length} cards ready</span>
            <button
              className="btn-primary"
              onClick={() => navigate(`/study/${deck.id}`)}
            >
              🎯 Study Now
            </button>
          </div>
          <div className="flashcards-list">
            {deck.flashcards.map((card, i) => (
              <FlashcardPreview key={card.id} card={card} index={i + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FlashcardPreview({ card, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`flashcard-preview card ${expanded ? "expanded" : ""}`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flashcard-preview-header">
        <span className="flashcard-preview-num">#{index}</span>
        <span className="flashcard-preview-front">{card.front}</span>
        <span className="flashcard-preview-toggle">{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div className="flashcard-preview-back">
          <span className="flashcard-preview-back-label">Answer</span>
          <p>{card.back}</p>
        </div>
      )}
    </div>
  );
}
