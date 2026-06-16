import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { generateDeckQuiz, getDeck } from "../api/client.js";
import "./QuizPage.css";

const OPTION_LABELS = ["A", "B", "C", "D"];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuizPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const backPath = `/decks/${deckId}`;

  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [maxQuestions, setMaxQuestions] = useState(10);

  // Per-question state: null = unanswered, number = chosen index
  const [answers, setAnswers] = useState({});
  const [quizDone, setQuizDone] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    getDeck(deckId)
      .then((data) => setDeck(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [deckId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setAnswers({});
    setCurrentIndex(0);
    setQuizDone(false);
    try {
      const data = await generateDeckQuiz(deckId, maxQuestions);
      setQuestions(data.questions);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function handleAnswer(questionIndex, optionIndex) {
    if (answers[questionIndex] !== undefined) return; // already answered
    const newAnswers = { ...answers, [questionIndex]: optionIndex };
    setAnswers(newAnswers);
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

  if (loading) {
    return (
      <div className="quiz-page">
        <p><span className="spinner" />Loading deck…</p>
      </div>
    );
  }

  if (error && !questions.length) {
    return (
      <div className="quiz-page">
        <div className="banner banner-error">{error}</div>
        <button className="btn-secondary" onClick={() => navigate(backPath)}>← Back to Deck</button>
      </div>
    );
  }

  if (!deck) return null;

  const hasReadySources = deck.source_documents.some((d) => d.status === "ready");
  const correctCount = questions.filter((q, i) => answers[i] === q.correct_index).length;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="quiz-page">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="quiz-header">
        <button className="btn-secondary back-btn" onClick={() => navigate(backPath)}>
          ← Back to Deck
        </button>
        <div className="quiz-title">
          <h1>{deck.title}</h1>
          {questions.length > 0 && !quizDone && (
            <span className="quiz-progress-label">
              Question {currentIndex + 1} of {questions.length}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="banner banner-error" onClick={() => setError(null)}>
          ⚠ {error}
        </div>
      )}

      {/* ─── Generate controls (shown when no quiz active) ──────────────── */}
      {questions.length === 0 && (
        <div className="quiz-generate-card card">
          <div className="quiz-generate-header">
            <div>
              <h3>Generate Quiz</h3>
              <p className="quiz-generate-hint">
                AI will create multiple-choice questions from all{" "}
                {deck.source_documents.length} source
                {deck.source_documents.length !== 1 ? "s" : ""} in this deck.
              </p>
            </div>
            <div className="quiz-generate-controls">
              <div className="quiz-count-control">
                <label className="quiz-count-label">Questions</label>
                <input
                  type="number"
                  className="quiz-count-input"
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
                {generating ? (
                  <><span className="spinner" />Generating…</>
                ) : (
                  "✨ Generate Quiz"
                )}
              </button>
            </div>
          </div>

          {!hasReadySources && (
            <div className="banner banner-info" style={{ marginTop: "1rem" }}>
              Add at least one ready document to this deck to generate a quiz.
            </div>
          )}
        </div>
      )}

      {/* ─── Quiz in progress ───────────────────────────────────────────── */}
      {questions.length > 0 && !quizDone && (
        <>
          {/* Progress bar */}
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

          {/* Regenerate option */}
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

      {/* ─── Results screen ─────────────────────────────────────────────── */}
      {quizDone && (
        <QuizResults
          questions={questions}
          answers={answers}
          correctCount={correctCount}
          onRestart={handleRestart}
          onNewQuiz={handleGenerate}
          onGoHome={() => navigate(backPath)}
          generating={generating}
        />
      )}
    </div>
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

      {/* Explanation shown after answering */}
      {answered && question.explanation && (
        <div className={`quiz-explanation ${isCorrect ? "quiz-explanation-correct" : "quiz-explanation-wrong"}`}>
          <span className="quiz-explanation-icon">{isCorrect ? "💡" : "📖"}</span>
          <p>{question.explanation}</p>
        </div>
      )}

      {/* Next button — only shown after answering */}
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

function QuizResults({ questions, answers, correctCount, onRestart, onNewQuiz, onGoHome, generating }) {
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

      {/* Review wrong answers */}
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
        <button className="btn-primary" onClick={onGoHome}>
          🏠 Back to Deck
        </button>
      </div>
    </div>
  );
}
