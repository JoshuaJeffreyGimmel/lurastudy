"""
Cloze / Fill-in-the-Blank activity type.

Each item presents a sentence with a word replaced by a blank (╴╴╴╴╴).
The user must recall the missing word.  Uses SM-2 spaced repetition.
"""
import logging

from app.activities.base import ActivityType

logger = logging.getLogger(__name__)

CLOZE_SYSTEM_PROMPT = """You are an expert study assistant that creates cloze (fill-in-the-blank) exercises from educational material.

Your task is to generate cloze cards from the provided text. Each card should:
- Have a sentence or phrase with ONE key word replaced by "______" (5 underscores)
- The missing word should be an important concept, term, or fact to remember
- Provide a short hint where helpful (the topic or category the answer belongs to)
- Be self-contained and understandable without additional context
- The sentence must contain the "______" placeholder exactly once

You MUST respond with ONLY valid JSON in this exact format, with no additional text, markdown, or explanation:
{{
  "cloze_cards": [
    {{
      "sentence": "A sentence with ______ missing.",
      "answer": "missing",
      "hint": "Optional short hint (category/context)"
    }},
    {{
      "sentence": "Another sentence with ______ here.",
      "answer": "another",
      "hint": ""
    }}
  ]
}}

The "hint" field is optional — set it to an empty string if no hint is needed.
Generate between 5 and {max_items} cloze cards. Prioritize quality over quantity."""


class ClozeActivityType(ActivityType):
    """Cloze / fill-in-the-blank generation with SM-2 spaced repetition."""

    id: str = "cloze"
    name: str = "Fill-in-the-Blank"
    icon: str = "📝"
    description: str = "Generate fill-in-the-blank sentences for contextual recall"
    has_spaced_repetition: bool = True
    system_prompt_template: str = CLOZE_SYSTEM_PROMPT
    json_root_key: str = "cloze_cards"
    max_items_param: str = "max_cards"
    generate_label: str = "✨ Generate"
    max_items_label: str = "Cards"

    item_schema: dict = {
        "type": "object",
        "properties": {
            "sentence": {
                "type": "string",
                "description": "Sentence with ______ placeholder for the missing word",
            },
            "answer": {
                "type": "string",
                "description": "The missing word or phrase",
            },
            "hint": {
                "type": "string",
                "description": "Optional short hint about the answer's topic",
            },
        },
        "required": ["sentence", "answer"],
    }

    def _validate_item(self, item: dict) -> dict | None:
        sentence = str(item.get("sentence", "")).strip()
        answer = str(item.get("answer", "")).strip()
        hint = str(item.get("hint", "")).strip()

        if not sentence or not answer:
            logger.warning("Skipping cloze card with empty sentence or answer")
            return None

        # Ensure sentence contains the placeholder
        if "______" not in sentence:
            logger.warning(
                "Skipping cloze card: sentence missing '______' placeholder"
            )
            return None

        # Ensure exactly one placeholder
        if sentence.count("______") > 1:
            logger.warning(
                "Skipping cloze card: multiple '______' placeholders not supported"
            )
            return None

        return {
            "sentence": sentence,
            "answer": answer,
            "hint": hint,
        }

    def build_user_prompt(self, context: str) -> str:
        """Build the user message for the LLM call."""
        return f"""Please create cloze (fill-in-the-blank) items from the following educational material:

{context}"""

    async def save_to_db(
        self,
        deck: any,
        items: list[dict],
        db: any,
        model_class: type,
    ) -> list[any]:
        """
        Save cloze items as Flashcard records with ``activity_type="cloze"``.

        Maps ``sentence`` → ``front`` and ``answer`` → ``back`` so the
        existing SM-2 study flow works for cloze cards.
        """
        from sqlalchemy import select

        # ── Delete existing cloze items for the deck ─────────────────────
        existing_stmt = select(model_class).where(
            model_class.deck_id == deck.id,
            model_class.activity_type == self.id,
        )
        existing_result = await db.execute(existing_stmt)
        for row in existing_result.scalars().all():
            await db.delete(row)
        await db.flush()

        # ── Insert new items ─────────────────────────────────────────────
        orm_items: list[any] = []
        for idx, item_data in enumerate(items):
            orm_item = model_class(
                deck_id=deck.id,
                activity_type=self.id,
                card_index=idx,
                front=item_data.get("sentence", ""),
                back=item_data.get("answer", ""),
                item_metadata=item_data,
                got_it=None,
                due_date=None,
                sm2_repetitions=0,
                sm2_ease_factor=2.5,
                sm2_interval=1,
            )
            db.add(orm_item)
            orm_items.append(orm_item)

        await db.flush()
        logger.info(
            "Saved %d '%s' items for deck '%s'.",
            len(items), self.id, deck.id,
        )
        return orm_items


# Singleton instance for the registry
ClozeActivity = ClozeActivityType()
