/**
 * Frontend Activity Type Registry.
 *
 * Maps activity type IDs (matching the backend registry) to:
 *   - Metadata (name, icon, labels)
 *   - A React component that renders the activity panel (generate + review UI)
 *
 * To add a new activity type:
 *   1. Create a component in a subdirectory (e.g. `cloze/Panel.jsx`)
 *   2. Import it here
 *   3. Add it to ACTIVITY_METADATA and ACTIVITY_COMPONENTS
 */

import FlashcardPanel from "./flashcard/Panel.jsx";
import QuizPanel from "./quiz/Panel.jsx";
import ClozePanel from "./cloze/Panel.jsx";
import CalculationPanel from "./calculation/Panel.jsx";

// ─── Activity Type Metadata ──────────────────────────────────────────────────
// These mirror what the backend returns from GET /activities.
// The frontend can use either the static metadata below OR fetch from the API.

export const ACTIVITY_METADATA = {
  flashcard: {
    id: "flashcard",
    name: "Flashcards",
    icon: "🃏",
    description: "Generate front/back flashcards with SM-2 spaced repetition",
    has_spaced_repetition: true,
    max_items_param: "max_cards",
    generate_label: "✨ Generate",
    max_items_label: "Cards",
  },
  quiz: {
    id: "quiz",
    name: "Quiz",
    icon: "🧠",
    description: "Generate multiple-choice questions with scoring",
    has_spaced_repetition: false,
    max_items_param: "max_questions",
    generate_label: "✨ Generate Quiz",
    max_items_label: "Questions",
  },
  cloze: {
    id: "cloze",
    name: "Fill-in-the-Blank",
    icon: "📝",
    description: "Generate fill-in-the-blank sentences for contextual recall",
    has_spaced_repetition: true,
    max_items_param: "max_cards",
    generate_label: "✨ Generate",
    max_items_label: "Cards",
  },
  calculation: {
    id: "calculation",
    name: "Numerical",
    icon: "🔢",
    description: "Generate calculation problems with numeric answers",
    has_spaced_repetition: true,
    max_items_param: "max_cards",
    generate_label: "✨ Generate",
    max_items_label: "Problems",
  },
};

// ─── Activity Components ──────────────────────────────────────────────────────
// Map activity type ID → React component

export const ACTIVITY_COMPONENTS = {
  flashcard: FlashcardPanel,
  quiz: QuizPanel,
  cloze: ClozePanel,
  calculation: CalculationPanel,
};

/**
 * Get the React component for a given activity type ID.
 * Returns null if the type is not registered.
 */
export function getActivityComponent(activityId) {
  return ACTIVITY_COMPONENTS[activityId] || null;
}

/**
 * Activity types that should appear as tabs in the DeckWorkspacePage.
 * Chat is a special built-in tab, not an activity type.
 */
export const ACTIVITY_TABS = Object.keys(ACTIVITY_COMPONENTS);