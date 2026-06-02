import React, { useState } from "react";
import "./FlashCard.css";

/**
 * A single flip card.
 * Props:
 *   front      {string}  - front text (question/term)
 *   back       {string}  - back text (answer/definition)
 *   onGotIt    {fn}      - called when user clicks "Got it ✓"
 *   onReview   {fn}      - called when user clicks "Review later ↩"
 *   index      {number}  - current card number (1-based)
 *   total      {number}  - total cards in deck
 */
export default function FlashCard({ front, back, onGotIt, onReview, index, total }) {
  const [flipped, setFlipped] = useState(false);

  function handleFlip() {
    setFlipped((f) => !f);
  }

  function handleGotIt() {
    setFlipped(false);
    onGotIt();
  }

  function handleReview() {
    setFlipped(false);
    onReview();
  }

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
        <span className="progress-label">{index} / {total}</span>
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

      {/* Action buttons — only shown when card is flipped */}
      <div className={`flashcard-actions ${flipped ? "visible" : ""}`}>
        <button className="btn-danger" onClick={handleReview}>
          ↩ Review Later
        </button>
        <button className="btn-success" onClick={handleGotIt}>
          ✓ Got It
        </button>
      </div>

      {!flipped && (
        <p className="flip-cta">Tap the card to see the answer</p>
      )}
    </div>
  );
}
