"""
Flashcard activity type — front/back cards with SM-2 spaced repetition.
"""
import logging

from app.activities.base import ActivityType

logger = logging.getLogger(__name__)

FLASHCARD_SYSTEM_PROMPT = """You are an expert study assistant that creates high-quality flashcards from educational material.

Your task is to generate flashcards from the provided text. Each flashcard should:
- Have a clear, concise FRONT (a question, term, or concept)
- Have an accurate, informative BACK (the answer, definition, or explanation)
- Focus on the most important concepts, facts, and relationships
- Be self-contained and understandable without additional context

You MUST respond with ONLY valid JSON in this exact format, with no additional text, markdown, or explanation:
{{
  "flashcards": [
    {{"front": "Question or term here", "back": "Answer or definition here"}},
    {{"front": "Another question", "back": "Another answer"}}
  ]
}}

Generate between 5 and {max_items} flashcards. Prioritize quality over quantity."""


class FlashcardActivityType(ActivityType):
    """Flashcard generation with SM-2 spaced repetition."""

    id: str = "flashcard"
    name: str = "Flashcards"
    icon: str = "🃏"
    description: str = "Generate front/back flashcards with SM-2 spaced repetition"
    has_spaced_repetition: bool = True
    system_prompt_template: str = FLASHCARD_SYSTEM_PROMPT
    json_root_key: str = "flashcards"
    max_items_param: str = "max_cards"
    generate_label: str = "✨ Generate"
    max_items_label: str = "Cards"

    item_schema: dict = {
        "type": "object",
        "properties": {
            "front": {"type": "string", "description": "Question, term, or concept"},
            "back": {"type": "string", "description": "Answer, definition, or explanation"},
        },
        "required": ["front", "back"],
    }

    def _validate_item(self, item: dict) -> dict | None:
        front = str(item.get("front", "")).strip()
        back = str(item.get("back", "")).strip()
        if not front or not back:
            logger.warning("Skipping flashcard with empty front or back")
            return None
        return {"front": front, "back": back}


# Singleton instance for the registry
FlashcardActivity = FlashcardActivityType()
