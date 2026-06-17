/**
 * Elapsed-time counter shown during generation.
 *
 * Usage:
 *   <GenerateTimer generating={generating} />
 *
 * Shows "⏱ Xs" as a small badge next to the spinner.
 * Resets to 0 when generating becomes false.
 */
import React, { useEffect, useState } from "react";

export default function GenerateTimer({ generating }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!generating) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [generating]);

  if (!generating) return null;

  return <span className="generate-timer">⏱ {elapsed}s</span>;
}