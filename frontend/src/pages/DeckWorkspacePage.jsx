import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addDocumentToDeck,
  chatWithDeck,
  generateDeckFlashcards,
  generateDeckQuiz,
  getDeck,
  getDueCards,
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
            <ChatPanel deck={deck} />
          ) : activeTab === "flashcards" ? (
            <FlashcardsPanel deck={deck} onDeckUpdated={setDeck} />
          ) : (
            <QuizPanel deck={deck} />
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

// ─── Quiz Panel ───────────────────────────────────────────────────────────────

const OPTION_LABELS = ["A", "B", "C", "D"];

function QuizPanel({ deck }) {
  const [questions, setQuestions] = useState([]);
  const [maxQuestions, setMaxQuestions] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quizDone, setQuizDone] = useState(false);

  const hasReadySources = deck.source_documents.some((d) => d.status === "ready");

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setAnswers({});
    setCurrentIndex(0);
    setQuizDone(false);
    try {
      const data = await generateDeckQuiz(deck.id, maxQuestions);
      setQuestions(data.questions);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function handleAnswer(questionIndex, optionIndex) {
    if (answers[questionIndex] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  }

  function handleNext() {
    if (currentIndex + 1 >= questions.length) {
      setQuizDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  function handleRestart() {
    setAnswers({});
    setCurrentIndex(0);
    setQuizDone(false);
  }

  const correctCount = questions.filter((q, i) => answers[i] === q.correct_index).length;

  // ── Empty / generate state ──────────────────────────────────────────────────
  if (questions.length === 0) {
    return (
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
          <h3>No quiz yet</h3>
          <p>Generate a multiple-choice quiz from your sources to test your knowledge.</p>
        </div>
      </div>
    );
  }

  // ── Results ─────────────────────────────────────────────────────────────────
  if (quizDone) {
    const total = questions.length;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    let grade = "🔴";
    if (pct >= 90) grade = "🏆";
    else if (pct >= 70) grade = "🟢";
    else if (pct >= 50) grade = "🟡";

    return (
      <div className="flashcards-panel" style={{ overflowY: "auto" }}>
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
          <div className="complete-actions">
            <button className="btn-secondary" onClick={handleRestart}>🔄 Retry Same Quiz</button>
            <button className="btn-secondary" onClick={handleGenerate} disabled={generating}>
              {generating ? <><span className="spinner" />Generating…</> : "✨ New Quiz"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active question ─────────────────────────────────────────────────────────
  const q = questions[currentIndex];
  const selectedAnswer = answers[currentIndex];
  const answered = selectedAnswer !== undefined;
  const isCorrect = answered && selectedAnswer === q.correct_index;
  const isLast = currentIndex + 1 >= questions.length;

  return (
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
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <p style={{ fontSize: "1.05rem", fontWeight: 600, lineHeight: 1.5 }}>{q.question}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {q.options.map((option, i) => {
            let bg = "var(--color-surface-2)";
            let border = "var(--color-border)";
            let opacity = 1;
            if (answered) {
              if (i === q.correct_index) { bg = "rgba(34,197,94,0.1)"; border = "var(--color-success)"; }
              else if (i === selectedAnswer) { bg = "rgba(239,68,68,0.1)"; border = "var(--color-danger)"; }
              else { opacity = 0.45; }
            }
            return (
              <button
                key={i}
                onClick={() => handleAnswer(currentIndex, i)}
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
                  background: answered && i === q.correct_index ? "var(--color-success)"
                    : answered && i === selectedAnswer ? "var(--color-danger)"
                    : "var(--color-border)",
                  color: answered && (i === q.correct_index || i === selectedAnswer) ? "#fff" : "var(--color-text-muted)",
                  fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
                }}>
                  {OPTION_LABELS[i]}
                </span>
                <span style={{ flex: 1, lineHeight: 1.4 }}>{option}</span>
                {answered && i === q.correct_index && <span style={{ color: "var(--color-success)", fontWeight: 700 }}>✓</span>}
                {answered && i === selectedAnswer && i !== q.correct_index && <span style={{ color: "var(--color-danger)", fontWeight: 700 }}>✗</span>}
              </button>
            );
          })}
        </div>

        {answered && q.explanation && (
          <div style={{
            display: "flex", gap: "0.6rem", padding: "0.75rem 1rem",
            borderRadius: "var(--radius)", fontSize: "0.86rem", lineHeight: 1.6,
            background: isCorrect ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${isCorrect ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
          }}>
            <span>{isCorrect ? "💡" : "📖"}</span>
            <p>{q.explanation}</p>
          </div>
        )}

        {answered && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn-primary" onClick={handleNext} style={{ minWidth: 140 }}>
              {isLast ? "See Results 🎉" : "Next →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
