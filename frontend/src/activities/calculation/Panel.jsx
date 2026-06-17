/**
 * Calculation / Numerical Activity Panel
 *
 * Displays word problems, lets the user type a numeric answer,
 * validates within tolerance, and shows the step-by-step solution.
 * Uses SM-2 spaced repetition via the existing /study/:deckId page.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateActivity } from "../../api/client.js";
import { ACTIVITY_METADATA } from "../index.js";
import GenerateTimer from "../../components/GenerateTimer.jsx";

export default function CalculationPanel({ deck, onDeckUpdated }) {
  const navigate = useNavigate();
  const meta = ACTIVITY_METADATA.calculation;
  const hasReadySources = deck.source_documents.some((d) => d.status === "ready");

  const [generating, setGenerating] = useState(false);
  const [maxItems, setMaxItems] = useState(20);
  const [error, setError] = useState(null);

  // Interactive review state
  const [cards, setCards] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]);
  const [sessionDone, setSessionDone] = useState(false);

  function getCalcCards() {
    return (deck.flashcards || []).filter((c) => c.activity_type === "calculation");
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const updated = await generateActivity(deck.id, "calculation", { max_items: maxItems });
      onDeckUpdated(updated);
      setCards(updated.flashcards.filter((c) => c.activity_type === "calculation"));
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
    const calcCards = getCalcCards();
    if (calcCards.length === 0) return;
    setCards(calcCards);
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
    const metadata = currentCard.item_metadata || {};
    const correctAnswer = parseFloat(metadata.answer);
    const tolerance = parseFloat(metadata.tolerance || 0.01);
    const userNum = parseFloat(userAnswer.trim());

    if (isNaN(userNum)) return;

    const isCorrect = Math.abs(userNum - correctAnswer) <= tolerance;

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

  const calcCount = getCalcCards().length;

  // ─── Check for activity_type field — the deck might not have it for old cards
  // This is fine — new generations will have it
  const hasCalcItems = calcCount > 0;

  return (
    <div className="calc-panel">
      {/* Generate section */}
      <div className="calc-generate card">
        <div className="calc-generate-header">
          <div>
            <h3>{meta.generate_label}</h3>
            <p className="calc-generate-hint">
              AI will create calculation problems from all{" "}
              {deck.source_documents.length} source
              {deck.source_documents.length !== 1 ? "s" : ""} in this deck.
              {hasCalcItems && " This will replace the existing problems."}
            </p>
          </div>
          <div className="calc-generate-controls">
            <div className="calc-generate-count-control">
              <label className="calc-generate-count-label">
                {meta.max_items_label}
              </label>
              <input
                type="number"
                className="calc-generate-count-input"
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
      {!hasCalcItems && !cards && (
        <div className="calc-empty">
          <div className="calc-empty-icon">🔢</div>
          <h3>No calculation problems yet</h3>
          <p>Generate problems from your sources to start practicing.</p>
        </div>
      )}

      {/* Existing cards — show review bar + list */}
      {hasCalcItems && !cards && (
        <>
          <div className="calc-study-bar">
            <div className="calc-study-bar-info">
              <span className="calc-count">
                {calcCount} problem{calcCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="calc-study-actions">
              <button className="btn-primary" onClick={startReview}>
                ✏️ Practice Now
              </button>
              <button className="btn-secondary" onClick={goStudy}>
                🎯 Study with Spaced Repetition
              </button>
            </div>
          </div>
          <div className="calc-list">
            {getCalcCards().map((card, i) => (
              <CalcPreview key={card.id} card={card} index={i + 1} />
            ))}
          </div>
        </>
      )}

      {/* Active review session */}
      {cards && !sessionDone && cards.length > 0 && (
        <div className="calc-review card">
          <div className="calc-review-header">
            <span className="calc-review-progress">
              {currentIndex + 1} / {cards.length}
            </span>
            <span className="calc-review-stats">
              {results.filter((r) => r.correct).length} correct ·{" "}
              {results.filter((r) => !r.correct).length} incorrect
            </span>
          </div>

          <div className="calc-review-card">
            <div className="calc-question">
              <p>{cards[currentIndex].front}</p>
            </div>

            {cards[currentIndex].item_metadata?.unit && (
              <div className="calc-unit">
                📏 Unit: {cards[currentIndex].item_metadata.unit}
              </div>
            )}

            {!revealed ? (
              <form className="calc-answer-form" onSubmit={handleSubmit}>
                <input
                  className="calc-answer-input"
                  type="number"
                  step="any"
                  placeholder="Type your numeric answer…"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  autoFocus
                />
                <div className="calc-answer-actions">
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
              <div className="calc-feedback">
                <div
                  className={`calc-result ${
                    results[results.length - 1]?.correct
                      ? "calc-result-correct"
                      : "calc-result-incorrect"
                  }`}
                >
                  {results[results.length - 1]?.correct ? "✓ Correct!" : "✗ Incorrect"}
                </div>
                <div className="calc-correct-answer">
                  Answer:{" "}
                  <strong>
                    {cards[currentIndex].item_metadata?.answer ?? cards[currentIndex].back}
                    {cards[currentIndex].item_metadata?.unit
                      ? ` ${cards[currentIndex].item_metadata.unit}`
                      : ""}
                  </strong>
                </div>
                {cards[currentIndex].item_metadata?.solution && (
                  <div className="calc-solution">
                    <span className="calc-solution-label">Solution</span>
                    <p>{cards[currentIndex].item_metadata.solution}</p>
                  </div>
                )}
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

      {cards && cards.length === 0 && !sessionDone && (
        <div className="calc-empty">
          <p>No calculation problems available. Generate some first.</p>
        </div>
      )}

      {/* Session complete */}
      {sessionDone && (
        <CalcSessionComplete
          results={results}
          onRestartMissed={restartSession}
          onRestartAll={restartAll}
          onGoStudy={goStudy}
        />
      )}
    </div>
  );
}

// ─── Card Preview ─────────────────────────────────────────────────────────────

function CalcPreview({ card, index }) {
  const [expanded, setExpanded] = useState(false);
  const metadata = card.item_metadata || {};
  const question = card.front || "";
  const answer = metadata.answer ?? "";
  const unit = metadata.unit || "";
  const solution = metadata.solution || "";

  return (
    <div
      className={`calc-preview card ${expanded ? "expanded" : ""}`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="calc-preview-header">
        <span className="calc-preview-num">#{index}</span>
        <span className="calc-preview-question">
          {question.length > 80
            ? question.slice(0, 80) + "…"
            : question}
        </span>
        <span className="calc-preview-toggle">
          {expanded ? "▲" : "▼"}
        </span>
      </div>
      {expanded && (
        <div className="calc-preview-answer">
          <span className="calc-preview-answer-label">Answer</span>
          <p>
            {answer}
            {unit ? ` ${unit}` : ""}
          </p>
          {solution && (
            <>
              <span className="calc-preview-solution-label">Solution</span>
              <p className="calc-preview-solution">{solution}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Session Complete ─────────────────────────────────────────────────────────

function CalcSessionComplete({
  results,
  onRestartMissed,
  onRestartAll,
  onGoStudy,
}) {
  const sessionTotal = results.length;
  const correctCount = results.filter((r) => r.correct).length;
  const incorrectCount = sessionTotal - correctCount;
  const pct = sessionTotal > 0 ? Math.round((correctCount / sessionTotal) * 100) : 0;

  return (
    <div className="calc-session-complete">
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