/**
 * Flashcard Activity Panel
 *
 * Extracted from DeckWorkspacePage's FlashcardsPanel — provides
 * generate controls and flashcard preview list.
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateActivity, getDueCards } from "../../api/client.js";
import { ACTIVITY_METADATA } from "../index.js";

export default function FlashcardPanel({ deck, onDeckUpdated }) {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [maxItems, setMaxItems] = useState(20);
  const [error, setError] = useState(null);
  const [dueCount, setDueCount] = useState(null);

  const meta = ACTIVITY_METADATA.flashcard;
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
      const updated = await generateActivity(deck.id, "flashcard", { max_items: maxItems });
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
            <h3>{meta.generate_label}</h3>
            <p className="generate-hint">
              AI will create flashcards from all {deck.source_documents.length} source
              {deck.source_documents.length !== 1 ? "s" : ""} in this deck.
              {deck.flashcards.length > 0 && " This will replace the existing cards."}
            </p>
          </div>
          <div className="generate-controls">
            <div className="generate-count-control">
              <label className="generate-count-label">{meta.max_items_label}</label>
              <input
                type="number"
                className="generate-count-input"
                min={5}
                max={50}
                value={maxItems}
                onChange={(e) => setMaxItems(Number(e.target.value))}
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
                meta.generate_label
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