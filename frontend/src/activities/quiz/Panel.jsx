/**
 * Quiz Activity Panel
 *
 * Extracted from DeckWorkspacePage's QuizTab and QuizPage — provides
 * generate controls, quiz taking UI, and results.
 */
import React, { useEffect, useState } from "react";
import {
  generateActivity,
  deleteQuiz,
  getQuiz,
  listQuizHistory,
  saveQuiz,
  saveQuizAttempt,
} from "../../api/client.js";
import { ACTIVITY_METADATA } from "../index.js";
import GenerateTimer from "../../components/GenerateTimer.jsx";

const OPTION_LABELS = ["A", "B", "C", "D"];

export default function QuizPanel({ deck }) {
  const [quizHistory, setQuizHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeView, setActiveView] = useState("generate"); // "generate" | "active" | "results"
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [error, setError] = useState(null);

  // Active quiz session state
  const [questions, setQuestions] = useState([]);
  const [maxItems, setMaxItems] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [savedAttemptId, setSavedAttemptId] = useState(null);

  const meta = ACTIVITY_METADATA.quiz;
  const hasReadySources = deck.source_documents.some((d) => d.status === "ready");

  // Load quiz history — re-fetch when flashcards change (new generation)
  useEffect(() => {
    listQuizHistory(deck.id)
      .then((data) => setQuizHistory(data.quizzes))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingHistory(false));
  }, [deck.id, deck.flashcards.length]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setAnswers({});
    setCurrentIndex(0);
    setQuizDone(false);
    setSavedAttemptId(null);
    try {
      const data = await generateActivity(deck.id, "quiz", { max_items: maxItems });
      setQuestions(data.questions || data.flashcards || []);

      // Auto-save the quiz
      const now = new Date();
      const title = `Quiz — ${now.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
      const saved = await saveQuiz(deck.id, title, data.questions || data.flashcards || []);
      setActiveQuizId(saved.id);
      setActiveQuiz(saved);
      setQuizHistory((prev) => [
        {
          id: saved.id,
          deck_id: saved.deck_id,
          title: saved.title,
          question_count: (data.questions || data.flashcards || []).length,
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
    const newAnswers = { ...answers, [questionIndex]: optionIndex };
    setAnswers(newAnswers);
  }

  function handleNext() {
    if (currentIndex + 1 >= questions.length) {
      handleQuizComplete();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  async function handleQuizComplete() {
    setQuizDone(true);
    // Save the attempt
    if (activeQuizId && Object.keys(answers).length > 0) {
      const score = questions.filter((q, i) => answers[i] === q.correct_index).length;
      try {
        const attempt = await saveQuizAttempt(activeQuizId, answers, score, questions.length);
        setSavedAttemptId(attempt.id);
      } catch (_) {}
    }
  }

  function handleRestart() {
    setAnswers({});
    setCurrentIndex(0);
    setQuizDone(false);
  }

  const correctCount = questions.filter((q, i) => answers[i] === q.correct_index).length;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="quiz-panel">
      {error && (
        <div className="banner banner-error" onClick={() => setError(null)}>
          ⚠ {error}
        </div>
      )}

      {activeView === "generate" && (
        <QuizGenerateView
          meta={meta}
          deck={deck}
          hasReadySources={hasReadySources}
          maxItems={maxItems}
          setMaxItems={setMaxItems}
          generating={generating}
          onGenerate={handleGenerate}
          quizHistory={quizHistory}
          loadingHistory={loadingHistory}
          onReviewQuiz={handleReviewQuiz}
          onDeleteQuiz={handleDeleteQuiz}
        />
      )}

      {questions.length > 0 && !quizDone && (
        <>
          <div className="quiz-progress-bar-wrap">
            <div
              className="quiz-progress-bar-fill"
              style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
            />
          </div>

          <QuizQuestion
            question={questions[currentIndex]}
            questionIndex={currentIndex}
            selectedAnswer={answers[currentIndex]}
            onAnswer={(optIdx) => handleAnswer(currentIndex, optIdx)}
            onNext={handleNext}
            isLast={currentIndex + 1 >= questions.length}
          />

          <div className="quiz-regen-row">
            <button
              className="btn-secondary quiz-regen-btn"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? <><span className="spinner" />Generating…</> : "🔄 New Quiz"}
            </button>
          </div>
        </>
      )}

      {quizDone && (
        <QuizResults
          questions={questions}
          answers={answers}
          correctCount={correctCount}
          onRestart={handleRestart}
          onNewQuiz={handleGenerate}
          generating={generating}
        />
      )}
    </div>
  );
}

// ─── Generate View (when no quiz active) ──────────────────────────────────────

function QuizGenerateView({
  meta, deck, hasReadySources, maxItems, setMaxItems,
  generating, onGenerate, quizHistory, loadingHistory,
  onReviewQuiz, onDeleteQuiz,
}) {
  return (
    <>
      {/* Generate card — same visual pattern as flashcard/cloze panels */}
      <div className="quiz-generate card">
        <div className="quiz-generate-header">
          <div>
            <h3>{meta.generate_label}</h3>
            <p className="quiz-generate-hint">
              AI will create multiple-choice questions from all{" "}
              {deck.source_documents.length} source
              {deck.source_documents.length !== 1 ? "s" : ""} in this deck.
            </p>
          </div>
          <div className="quiz-generate-controls">
            <div className="quiz-generate-count-control">
              <label className="quiz-generate-count-label">{meta.max_items_label}</label>
              <input
                type="number"
                className="quiz-generate-count-input"
                min={3}
                max={20}
                value={maxItems}
                onChange={(e) => setMaxItems(Number(e.target.value))}
                disabled={generating}
              />
            </div>
            <button
              className="btn-primary"
              onClick={onGenerate}
              disabled={generating || !hasReadySources}
              title={!hasReadySources ? "Add at least one ready document first" : ""}
            >
              {generating ? (
                <><span className="spinner" />Generating… <GenerateTimer generating={generating} /></>
              ) : (
                meta.generate_label
              )}
            </button>
          </div>
        </div>
        {!hasReadySources && (
          <div className="banner banner-info quiz-generate-banner">
            Add at least one ready document to this deck to generate a quiz.
          </div>
        )}
      </div>

      {/* Quiz History */}
      <div className="card quiz-history-card">
        <h3 className="quiz-history-title">📋 Quiz History</h3>
        {loadingHistory ? (
          <p className="quiz-history-empty">
            <span className="spinner" />Loading…
          </p>
        ) : quizHistory.length === 0 ? (
          <p className="quiz-history-empty">No quizzes saved yet.</p>
        ) : (
          <div className="quiz-history-list">
            {quizHistory.map((q) => (
              <div key={q.id} className="quiz-history-item">
                <div>
                  <div className="quiz-history-item-title">{q.title}</div>
                  <div className="quiz-history-item-meta">
                    {q.question_count} questions
                    {q.attempt_count > 0 && ` · Best: ${q.best_score}/${q.best_total}`}
                  </div>
                </div>
                <div className="quiz-history-item-actions">
                  <button className="btn-secondary btn-sm" onClick={() => onReviewQuiz(q.id)}>
                    Take Quiz
                  </button>
                  <button
                    className="btn-sm quiz-history-delete-btn"
                    onClick={() => onDeleteQuiz(q.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Single Question ──────────────────────────────────────────────────────────

function QuizQuestion({ question, questionIndex, selectedAnswer, onAnswer, onNext, isLast }) {
  const answered = selectedAnswer !== undefined;
  const isCorrect = answered && selectedAnswer === question.correct_index;

  return (
    <div className="quiz-question-card card">
      <p className="quiz-question-text">{question.question}</p>

      <div className="quiz-options">
        {question.options.map((option, i) => {
          let optClass = "quiz-option";
          if (answered) {
            if (i === question.correct_index) optClass += " quiz-option-correct";
            else if (i === selectedAnswer) optClass += " quiz-option-wrong";
            else optClass += " quiz-option-dimmed";
          } else {
            optClass += " quiz-option-interactive";
          }

          return (
            <button
              key={i}
              className={optClass}
              onClick={() => onAnswer(i)}
              disabled={answered}
            >
              <span className="quiz-option-label">{OPTION_LABELS[i]}</span>
              <span className="quiz-option-text">{option}</span>
              {answered && i === question.correct_index && (
                <span className="quiz-option-icon">✓</span>
              )}
              {answered && i === selectedAnswer && i !== question.correct_index && (
                <span className="quiz-option-icon quiz-option-icon-wrong">✗</span>
              )}
            </button>
          );
        })}
      </div>

      {answered && question.explanation && (
        <div className={`quiz-explanation ${isCorrect ? "quiz-explanation-correct" : "quiz-explanation-wrong"}`}>
          <span className="quiz-explanation-icon">{isCorrect ? "💡" : "📖"}</span>
          <p>{question.explanation}</p>
        </div>
      )}

      {answered && (
        <div className="quiz-next-row">
          <button className="btn-primary quiz-next-btn" onClick={onNext}>
            {isLast ? "See Results 🎉" : "Next Question →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────

function QuizResults({ questions, answers, correctCount, onRestart, onNewQuiz, generating }) {
  const total = questions.length;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  let grade = "🔴";
  if (pct >= 90) grade = "🏆";
  else if (pct >= 70) grade = "🟢";
  else if (pct >= 50) grade = "🟡";

  return (
    <div className="quiz-results">
      <div className="quiz-results-icon">{grade}</div>
      <h2>Quiz Complete!</h2>
      <p className="quiz-results-subtitle">
        You got <strong>{correctCount}</strong> of <strong>{total}</strong> correct ({pct}%)
      </p>

      <div className="quiz-results-stats">
        <div className="stat-box stat-got-it">
          <div className="stat-number">{correctCount}</div>
          <div className="stat-label">Correct ✓</div>
        </div>
        <div className="stat-box stat-review">
          <div className="stat-number">{total - correctCount}</div>
          <div className="stat-label">Wrong ✗</div>
        </div>
      </div>

      {total - correctCount > 0 && (
        <div className="quiz-review-section">
          <h3 className="quiz-review-title">📖 Review Wrong Answers</h3>
          <div className="quiz-review-list">
            {questions.map((q, i) => {
              if (answers[i] === q.correct_index) return null;
              return (
                <div key={i} className="quiz-review-item">
                  <p className="quiz-review-question">{q.question}</p>
                  <div className="quiz-review-answer-row">
                    <span className="quiz-review-wrong">
                      ✗ {OPTION_LABELS[answers[i]]}. {q.options[answers[i]]}
                    </span>
                    <span className="quiz-review-correct">
                      ✓ {OPTION_LABELS[q.correct_index]}. {q.options[q.correct_index]}
                    </span>
                  </div>
                  {q.explanation && (
                    <p className="quiz-review-explanation">{q.explanation}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="quiz-results-actions">
        <button className="btn-secondary" onClick={onRestart}>
          🔄 Retry Same Quiz
        </button>
        <button className="btn-secondary" onClick={onNewQuiz} disabled={generating}>
          {generating ? <><span className="spinner" />Generating…</> : "✨ New Quiz"}
        </button>
      </div>
    </div>
  );
}