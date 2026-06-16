import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDeck, updateFlashcardState } from "../api/client.js";
import FlashCard from "../components/FlashCard.jsx";
import "./StudyPage.css";

export default function StudyPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const backPath = `/decks/${deckId}`;

  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Study session state
  const [queue, setQueue] = useState([]); // cards still to review
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gotItIds, setGotItIds] = useState(new Set());
  const [reviewIds, setReviewIds] = useState(new Set());
  const [sessionDone, setSessionDone] = useState(false);

  useEffect(() => {
    getDeck(deckId)
      .then((data) => {
        setDeck(data);
        setQueue(data.flashcards);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [deckId]);

  async function handleGotIt() {
    const card = queue[currentIndex];
    setGotItIds((s) => new Set([...s, card.id]));
    // Persist state to backend (fire-and-forget)
    updateFlashcardState(card.id, true).catch(() => {});
    advance();
  }

  async function handleReview() {
    const card = queue[currentIndex];
    setReviewIds((s) => new Set([...s, card.id]));
    updateFlashcardState(card.id, false).catch(() => {});
    advance();
  }

  function advance() {
    if (currentIndex + 1 >= queue.length) {
      setSessionDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  function restartReview() {
    // Only keep cards marked "review later"
    const reviewCards = queue.filter((c) => reviewIds.has(c.id));
    if (reviewCards.length === 0) {
      setSessionDone(true);
      return;
    }
    setQueue(reviewCards);
    setCurrentIndex(0);
    setGotItIds(new Set());
    setReviewIds(new Set());
    setSessionDone(false);
  }

  function restartAll() {
    setQueue(deck.flashcards);
    setCurrentIndex(0);
    setGotItIds(new Set());
    setReviewIds(new Set());
    setSessionDone(false);
  }

  if (loading) return <div className="study-page"><p><span className="spinner" />Loading deck…</p></div>;
  if (error) return <div className="study-page"><div className="banner banner-error">{error}</div></div>;
  if (!deck) return null;

  const totalCards = deck.flashcards.length;
  const currentCard = queue[currentIndex];

  return (
    <div className="study-page">
      <div className="study-header">
        <button className="btn-secondary back-btn" onClick={() => navigate(backPath)}>
          ← Back to Deck
        </button>
        <div className="study-title">
          <h1>{deck.title}</h1>
          <span className="study-stats">
            {gotItIds.size} got it · {reviewIds.size} to review · {totalCards} total
          </span>
        </div>
      </div>

      {sessionDone ? (
        <SessionComplete
          gotItCount={gotItIds.size}
          reviewCount={reviewIds.size}
          totalCount={totalCards}
          onRestartReview={restartReview}
          onRestartAll={restartAll}
          onGoHome={() => navigate(backPath)}
        />
      ) : (
        <FlashCard
          key={currentCard.id}
          front={currentCard.front}
          back={currentCard.back}
          onGotIt={handleGotIt}
          onReview={handleReview}
          index={currentIndex + 1}
          total={queue.length}
        />
      )}
    </div>
  );
}

function SessionComplete({ gotItCount, reviewCount, totalCount, onRestartReview, onRestartAll, onGoHome }) {
  const pct = Math.round((gotItCount / totalCount) * 100);

  return (
    <div className="session-complete">
      <div className="complete-icon">🎉</div>
      <h2>Session Complete!</h2>
      <p className="complete-subtitle">
        You got <strong>{gotItCount}</strong> of <strong>{totalCount}</strong> cards correct ({pct}%)
      </p>

      <div className="complete-stats">
        <div className="stat-box stat-got-it">
          <div className="stat-number">{gotItCount}</div>
          <div className="stat-label">Got It ✓</div>
        </div>
        <div className="stat-box stat-review">
          <div className="stat-number">{reviewCount}</div>
          <div className="stat-label">Review Later ↩</div>
        </div>
      </div>

      <div className="complete-actions">
        {reviewCount > 0 && (
          <button className="btn-warning" onClick={onRestartReview}>
            ↩ Review {reviewCount} Missed Card{reviewCount !== 1 ? "s" : ""}
          </button>
        )}
        <button className="btn-secondary" onClick={onRestartAll}>
          🔄 Restart All Cards
        </button>
        <button className="btn-primary" onClick={onGoHome}>
          🏠 Back to Deck
        </button>
      </div>
    </div>
  );
}
