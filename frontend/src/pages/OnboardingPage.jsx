import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { checkConnectivity, uploadDocument } from "../api/client.js";

const ONBOARDING_DONE_KEY = "lurastudy_onboarding_done";

/**
 * Returns true if onboarding has been completed (stored in localStorage).
 */
export function isOnboardingDone() {
  return localStorage.getItem(ONBOARDING_DONE_KEY) === "true";
}

/**
 * Mark onboarding as done so it doesn't show again.
 */
export function dismissOnboarding() {
  localStorage.setItem(ONBOARDING_DONE_KEY, "true");
}

/**
 * OnboardingPage — a first-launch wizard shown to new users.
 * Guides them through: configuring the AI, uploading a document, creating a deck.
 */
export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [connectivity, setConnectivity] = useState(null);
  const [checking, setChecking] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  // Check connectivity on mount
  useEffect(() => {
    let cancelled = false;
    checkConnectivity()
      .then((result) => {
        if (!cancelled) {
          setConnectivity(result);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnectivity(null);
          setChecking(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleFinish() {
    dismissOnboarding();
    navigate("/", { replace: true });
  }

  function handleSkip() {
    dismissOnboarding();
    navigate("/", { replace: true });
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(file);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  const llmOk = connectivity?.llm === "ok";
  const embeddingOk = connectivity?.embedding === "ok";
  const llmConfigured = connectivity?.llm_configured || connectivity?.embedding_configured;

  return (
    <div className="onboarding">
      <h1>Welcome{user ? `, ${user.username}` : ""}! 🎉</h1>
      <p className="subtitle">
        Let's get you set up in 3 quick steps.
      </p>

      {error && (
        <div className="banner banner-error" onClick={() => setError(null)} style={{ cursor: "pointer" }}>
          ⚠ {error}
        </div>
      )}

      <div className="onboarding-steps">
        {/* Step 1: AI Connection */}
        <div className={`onboarding-step ${step > 1 ? "onboarding-step--done" : ""}`}>
          <span className="onboarding-step-icon">
            {step > 1 ? "✓" : "1"}
          </span>
          <div className="onboarding-step-body">
            <h3>Connect an AI model</h3>
            <p>
              {checking
                ? "Checking your AI connection..."
                : llmOk && embeddingOk
                  ? "✅ Your AI model is running and connected."
                  : llmConfigured
                    ? "⚠️ AI configured but unreachable. Make sure Ollama is running, then refresh."
                    : "No AI model detected. Go to Settings to configure Ollama or OpenAI."}
            </p>
            {!checking && !llmConfigured && (
              <button
                className="btn-secondary btn-sm-text"
                style={{ marginTop: "0.5rem" }}
                onClick={() => navigate("/settings")}
              >
                ⚙ Open Settings
              </button>
            )}
          </div>
        </div>

        {/* Step 2: Upload a document */}
        <div className={`onboarding-step ${step > 2 ? "onboarding-step--done" : ""}`}>
          <span className="onboarding-step-icon">
            {step > 2 ? "✓" : "2"}
          </span>
          <div className="onboarding-step-body">
            <h3>Upload your first document</h3>
            <p>
              Upload a PDF, text file, or any study material.
              LuraStudy will extract the content and index it for AI-powered study tools.
            </p>
            {step === 1 && (
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.8rem", marginTop: "0.3rem" }}>
                Finish step 1 first, or skip ahead.
              </p>
            )}
            {step >= 2 && (
              <div style={{ marginTop: "0.5rem" }}>
                <label className="btn-primary" style={{ display: "inline-block", cursor: "pointer" }}>
                  {uploading ? (
                    <><span className="spinner" />Uploading…</>
                  ) : (
                    "📄 Select a file"
                  )}
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,.docx,.pptx,.xlsx,.html,.csv,.xml,.ipynb"
                    onChange={handleUpload}
                    style={{ display: "none" }}
                    disabled={uploading}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Explore */}
        <div className="onboarding-step">
          <span className="onboarding-step-icon">3</span>
          <div className="onboarding-step-body">
            <h3>Explore your workspace</h3>
            <p>
              Create a deck, attach your document, and generate flashcards or quizzes with AI.
              Study with spaced repetition or take practice quizzes.
            </p>
            {step >= 3 && (
              <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button className="btn-primary" onClick={() => navigate("/decks")}>
                  📚 Go to Decks
                </button>
                <button className="btn-secondary" onClick={() => navigate("/documents")}>
                  📄 View Documents
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="onboarding-dismiss-btn" style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
        {step < 3 && (
          <button
            className="btn-primary"
            onClick={() => setStep((s) => Math.min(s + 1, 3))}
          >
            Skip this step →
          </button>
        )}
        {step >= 3 && (
          <button className="btn-success" onClick={handleFinish}>
            ✅ Done, let's go!
          </button>
        )}
        <button className="btn-secondary" onClick={handleSkip}>
          Skip onboarding
        </button>
      </div>
    </div>
  );
}