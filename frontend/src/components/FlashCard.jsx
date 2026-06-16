import React, { useState } from "react";
import "./FlashCard.css";

/**
 * A single flip card with SM-2 rating buttons.
 * Props:
 *   front        {string}  - front text (question/term)
 *   back         {string}  - back text (answer/definition)
 *   onEasy       {fn}      - called when user clicks "Easy ⚡" (quality 5)
 *   onGotIt      {fn}      - called when user clicks "Got It ✓" (quality 4)
 *   onAgain      {fn}      - called when user clicks "Again ↩" (quality 1)
 *   index        {number}  - current card number (1-based)
 *   total        {number}  - total cards in session
 *   dueLabel     {string}  - human-readable due status ("New", "Due today", "3d overdue", …)
 *   repetitions  {number}  - SM-2 repetition count (0 = new card)
 */
export default function FlashCard({
  front,
  back,
  onEasy,
  onGotIt,
  onAgain,
  index,
  total,
  dueLabel = "New",
  repetitions = 0,
}) {
  const [flipped, setFlipped] = useState(false);

  function handleFlip() {
    setFlipped((f) => !f);
  }

  function handleEasy() {
    setFlipped(false);
    onEasy();
  }

  function handleGotIt() {
    setFlipped(false);
    onGotIt();
  }

  function handleAgain() {
    setFlipped(false);
    onAgain();
  }

  const isNew = repetitions === 0;
  const dueLabelClass = dueLabel.includes("overdue")
    ? "due-label due-label-overdue"
    : dueLabel === "New"
    ? "due-label due-label-new"
    : "due-label due-label-today";

  return (
    <div className="flashcard-wrapper">
      {/* Progress indicator */}
      <div className="flashcard-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
        <div className="progress-meta">
          <span className="progress-label">{index} / {total}</span>
          <span className={dueLabelClass}>{dueLabel}</span>
          {!isNew && (
            <span className="rep-label" title="Times reviewed correctly in a row">
              🔁 {repetitions}
            </span>
          )}
        </div>
      </div>

      {/* The card itself */}
      <div
        className={`flashcard ${flipped ? "flipped" : ""}`}
        onClick={handleFlip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleFlip()}
        aria-label={flipped ? "Card back — click to flip" : "Card front — click to flip"}
      >
        <div className="flashcard-inner">
          <div className="flashcard-face flashcard-front">
            <span className="face-label">Question</span>
            <p className="face-text">{front}</p>
            <span className="flip-hint">Click to reveal answer</span>
          </div>
          <div className="flashcard-face flashcard-back">
            <span className="face-label">Answer</span>
            <p className="face-text">{back}</p>
          </div>
        </div>
      </div>

      {/* SM-2 rating buttons — only shown when card is flipped */}
      <div className={`flashcard-actions ${flipped ? "visible" : ""}`}>
        <button className="btn-danger rating-btn rating-again" onClick={handleAgain} title="Incorrect — review again soon">
          <span className="rating-icon">↩</span>
          <span className="rating-label">Again</span>
          <span className="rating-hint">~1 day</span>
        </button>
        <button className="btn-success rating-btn rating-got-it" onClick={handleGotIt} title="Correct with some effort">
          <span className="rating-icon">✓</span>
          <span className="rating-label">Got It</span>
          <span className="rating-hint">good</span>
        </button>
        <button className="btn-easy rating-btn rating-easy" onClick={handleEasy} title="Perfect recall — longer interval">
          <span className="rating-icon">⚡</span>
          <span className="rating-label">Easy</span>
          <span className="rating-hint">longer</span>
        </button>
      </div>

      {!flipped && (
        <p className="flip-cta">Tap the card to see the answer</p>
      )}
    </div>
  );
}
