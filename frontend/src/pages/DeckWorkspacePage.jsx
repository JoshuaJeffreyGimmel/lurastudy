/**
 * Deck Workspace Page
 *
 * Dynamic tab bar driven by the activity type registry.
 * Each registered activity type gets a tab powered by its registered component.
 * Chat is a built-in tab (not an activity type).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addDocumentToDeck,
  chatInConversation,
  createConversation,
  deleteConversation,
  getDeck,
  listConversations,
  removeDocumentFromDeck,
  updateDeck,
  uploadDocument,
} from "../api/client.js";
import { ACTIVITY_COMPONENTS, ACTIVITY_METADATA } from "../activities/index.js";
import "./DeckWorkspacePage.css";

// ─── Main Workspace ───────────────────────────────────────────────────────────

export default function DeckWorkspacePage() {
  const { deckId } = useParams();
  const navigate = useNavigate();

  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [deckVersion, setDeckVersion] = useState(0);

  function handleDeckUpdated(updated) {
    setDeck(updated);
    setDeckVersion((v) => v + 1);
  }

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

  // Determine which tabs to show (chat + all registered activity types)
  const activityTypeIds = Object.keys(ACTIVITY_COMPONENTS);

  // Get the component for the active activity tab
  const ActivePanel = activeTab !== "chat" ? ACTIVITY_COMPONENTS[activeTab] : null;

  return (
    <div className="workspace">
      {/* ─── Sidebar ──────────────────────────────────────────────────────── */}
      <WorkspaceSidebar
        deck={deck}
        onDeckUpdated={handleDeckUpdated}
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
          {activityTypeIds.map((id) => {
            const meta = ACTIVITY_METADATA[id];
            return (
              <button
                key={id}
                className={`workspace-tab ${activeTab === id ? "active" : ""}`}
                onClick={() => setActiveTab(id)}
              >
                {meta.icon} {meta.name}
                {/* Show count badges for flashcard-like activities */}
                {meta.has_spaced_repetition && deck.flashcards && deck.flashcards.length > 0 && (
                  <span className="tab-badge">{deck.flashcards.length}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="workspace-content">
          {activeTab === "chat" ? (
            <ChatTab deck={deck} />
          ) : ActivePanel ? (
            <ActivePanel deck={deck} onDeckUpdated={handleDeckUpdated} />
          ) : (
            <div className="workspace-error">
              <div className="banner banner-error">Unknown activity type: {activeTab}</div>
            </div>
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
            <button className="conv-new-btn" onClick={handleNewChat}>+ New Chat</button>

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

    const tempUserMsg = { id: "temp-user", role: "user", content: userMessage };
    setMessages((prev) => [...prev, tempUserMsg]);
    setSending(true);

    try {
      const replyMsg = await chatInConversation(convId, userMessage);
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
      if (messages.length === 0) {
        onTitleUpdate(userMessage.slice(0, 60) + (userMessage.length > 60 ? "…" : ""));
      }
    } catch (e) {
      setError(e.message);
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