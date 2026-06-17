"""
Quiz activity type — multiple-choice questions with scoring.
"""
import logging
from datetime import datetime

from app.activities.base import ActivityType
from app.models.history import Quiz as QuizModel

logger = logging.getLogger(__name__)

QUIZ_SYSTEM_PROMPT = """You are an expert quiz creator that generates multiple-choice questions from educational material.

Your task is to generate quiz questions from the provided text. Each question should:
- Have a clear, unambiguous question
- Have exactly 4 answer options labelled A, B, C, D
- Have exactly one correct answer
- Have plausible but clearly incorrect distractors
- Focus on important concepts, facts, and relationships

You MUST respond with ONLY valid JSON in this exact format, with no additional text, markdown, or explanation:
{{
  "questions": [
    {{
      "question": "What is the question?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correct_index": 0,
      "explanation": "Brief explanation of why the correct answer is right."
    }}
  ]
}}

The correct_index is 0-based (0 = first option, 1 = second, etc.).
Generate between 5 and {max_items} questions. Prioritize quality over quantity."""


class QuizActivityType(ActivityType):
    """Multiple-choice quiz generation with scoring history."""

    id: str = "quiz"
    name: str = "Quiz"
    icon: str = "🧠"
    description: str = "Generate multiple-choice questions with scoring"
    has_spaced_repetition: bool = False
    system_prompt_template: str = QUIZ_SYSTEM_PROMPT
    json_root_key: str = "questions"
    max_items_param: str = "max_questions"
    generate_label: str = "✨ Generate Quiz"
    max_items_label: str = "Questions"

    item_schema: dict = {
        "type": "object",
        "properties": {
            "question": {"type": "string", "description": "The question text"},
            "options": {
                "type": "array",
                "items": {"type": "string"},
                "description": "4 answer options (A, B, C, D)",
            },
            "correct_index": {
                "type": "integer",
                "description": "0-based index of the correct option",
            },
            "explanation": {"type": "string", "description": "Explanation of the correct answer"},
        },
        "required": ["question", "options", "correct_index"],
    }

    def _validate_item(self, item: dict) -> dict | None:
        question = str(item.get("question", "")).strip()
        options = item.get("options", [])
        correct_index = item.get("correct_index", None)

        if not question:
            logger.warning("Skipping quiz question with empty text")
            return None
        if not isinstance(options, list) or len(options) != 4:
            logger.warning("Skipping question: options must be a list of 4")
            return None
        if not isinstance(correct_index, int) or not (0 <= correct_index <= 3):
            logger.warning("Skipping question: invalid correct_index %s", correct_index)
            return None

        return {
            "question": question,
            "options": [str(o).strip() for o in options],
            "correct_index": correct_index,
            "explanation": str(item.get("explanation", "")).strip(),
        }

    async def save_to_db(
        self,
        deck: any,
        items: list[dict],
        db: any,
        model_class: type,
    ) -> list[any]:
        """
        Save quiz questions as a Quiz record in the history table.
        Overrides the default which stores items as Flashcards.
        """
        from sqlalchemy import select

        # Build a title with current timestamp
        now = datetime.utcnow()
        title = f"Quiz — {now.strftime('%b %d, %H:%M')}"

        quiz = QuizModel(
            deck_id=deck.id,
            title=title,
            questions=items,
        )
        db.add(quiz)
        await db.flush()
        await db.refresh(quiz)
        logger.info("Saved quiz '%s' (%d questions) for deck '%s'.", quiz.id, len(items), deck.id)
        return [quiz]  # Return the Quiz record so the frontend can reference it


# Singleton instance for the registry
QuizActivity = QuizActivityType()
