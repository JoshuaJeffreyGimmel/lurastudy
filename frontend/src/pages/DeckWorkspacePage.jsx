import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addDocumentToDeck,
  chatInConversation,
  createConversation,
  deleteConversation,
  deleteQuiz,
  generateDeckFlashcards,
  generateDeckQuiz,
  getDeck,
  getDueCards,
  getQuiz,
  listConversations,
  listQuizHistory,
  removeDocumentFromDeck,
  saveQuiz,
  saveQuizAttempt,
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
  const [activeTab, setActiveTab] = useState("chat"); // "chat" | "flashcards" | "quiz"
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
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
          <button
            className={`workspace-tab ${activeTab === "quiz" ? "active" : ""}`}
            onClick={() => setActiveTab("quiz")}
          >
            🧠 Quiz
          </button>
        </div>

        {/* Tab content */}
        <div className="workspace-content">
          {activeTab === "chat" ? (
            <ChatTab deck={deck} />
          ) : activeTab === "flashcards" ? (
            <FlashcardsPanel deck={deck} onDeckUpdated={setDeck} />
          ) : (
            <QuizTab deck={deck} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function WorkspaceSidebar({ deck, onDeckUpdated, collapsed, onToggle }) {
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
    <aside className={`workspace-sidebar${collapsed ? " workspace-sidebar--collapsed" : ""}`}>
      {/* Title section with collapse toggle — always visible */}
      <div className="sidebar-title-section">
        <div className="sidebar-title-row">
          {!collapsed && (editingTitle ? (
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
          ))}
          <button
            className="sidebar-collapse-btn"
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        {!collapsed && deck.description && (
          <p className="sidebar-description">{deck.description}</p>
        )}
      </div>

      {/* Collapsed icon-only view */}
      {collapsed && (
        <div className="sidebar-collapsed-body">
          <button
            className="sidebar-add-btn sidebar-collapsed-add"
            onClick={() => setShowAddSource(true)}
            title="Add source"
          >
            +
          </button>
          {deck.source_documents.map((doc) => (
            <span
              key={doc.id}
              className="sidebar-collapsed-icon"
              title={doc.original_filename}
            >
              {doc.file_type === "pdf" ? "📕" : doc.file_type === "md" ? "📝" : "📄"}
            </span>
          ))}
        </div>
      )}

      {/* Sidebar body — hidden when collapsed */}
      <div className="sidebar-body">

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

      </div>{/* end sidebar-body */}
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
    import("../api/client.js").then(({ listDocuments }) =>
      listDocuments()
        .then((data) => setAllDocs(data.documents))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    );
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

// ─── Chat Tab (with conversations sidebar on the right) ───────────────────────

function ChatTab({ deck }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [convsPanelCollapsed, setConvsPanelCollapsed] = useState(false);
  const [error, setError] = useState(null);

  const hasReadySources = deck.source_documents.some((d) => d.status === "ready");

  // Load conversations list
  useEffect(() => {
    listConversations(deck.id)
      .then((data) => {
        setConversations(data.conversations);
        // Auto-select the most recent conversation if any
        if (data.conversations.length > 0 && !activeConvId) {
          setActiveConvId(data.conversations[0].id);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingConvs(false));
  }, [deck.id]);

  async function handleNewChat() {
    try {
      const conv = await createConversation(deck.id, "New Chat");
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDeleteConversation(convId) {
    try {
      await deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        const remaining = conversations.filter((c) => c.id !== convId);
        setActiveConvId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function handleConvTitleUpdate(convId, newTitle) {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: newTitle } : c))
    );
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
    <div className="chat-tab-layout">
      {/* ─── Active conversation (center) ─────────────────────────────────── */}
      <div className="chat-tab-main">
        {activeConvId ? (
          <ChatPanel
            key={activeConvId}
            deck={deck}
            convId={activeConvId}
            onTitleUpdate={(title) => handleConvTitleUpdate(activeConvId, title)}
          />
        ) : (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <h3>No conversation selected</h3>
            <p>Start a new chat or select one from the list on the right.</p>
            <button className="btn-primary" onClick={handleNewChat}>
              + New Chat
            </button>
          </div>
        )}
      </div>

      {/* ─── Conversations list (right panel) ─────────────────────────────── */}
      <aside className={`conv-sidebar${convsPanelCollapsed ? " conv-sidebar--collapsed" : ""}`}>
        <div className="conv-sidebar-header">
          {!convsPanelCollapsed && <span className="conv-sidebar-title">Conversations</span>}
          <button
            className="sidebar-collapse-btn"
            onClick={() => setConvsPanelCollapsed((v) => !v)}
            title={convsPanelCollapsed ? "Expand" : "Collapse"}
          >
            {convsPanelCollapsed ? "‹" : "›"}
          </button>
        </div>

        {!convsPanelCollapsed && (
          <>
            <button className="conv-new-btn" onClick={handleNewChat}>
              + New Chat
            </button>

            {error && (
              <div className="banner banner-error" style={{ margin: "0 0.75rem", fontSize: "0.8rem" }} onClick={() => setError(null)}>
                ⚠ {error}
              </div>
            )}

            {loadingConvs ? (
              <div className="conv-loading"><span className="spinner" /></div>
            ) : conversations.length === 0 ? (
              <div className="conv-empty">No conversations yet.</div>
            ) : (
              <ul className="conv-list">
                {conversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === activeConvId}
                    onSelect={() => setActiveConvId(conv.id)}
                    onDelete={() => handleDeleteConversation(conv.id)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function ConversationItem({ conv, isActive, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false);

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return (
    <li
      className={`conv-item${isActive ? " conv-item--active" : ""}`}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="conv-item-title">{conv.title}</div>
      <div className="conv-item-meta">
        <span>{formatDate(conv.updated_at)}</span>
        {conv.message_count > 0 && (
          <span>{conv.message_count} msg{conv.message_count !== 1 ? "s" : ""}</span>
        )}
      </div>
      {hovered && (
        <button
          className="source-remove conv-delete-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete conversation"
        >
          ✕
        </button>
      )}
    </li>
  );
}

// ─── Chat Panel (single conversation) ────────────────────────────────────────

function ChatPanel({ deck, convId, onTitleUpdate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Load existing messages
  useEffect(() => {
    import("../api/client.js").then(({ getConversation }) =>
      getConversation(convId)
        .then((data) => setMessages(data.messages || []))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    );
  }, [convId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    // Optimistically add user message to UI
    const tempUserMsg = { id: "temp-user", role: "user", content: userMessage };
    setMessages((prev) => [...prev, tempUserMsg]);
    setSending(true);

    try {
      const replyMsg = await chatInConversation(convId, userMessage);
      // Replace temp user message with real messages
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== "temp-user");
        const realUserMsg = {
          id: `user-${Date.now()}`,
          role: "user",
          content: userMessage,
          created_at: replyMsg.created_at,
        };
        return [...withoutTemp, realUserMsg, replyMsg];
      });
      // Update conversation title if it was the first message
      if (messages.length === 0) {
        onTitleUpdate(userMessage.slice(0, 60) + (userMessage.length > 60 ? "…" : ""));
      }
    } catch (e) {
      setError(e.message);
      // Remove the optimistic user message on error
      setMessages((prev) => prev.filter((m) => m.id !== "temp-user"));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="chat-panel">
        <div className="chat-messages">
          <div className="chat-welcome">
            <span className="spinner" />
          </div>
        </div>
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
            <ChatMessage key={msg.id || i} message={msg} />
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
  const [dueCount, setDueCount] = useState(null); // null = not yet loaded

  const hasReadySources = deck.source_documents.some((d) => d.status === "ready");

  // Load due count when there are flashcards
  useEffect(() => {
    if (deck.flashcards.length === 0) {
      setDueCount(null);
      return;
    }
    getDueCards(deck.id)
      .then((data) => setDueCount(data.due_count))
      .catch(() => setDueCount(null));
  }, [deck.id, deck.flashcards.length]);

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
            <div className="flashcards-study-bar-info">
              <span className="flashcards-count">{deck.flashcards.length} cards</span>
              {dueCount !== null && (
                dueCount > 0 ? (
                  <span className="flashcards-due-badge">📅 {dueCount} due today</span>
                ) : (
                  <span className="flashcards-caught-up">✅ All caught up</span>
                )
              )}
            </div>
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

// ─── Quiz Tab (with history) ──────────────────────────────────────────────────

const OPTION_LABELS = ["A", "B", "C", "D"];

function QuizTab({ deck }) {
  const [quizHistory, setQuizHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeView, setActiveView] = useState("generate"); // "generate" | "active" | "results" | "review"
  const [activeQuizId, setActiveQuizId] = useState(null); // saved quiz id
  const [activeQuiz, setActiveQuiz] = useState(null);     // full quiz object with questions
  const [error, setError] = useState(null);

  // Active quiz session state
  const [questions, setQuestions] = useState([]);
  const [maxQuestions, setMaxQuestions] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [savedAttemptId, setSavedAttemptId] = useState(null);

  const hasReadySources = deck.source_documents.some((d) => d.status === "ready");

  // Load quiz history
  useEffect(() => {
    listQuizHistory(deck.id)
      .then((data) => setQuizHistory(data.quizzes))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingHistory(false));
  }, [deck.id]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setAnswers({});
    setCurrentIndex(0);
    setQuizDone(false);
    setSavedAttemptId(null);
    try {
      const data = await generateDeckQuiz(deck.id, maxQuestions);
      setQuestions(data.questions);

      // Auto-save the quiz
      const now = new Date();
      const title = `Quiz — ${now.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
      const saved = await saveQuiz(deck.id, title, data.questions);
      setActiveQuizId(saved.id);
      setActiveQuiz(saved);
      setQuizHistory((prev) => [
        {
          id: saved.id,
          deck_id: saved.deck_id,
          title: saved.title,
          question_count: data.questions.length,
          created_at: saved.created_at,
          attempt_count: 0,
          best_score: null,
          best_total: null,
        },
        ...prev,
      ]);
      setActiveView("active");
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleReviewQuiz(quizId) {
    try {
      const quiz = await getQuiz(quizId);
      setActiveQuiz(quiz);
      setActiveQuizId(quizId);
      setQuestions(quiz.questions);
      setAnswers({});
      setCurrentIndex(0);
      setQuizDone(false);
      setSavedAttemptId(null);
      setActiveView("active");
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDeleteQuiz(quizId) {
    try {
      await deleteQuiz(quizId);
      setQuizHistory((prev) => prev.filter((q) => q.id !== quizId));
      if (activeQuizId === quizId) {
        setActiveView("generate");
        setActiveQuizId(null);
        setActiveQuiz(null);
        setQuestions([]);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function handleAnswer(questionIndex, optionIndex) {
    if (answers[questionIndex] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  }

  function handleNext() {
    if (currentIndex + 1 >= questions.length) {
      finishQuiz();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  async function finishQuiz() {
    setQuizDone(true);
    setActiveView("results");

    // Save attempt
    if (activeQuizId) {
      const correctCount = questions.filter((q, i) => answers[i] === q.correct_index).length;
      try {
        const attempt = await saveQuizAttempt(activeQuizId, answers, correctCount, questions.length);
        setSavedAttemptId(attempt.id);
        // Update history entry
        setQuizHistory((prev) =>
          prev.map((q) =>
            q.id === activeQuizId
              ? {
                  ...q,
                  attempt_count: q.attempt_count + 1,
                  best_score: q.best_score === null || correctCount > q.best_score ? correctCount : q.best_score,
                  best_total: questions.length,
                }
              : q
          )
        );
      } catch (_) {
        // Non-fatal
      }
    }
  }

  function handleRestart() {
    setAnswers({});
    setCurrentIndex(0);
    setQuizDone(false);
    setSavedAttemptId(null);
    setActiveView("active");
  }

  const correctCount = questions.filter((q, i) => answers[i] === q.correct_index).length;

  return (
    <div className="quiz-tab-layout">
      {/* ─── Main quiz area ────────────────────────────────────────────────── */}
      <div className="quiz-tab-main">
        {activeView === "generate" && (
          <div className="flashcards-panel">
            <div className="flashcards-generate card">
              <div className="flashcards-generate-header">
                <div>
                  <h3>Generate Quiz</h3>
                  <p className="generate-hint">
                    AI will create multiple-choice questions from all{" "}
                    {deck.source_documents.length} source
                    {deck.source_documents.length !== 1 ? "s" : ""} in this deck.
                  </p>
                </div>
                <div className="generate-controls">
                  <div className="generate-count-control">
                    <label className="generate-count-label">Questions</label>
                    <input
                      type="number"
                      className="generate-count-input"
                      min={3}
                      max={20}
                      value={maxQuestions}
                      onChange={(e) => setMaxQuestions(Number(e.target.value))}
                      disabled={generating}
                    />
                  </div>
                  <button
                    className="btn-primary"
                    onClick={handleGenerate}
                    disabled={generating || !hasReadySources}
                    title={!hasReadySources ? "Add at least one ready document first" : ""}
                  >
                    {generating ? <><span className="spinner" />Generating…</> : "✨ Generate Quiz"}
                  </button>
                </div>
              </div>
              {error && <div className="banner banner-error" style={{ marginTop: "1rem" }}>{error}</div>}
              {!hasReadySources && (
                <div className="banner banner-info" style={{ marginTop: "1rem" }}>
                  Add at least one ready document to this deck to generate a quiz.
                </div>
              )}
            </div>

            <div className="flashcards-empty">
              <div className="flashcards-empty-icon">🧠</div>
              <h3>No quiz active</h3>
              <p>Generate a new quiz or select one from your history on the right.</p>
            </div>
          </div>
        )}

        {activeView === "active" && questions.length > 0 && !quizDone && (
          <div className="flashcards-panel" style={{ overflowY: "auto" }}>
            {/* Progress bar */}
            <div style={{ height: "4px", background: "var(--color-border)", borderRadius: "999px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                background: "var(--color-primary)",
                borderRadius: "999px",
                width: `${(currentIndex / questions.length) * 100}%`,
                transition: "width 0.4s ease",
              }} />
            </div>

            {/* Question counter */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                Question {currentIndex + 1} of {questions.length}
              </span>
              <button className="btn-secondary" style={{ fontSize: "0.78rem", padding: "0.3rem 0.75rem" }}
                onClick={handleGenerate} disabled={generating}>
                {generating ? <><span className="spinner" />…</> : "🔄 New Quiz"}
              </button>
            </div>

            {/* Question card */}
            <QuizQuestionCard
              question={questions[currentIndex]}
              questionIndex={currentIndex}
              selectedAnswer={answers[currentIndex]}
              onAnswer={(optIdx) => handleAnswer(currentIndex, optIdx)}
              onNext={handleNext}
              isLast={currentIndex + 1 >= questions.length}
            />
          </div>
        )}

        {activeView === "results" && (
          <div className="flashcards-panel" style={{ overflowY: "auto" }}>
            <QuizResults
              questions={questions}
              answers={answers}
              correctCount={correctCount}
              onRestart={handleRestart}
              onNewQuiz={() => { setActiveView("generate"); }}
              generating={generating}
            />
          </div>
        )}
      </div>

      {/* ─── Quiz history sidebar (right) ─────────────────────────────────── */}
      <aside className="quiz-history-sidebar">
        <div className="conv-sidebar-header">
          <span className="conv-sidebar-title">Quiz History</span>
        </div>

        <button className="conv-new-btn" onClick={() => setActiveView("generate")} disabled={generating}>
          {generating ? <><span className="spinner" />Generating…</> : "+ New Quiz"}
        </button>

        {loadingHistory ? (
          <div className="conv-loading"><span className="spinner" /></div>
        ) : quizHistory.length === 0 ? (
          <div className="conv-empty">No saved quizzes yet.</div>
        ) : (
          <ul className="conv-list">
            {quizHistory.map((quiz) => (
              <QuizHistoryItem
                key={quiz.id}
                quiz={quiz}
                isActive={quiz.id === activeQuizId}
                onSelect={() => handleReviewQuiz(quiz.id)}
                onDelete={() => handleDeleteQuiz(quiz.id)}
              />
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function QuizHistoryItem({ quiz, isActive, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false);

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  const bestPct = quiz.best_total
    ? Math.round((quiz.best_score / quiz.best_total) * 100)
    : null;

  return (
    <li
      className={`conv-item${isActive ? " conv-item--active" : ""}`}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="conv-item-title">{quiz.title}</div>
      <div className="conv-item-meta">
        <span>{formatDate(quiz.created_at)}</span>
        <span>{quiz.question_count}Q</span>
        {bestPct !== null && (
          <span style={{ color: bestPct >= 70 ? "var(--color-success)" : "var(--color-danger)" }}>
            Best: {bestPct}%
          </span>
        )}
      </div>
      {quiz.attempt_count > 0 && (
        <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: "0.15rem" }}>
          {quiz.attempt_count} attempt{quiz.attempt_count !== 1 ? "s" : ""}
        </div>
      )}
      {hovered && (
        <button
          className="source-remove conv-delete-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete quiz"
        >
          ✕
        </button>
      )}
    </li>
  );
}

function QuizQuestionCard({ question, questionIndex, selectedAnswer, onAnswer, onNext, isLast }) {
  const answered = selectedAnswer !== undefined;
  const isCorrect = answered && selectedAnswer === question.correct_index;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p style={{ fontSize: "1.05rem", fontWeight: 600, lineHeight: 1.5 }}>{question.question}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {question.options.map((option, i) => {
          let bg = "var(--color-surface-2)";
          let border = "var(--color-border)";
          let opacity = 1;
          if (answered) {
            if (i === question.correct_index) { bg = "rgba(34,197,94,0.1)"; border = "var(--color-success)"; }
            else if (i === selectedAnswer) { bg = "rgba(239,68,68,0.1)"; border = "var(--color-danger)"; }
            else { opacity = 0.45; }
          }
          return (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              disabled={answered}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                background: bg, border: `1px solid ${border}`, borderRadius: "var(--radius)",
                padding: "0.7rem 1rem", fontSize: "0.92rem", color: "var(--color-text)",
                textAlign: "left", cursor: answered ? "default" : "pointer", opacity,
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 26, height: 26, borderRadius: "50%",
                background: answered && i === question.correct_index ? "var(--color-success)"
                  : answered && i === selectedAnswer ? "var(--color-danger)"
                  : "var(--color-border)",
                color: answered && (i === question.correct_index || i === selectedAnswer) ? "#fff" : "var(--color-text-muted)",
                fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
              }}>
                {OPTION_LABELS[i]}
              </span>
              <span style={{ flex: 1, lineHeight: 1.4 }}>{option}</span>
              {answered && i === question.correct_index && <span style={{ color: "var(--color-success)", fontWeight: 700 }}>✓</span>}
              {answered && i === selectedAnswer && i !== question.correct_index && <span style={{ color: "var(--color-danger)", fontWeight: 700 }}>✗</span>}
            </button>
          );
        })}
      </div>

      {answered && question.explanation && (
        <div style={{
          display: "flex", gap: "0.6rem", padding: "0.75rem 1rem",
          borderRadius: "var(--radius)", fontSize: "0.86rem", lineHeight: 1.6,
          background: isCorrect ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${isCorrect ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
        }}>
          <span>{isCorrect ? "💡" : "📖"}</span>
          <p>{question.explanation}</p>
        </div>
      )}

      {answered && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-primary" onClick={onNext} style={{ minWidth: 140 }}>
            {isLast ? "See Results 🎉" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}

function QuizResults({ questions, answers, correctCount, onRestart, onNewQuiz, generating }) {
  const total = questions.length;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  let grade = "🔴";
  if (pct >= 90) grade = "🏆";
  else if (pct >= 70) grade = "🟢";
  else if (pct >= 50) grade = "🟡";

  return (
    <div className="session-complete">
      <div className="complete-icon">{grade}</div>
      <h2>Quiz Complete!</h2>
      <p className="complete-subtitle">
        You got <strong>{correctCount}</strong> of <strong>{total}</strong> correct ({pct}%)
      </p>
      <div className="complete-stats">
        <div className="stat-box stat-got-it">
          <div className="stat-number">{correctCount}</div>
          <div className="stat-label">Correct ✓</div>
        </div>
        <div className="stat-box stat-review">
          <div className="stat-number">{total - correctCount}</div>
          <div className="stat-label">Wrong ✗</div>
        </div>
      </div>

      {/* Review wrong answers */}
      {total - correctCount > 0 && (
        <div className="quiz-review-section" style={{ width: "100%", maxWidth: 560, textAlign: "left" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem" }}>📖 Review Wrong Answers</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {questions.map((q, i) => {
              if (answers[i] === q.correct_index) return null;
              return (
                <div key={i} style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: "0.85rem 1rem" }}>
                  <p style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>{q.question}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.82rem" }}>
                    <span style={{ color: "var(--color-danger)" }}>✗ Your answer: {OPTION_LABELS[answers[i]]}. {q.options[answers[i]]}</span>
                    <span style={{ color: "var(--color-success)" }}>✓ Correct: {OPTION_LABELS[q.correct_index]}. {q.options[q.correct_index]}</span>
                  </div>
                  {q.explanation && <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.4rem", lineHeight: 1.5 }}>{q.explanation}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="complete-actions">
        <button className="btn-secondary" onClick={onRestart}>🔄 Retry Same Quiz</button>
        <button className="btn-secondary" onClick={onNewQuiz} disabled={generating}>
          {generating ? <><span className="spinner" />Generating…</> : "✨ New Quiz"}
        </button>
      </div>
    </div>
  );
}
