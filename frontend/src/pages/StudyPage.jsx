import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDeck, getDueCards, reviewFlashcard } from "../api/client.js";
import FlashCard from "../components/FlashCard.jsx";
import "./StudyPage.css";

// ─── SM-2 quality constants ───────────────────────────────────────────────────
const QUALITY_EASY = 5;   // Perfect recall
const QUALITY_GOT_IT = 4; // Correct with hesitation
const QUALITY_AGAIN = 1;  // Incorrect / review later

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDueDate(dueDateStr) {
  if (!dueDateStr) return "New";
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays}d`;
}

function formatNextReview(intervalDays) {
  if (intervalDays === 1) return "tomorrow";
  if (intervalDays < 7) return `in ${intervalDays} days`;
  if (intervalDays < 30) return `in ${Math.round(intervalDays / 7)} week${Math.round(intervalDays / 7) !== 1 ? "s" : ""}`;
  return `in ${Math.round(intervalDays / 30)} month${Math.round(intervalDays / 30) !== 1 ? "s" : ""}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudyPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const backPath = `/decks/${deckId}`;

  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Study session state
  const [queue, setQueue] = useState([]);       // cards still to review this session
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [studyMode, setStudyMode] = useState("due"); // "due" | "all"

  // Per-session result tracking
  const [results, setResults] = useState([]); // { card, quality, newInterval }

  // Due card counts (from initial load)
  const [dueCount, setDueCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    Promise.all([getDeck(deckId), getDueCards(deckId)])
      .then(([deckData, dueData]) => {
        setDeck(deckData);
        setDueCount(dueData.due_count);
        setTotalCount(dueData.total_count);

        // Default to due cards; fall back to all cards if nothing is due
        if (dueData.due_count > 0) {
          setQueue(dueData.due_cards);
          setStudyMode("due");
        } else {
          // No due cards — offer all cards as fallback
          setQueue(deckData.flashcards);
          setStudyMode("all");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [deckId]);

  async function handleRate(quality) {
    const card = queue[currentIndex];

    // Fire SM-2 review to backend (fire-and-forget, but capture result for UI)
    let newInterval = card.sm2_interval;
    try {
      const updated = await reviewFlashcard(card.id, quality);
      newInterval = updated.sm2_interval;
    } catch (_) {
      // Non-fatal — session continues even if backend call fails
    }

    setResults((prev) => [...prev, { card, quality, newInterval }]);
    advance();
  }

  function advance() {
    if (currentIndex + 1 >= queue.length) {
      setSessionDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  function switchToAllCards() {
    if (!deck) return;
    setQueue(deck.flashcards);
    setStudyMode("all");
    setCurrentIndex(0);
    setResults([]);
    setSessionDone(false);
  }

  function restartSession() {
    // Re-queue only cards that were rated "again" (quality < 3)
    const againCards = results
      .filter((r) => r.quality < 3)
      .map((r) => r.card);
    if (againCards.length === 0) {
      setSessionDone(true);
      return;
    }
    setQueue(againCards);
    setCurrentIndex(0);
    setResults([]);
    setSessionDone(false);
  }

  function restartAll() {
    setQueue(studyMode === "due" ? queue : (deck?.flashcards ?? []));
    setCurrentIndex(0);
    setResults([]);
    setSessionDone(false);
  }

  if (loading) return <div className="study-page"><p><span className="spinner" />Loading deck…</p></div>;
  if (error) return <div className="study-page"><div className="banner banner-error">{error}</div></div>;
  if (!deck) return null;

  const currentCard = queue[currentIndex];
  const againCount = results.filter((r) => r.quality < 3).length;
  const correctCount = results.filter((r) => r.quality >= 3).length;

  return (
    <div className="study-page">
      <div className="study-header">
        <button className="btn-secondary back-btn" onClick={() => navigate(backPath)}>
          ← Back to Deck
        </button>
        <div className="study-title">
          <h1>{deck.title}</h1>
          <div className="study-header-meta">
            <span className="study-stats">
              {correctCount} correct · {againCount} again · {queue.length} in session
            </span>
            {studyMode === "due" && dueCount > 0 && (
              <span className="due-badge">📅 {dueCount} due today</span>
            )}
            {studyMode === "all" && dueCount === 0 && (
              <span className="no-due-badge">✅ All caught up!</span>
            )}
          </div>
        </div>
      </div>

      {/* If no due cards, show a notice with option to study all */}
      {studyMode === "all" && dueCount === 0 && !sessionDone && queue.length > 0 && (
        <div className="banner banner-info study-mode-notice">
          🎉 No cards are due today — studying all {totalCount} cards for extra practice.
        </div>
      )}

      {sessionDone ? (
        <SessionComplete
          results={results}
          totalCount={totalCount}
          dueCount={dueCount}
          againCount={againCount}
          correctCount={correctCount}
          onRestartAgain={restartSession}
          onRestartAll={restartAll}
          onStudyAll={dueCount > 0 ? switchToAllCards : null}
          onGoHome={() => navigate(backPath)}
        />
      ) : queue.length === 0 ? (
        <div className="study-page-empty">
          <div className="empty-icon">🃏</div>
          <h2>No cards to study</h2>
          <p>This deck has no flashcards yet. Generate some from the deck workspace.</p>
          <button className="btn-primary" onClick={() => navigate(backPath)}>
            ← Back to Deck
          </button>
        </div>
      ) : (
        <FlashCard
          key={currentCard.id}
          front={currentCard.front}
          back={currentCard.back}
          onEasy={() => handleRate(QUALITY_EASY)}
          onGotIt={() => handleRate(QUALITY_GOT_IT)}
          onAgain={() => handleRate(QUALITY_AGAIN)}
          index={currentIndex + 1}
          total={queue.length}
          dueLabel={formatDueDate(currentCard.due_date)}
          repetitions={currentCard.sm2_repetitions}
        />
      )}
    </div>
  );
}

// ─── Session Complete ─────────────────────────────────────────────────────────

function SessionComplete({
  results,
  totalCount,
  dueCount,
  againCount,
  correctCount,
  onRestartAgain,
  onRestartAll,
  onStudyAll,
  onGoHome,
}) {
  const sessionTotal = results.length;
  const pct = sessionTotal > 0 ? Math.round((correctCount / sessionTotal) * 100) : 0;

  // Show next-review info for correctly answered cards
  const reviewedCards = results.filter((r) => r.quality >= 3);

  return (
    <div className="session-complete">
      <div className="complete-icon">🎉</div>
      <h2>Session Complete!</h2>
      <p className="complete-subtitle">
        You got <strong>{correctCount}</strong> of <strong>{sessionTotal}</strong> cards correct ({pct}%)
      </p>

      <div className="complete-stats">
        <div className="stat-box stat-got-it">
          <div className="stat-number">{correctCount}</div>
          <div className="stat-label">Correct ✓</div>
        </div>
        <div className="stat-box stat-review">
          <div className="stat-number">{againCount}</div>
          <div className="stat-label">Again ↩</div>
        </div>
      </div>

      {/* Next review schedule for correctly answered cards */}
      {reviewedCards.length > 0 && (
        <div className="next-review-section">
          <h3 className="next-review-title">📅 Next Review Schedule</h3>
          <div className="next-review-list">
            {reviewedCards.slice(0, 5).map(({ card, newInterval }) => (
              <div key={card.id} className="next-review-item">
                <span className="next-review-front">{card.front}</span>
                <span className="next-review-when">
                  {formatNextReview(newInterval)}
                </span>
              </div>
            ))}
            {reviewedCards.length > 5 && (
              <div className="next-review-more">
                +{reviewedCards.length - 5} more cards scheduled
              </div>
            )}
          </div>
        </div>
      )}

      <div className="complete-actions">
        {againCount > 0 && (
          <button className="btn-warning" onClick={onRestartAgain}>
            ↩ Retry {againCount} Missed Card{againCount !== 1 ? "s" : ""}
          </button>
        )}
        {onStudyAll && (
          <button className="btn-secondary" onClick={onStudyAll}>
            📚 Study All {totalCount} Cards
          </button>
        )}
        <button className="btn-secondary" onClick={onRestartAll}>
          🔄 Restart Session
        </button>
        <button className="btn-primary" onClick={onGoHome}>
          🏠 Back to Deck
        </button>
      </div>
    </div>
  );
}
