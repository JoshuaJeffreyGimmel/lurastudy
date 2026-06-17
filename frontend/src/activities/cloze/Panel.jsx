/**
 * Cloze / Fill-in-the-Blank Activity Panel
 *
 * Displays generated sentences with a blank, lets the user type the answer,
 * and shows correct/incorrect feedback. Generated items are stored as
 * Flashcard records with `activity_type="cloze"` and use SM-2 spaced
 * repetition via the existing /study/:deckId page.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateActivity } from "../../api/client.js";
import { ACTIVITY_METADATA } from "../index.js";
import GenerateTimer from "../../components/GenerateTimer.jsx";

export default function ClozePanel({ deck, onDeckUpdated }) {
  const navigate = useNavigate();
  const meta = ACTIVITY_METADATA.cloze;
  const hasReadySources = deck.source_documents.some((d) => d.status === "ready");

  const [generating, setGenerating] = useState(false);
  const [maxItems, setMaxItems] = useState(20);
  const [error, setError] = useState(null);

  // Interactive review state
  const [cards, setCards] = useState(null); // null = not loaded, array = loaded
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]); // { correct: bool, card }
  const [sessionDone, setSessionDone] = useState(false);

  function getClozeCards() {
    // Filter deck.flashcards for items with activity_type === "cloze"
    // Note: if the deck was just generated, we receive it inline.
    return (deck.flashcards || []).filter((c) => c.activity_type === "cloze");
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const updated = await generateActivity(deck.id, "cloze", { max_items: maxItems });
      onDeckUpdated(updated);
      // Start the review session with the new cards
      setCards(updated.flashcards.filter((c) => c.activity_type === "cloze"));
      setCurrentIndex(0);
      setUserAnswer("");
      setRevealed(false);
      setResults([]);
      setSessionDone(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function startReview() {
    const clozeCards = getClozeCards();
    if (clozeCards.length === 0) return;
    setCards(clozeCards);
    setCurrentIndex(0);
    setUserAnswer("");
    setRevealed(false);
    setResults([]);
    setSessionDone(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!userAnswer.trim()) return;

    const currentCard = cards[currentIndex];
    // Get the original item_metadata to access the full data
    const metadata = currentCard.item_metadata || {};
    const correctAnswer = metadata.answer || currentCard.back;

    // Case-insensitive comparison, trimmed
    const isCorrect =
      userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

    setResults((prev) => [...prev, { correct: isCorrect, card: currentCard }]);
    setRevealed(true);
  }

  function handleNext() {
    if (currentIndex + 1 >= cards.length) {
      setSessionDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setUserAnswer("");
      setRevealed(false);
    }
  }

  function handleSkip() {
    const currentCard = cards[currentIndex];
    setResults((prev) => [...prev, { correct: false, card: currentCard }]);
    setRevealed(true);
  }

  function restartSession() {
    const missedCards = cards.filter((_, i) => {
      const result = results[i];
      return result && !result.correct;
    });
    if (missedCards.length === 0) {
      setSessionDone(true);
      return;
    }
    setCards(missedCards);
    setCurrentIndex(0);
    setUserAnswer("");
    setRevealed(false);
    setResults([]);
    setSessionDone(false);
  }

  function restartAll() {
    startReview();
  }

  function goStudy() {
    navigate(`/study/${deck.id}`);
  }

  // ─── Render ────────────────────────────────────────────────────────────

  const clozeCount = getClozeCards().length;

  return (
    <div className="cloze-panel">
      {/* Generate section */}
      <div className="card">
        <div className="flashcards-generate-header" style={{ padding: "1.25rem" }}>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.25rem" }}>{meta.generate_label}</h3>
            <p className="generate-hint">
              AI will create fill-in-the-blank sentences from all{" "}
              {deck.source_documents.length} source
              {deck.source_documents.length !== 1 ? "s" : ""} in this deck.
              {clozeCount > 0 && " This will replace the existing cards."}
            </p>
          </div>
          <div className="generate-controls">
            <div className="generate-count-control">
              <label className="generate-count-label">
                {meta.max_items_label}
              </label>
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
                <>
                  <span className="spinner" />
                  Generating… <GenerateTimer generating={generating} />
                </>
              ) : (
                meta.generate_label
              )}
            </button>
          </div>
        </div>
        {error && (
          <div className="banner banner-error" style={{ marginTop: "1rem" }}>
            {error}
          </div>
        )}
      </div>

      {/* No cards yet */}
      {clozeCount === 0 && !cards && (
        <div className="cloze-empty">
          <div className="cloze-empty-icon">📝</div>
          <h3>No fill-in-the-blank cards yet</h3>
          <p>Generate cards from your sources to start practicing.</p>
        </div>
      )}

      {/* Existing cards — show a review bar + list or start review */}
      {clozeCount > 0 && !cards && (
        <>
          <div className="cloze-study-bar">
            <div className="cloze-study-bar-info">
              <span className="cloze-count">
                {clozeCount} card{clozeCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="cloze-study-actions">
              <button className="btn-primary" onClick={startReview}>
                ✏️ Practice Now
              </button>
              <button className="btn-secondary" onClick={goStudy}>
                🎯 Study with Spaced Repetition
              </button>
            </div>
          </div>
          <div className="cloze-list">
            {getClozeCards().map((card, i) => (
              <ClozePreview key={card.id} card={card} index={i + 1} />
            ))}
          </div>
        </>
      )}

      {/* Active review session */}
      {cards && !sessionDone && cards.length > 0 && (
        <div className="cloze-review card">
          <div className="cloze-review-header">
            <span className="cloze-review-progress">
              {currentIndex + 1} / {cards.length}
            </span>
            <span className="cloze-review-stats">
              {results.filter((r) => r.correct).length} correct ·{" "}
              {results.filter((r) => !r.correct).length} incorrect
            </span>
          </div>

          <div className="cloze-review-card">
            <div className="cloze-sentence">
              {renderSentence(cards[currentIndex])}
            </div>

            {cards[currentIndex].item_metadata?.hint && (
              <div className="cloze-hint">
                💡 Hint: {cards[currentIndex].item_metadata.hint}
              </div>
            )}

            {!revealed ? (
              <form className="cloze-answer-form" onSubmit={handleSubmit}>
                <input
                  className="cloze-answer-input"
                  type="text"
                  placeholder="Type the missing word…"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  autoFocus
                />
                <div className="cloze-answer-actions">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={!userAnswer.trim()}
                  >
                    Check
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleSkip}
                  >
                    Skip
                  </button>
                </div>
              </form>
            ) : (
              <div className="cloze-feedback">
                <div
                  className={`cloze-result ${
                    results[results.length - 1]?.correct
                      ? "cloze-result-correct"
                      : "cloze-result-incorrect"
                  }`}
                >
                  {results[results.length - 1]?.correct ? "✓ Correct!" : "✗ Incorrect"}
                </div>
                <div className="cloze-correct-answer">
                  Answer:{" "}
                  <strong>
                    {cards[currentIndex].item_metadata?.answer ||
                      cards[currentIndex].back}
                  </strong>
                </div>
                <button className="btn-primary" onClick={handleNext}>
                  {currentIndex + 1 >= cards.length
                    ? "See Results"
                    : "Next →"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cards exist but we filtered to zero (shouldn't happen often) */}
      {cards && cards.length === 0 && !sessionDone && (
        <div className="cloze-empty">
          <p>No cloze cards available. Generate some first.</p>
        </div>
      )}

      {/* Session complete */}
      {sessionDone && (
        <ClozeSessionComplete
          results={results}
          totalCards={getClozeCards().length}
          onRestartMissed={restartSession}
          onRestartAll={restartAll}
          onGoStudy={goStudy}
        />
      )}
    </div>
  );
}

// ─── Sentence Renderer ────────────────────────────────────────────────────────

function renderSentence(card) {
  const sentence = card.item_metadata?.sentence || card.front || "";
  // Split on "______" and highlight the blank
  const parts = sentence.split("______");
  if (parts.length === 1) {
    // No blank found — show as-is
    return <p>{sentence}</p>;
  }
  return (
    <p>
      {parts[0]}
      <span className="cloze-blank">______</span>
      {parts.slice(1).join("")}
    </p>
  );
}

// ─── Card Preview ─────────────────────────────────────────────────────────────

function ClozePreview({ card, index }) {
  const [expanded, setExpanded] = useState(false);
  const metadata = card.item_metadata || {};
  const sentence = metadata.sentence || card.front || "";
  const answer = metadata.answer || card.back || "";

  return (
    <div
      className={`cloze-preview card ${expanded ? "expanded" : ""}`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="cloze-preview-header">
        <span className="cloze-preview-num">#{index}</span>
        <span className="cloze-preview-sentence">
          {sentence.length > 80
            ? sentence.slice(0, 80) + "…"
            : sentence}
        </span>
        <span className="cloze-preview-toggle">
          {expanded ? "▲" : "▼"}
        </span>
      </div>
      {expanded && (
        <div className="cloze-preview-answer">
          <span className="cloze-preview-answer-label">Answer</span>
          <p>{answer}</p>
          {metadata.hint && (
            <p className="cloze-preview-hint">💡 {metadata.hint}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Session Complete ─────────────────────────────────────────────────────────

function ClozeSessionComplete({
  results,
  totalCards,
  onRestartMissed,
  onRestartAll,
  onGoStudy,
}) {
  const sessionTotal = results.length;
  const correctCount = results.filter((r) => r.correct).length;
  const incorrectCount = sessionTotal - correctCount;
  const pct = sessionTotal > 0 ? Math.round((correctCount / sessionTotal) * 100) : 0;

  return (
    <div className="cloze-session-complete">
      <div className="complete-icon">🎉</div>
      <h2>Practice Complete!</h2>
      <p className="complete-subtitle">
        You got <strong>{correctCount}</strong> of{" "}
        <strong>{sessionTotal}</strong> correct ({pct}%)
      </p>

      <div className="complete-stats">
        <div className="stat-box stat-got-it">
          <div className="stat-number">{correctCount}</div>
          <div className="stat-label">Correct ✓</div>
        </div>
        <div className="stat-box stat-review">
          <div className="stat-number">{incorrectCount}</div>
          <div className="stat-label">Incorrect ✗</div>
        </div>
      </div>

      <div className="complete-actions">
        {incorrectCount > 0 && (
          <button className="btn-warning" onClick={onRestartMissed}>
            ↩ Retry {incorrectCount} Missed
          </button>
        )}
        <button className="btn-secondary" onClick={onRestartAll}>
          🔄 Practice All Again
        </button>
        <button className="btn-primary" onClick={onGoStudy}>
          🎯 Study with Spaced Repetition
        </button>
      </div>
    </div>
  );
}