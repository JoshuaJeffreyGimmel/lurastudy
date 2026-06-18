import React, { useEffect, useState } from "react";
import { checkConnectivity } from "../api/client.js";

/**
 * StatusBanner — shows a dismissible banner at the top of the app
 * alerting the user about connectivity issues (Ollama not running, etc.)
 */
export default function StatusBanner() {
  const [statuses, setStatuses] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchConnectivity() {
      try {
        const result = await checkConnectivity();
        if (cancelled) return;

        const issues = [];

        if (result.database !== "ok") {
          issues.push({ type: "error", message: "Database connection failed. The app may not work correctly." });
        }

        if (result.llm === "not_configured") {
          issues.push({
            type: "warn",
            message: "AI model not configured. Go to Settings to set up your LLM provider (Ollama or OpenAI).",
          });
        } else if (result.llm !== "ok" && result.llm_configured) {
          issues.push({
            type: "error",
            message: "Can't reach the AI model. If using Ollama, make sure it's running. Check Settings for details.",
          });
        }

        if (result.embedding === "not_configured") {
          if (!result.llm_configured) {
            // Already showing the general warning above
          } else {
            issues.push({
              type: "warn",
              message: "Embedding model not configured. Document processing won't work. Go to Settings.",
            });
          }
        } else if (result.embedding !== "ok" && result.embedding_configured) {
          if (issues.length === 0 || !issues.find((i) => i.message.includes("AI model"))) {
            issues.push({
              type: "warn",
              message: "Embedding service unreachable. Document uploads may fail. Check Settings.",
            });
          }
        }

        setStatuses(issues);
      } catch (_) {
        // Server not reachable at all — skip banner to avoid double errors
      }
    }

    fetchConnectivity();

    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed || statuses.length === 0) return null;

  return (
    <div className="status-banner-container">
      {statuses.map((s, i) => (
        <div key={i} className={`status-banner status-banner--${s.type}`}>
          <span className="status-banner-text">{s.message}</span>
          <button
            className="status-banner-close"
            onClick={() => setDismissed(true)}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}