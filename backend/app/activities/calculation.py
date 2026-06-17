"""
Calculation / Numerical activity type.

Each item presents a word problem or calculation to solve numerically.
The user types a number, and it's validated against the expected answer
within a configurable tolerance range.  Uses SM-2 spaced repetition.
"""
import logging

from app.activities.base import ActivityType

logger = logging.getLogger(__name__)

CALCULATION_SYSTEM_PROMPT = """You are an expert study assistant that creates calculation problems from educational material.

Your task is to generate calculation problems from the provided text. Each problem should:
- Be a real-world word problem or calculation based on the material
- Have a clear numeric answer (not a word or phrase)
- Include the correct numeric answer with appropriate precision
- Specify the unit of measurement (e.g., "meters", "grams", "dollars", "Joules", "")
- Set a reasonable tolerance for floating-point comparison (e.g., 0.01 for most cases, larger for estimates)
- Provide a step-by-step solution explaining how to arrive at the answer

You MUST respond with ONLY valid JSON in this exact format, with no additional text, markdown, or explanation:
{{
  "calculations": [
    {{
      "question": "A car accelerates from rest at 2 m/s² for 5 seconds. How far does it travel?",
      "answer": 25,
      "unit": "meters",
      "tolerance": 0.5,
      "solution": "Using s = (1/2)at² = (1/2)(2)(5²) = 25 m"
    }}
  ]
}}

Important rules:
- "answer" must be a number (integer or float), NOT a string
- "tolerance" defines the allowed margin of error (default 0.01)
- "unit" can be an empty string if there is no unit
- "solution" should show step-by-step work

Generate between 5 and {max_items} calculation problems. Prioritize quality over quantity."""


class CalculationActivityType(ActivityType):
    """Calculation / numerical problem generation with SM-2 spaced repetition."""

    id: str = "calculation"
    name: str = "Numerical"
    icon: str = "🔢"
    description: str = "Generate calculation problems with numeric answers"
    has_spaced_repetition: bool = True
    system_prompt_template: str = CALCULATION_SYSTEM_PROMPT
    json_root_key: str = "calculations"
    max_items_param: str = "max_cards"
    generate_label: str = "✨ Generate"
    max_items_label: str = "Problems"

    item_schema: dict = {
        "type": "object",
        "properties": {
            "question": {
                "type": "string",
                "description": "The word problem or calculation question",
            },
            "answer": {
                "type": "number",
                "description": "The correct numeric answer",
            },
            "unit": {
                "type": "string",
                "description": "Unit of measurement (e.g. meters, grams, dollars)",
            },
            "tolerance": {
                "type": "number",
                "description": "Allowed margin of error for floating-point comparison",
            },
            "solution": {
                "type": "string",
                "description": "Step-by-step solution explanation",
            },
        },
        "required": ["question", "answer"],
    }

    def _validate_item(self, item: dict) -> dict | None:
        question = str(item.get("question", "")).strip()
        answer = item.get("answer", None)
        unit = str(item.get("unit", "")).strip()
        tolerance = item.get("tolerance", 0.01)
        solution = str(item.get("solution", "")).strip()

        if not question:
            logger.warning("Skipping calculation with empty question")
            return None

        if answer is None or not isinstance(answer, (int, float)):
            logger.warning("Skipping calculation: answer must be a number")
            return None

        if not isinstance(tolerance, (int, float)) or tolerance < 0:
            tolerance = 0.01

        return {
            "question": question,
            "answer": float(answer),
            "unit": unit,
            "tolerance": float(tolerance),
            "solution": solution,
        }

    def build_user_prompt(self, context: str) -> str:
        """Build the user message for the LLM call."""
        return f"""Please create calculation problems from the following educational material:

{context}"""

    async def save_to_db(
        self,
        deck: any,
        items: list[dict],
        db: any,
        model_class: type,
    ) -> list[any]:
        """
        Save calculation items as Flashcard records with ``activity_type="calculation"``.
        Maps ``question`` → ``front`` and ``answer`` (+ unit, solution) → ``back``.
        """
        from sqlalchemy import select

        # ── Delete existing calculation items for the deck ───────────────
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
            answer_val = item_data.get("answer", 0)
            unit_val = item_data.get("unit", "")
            solution_val = item_data.get("solution", "")
            back_parts = [str(answer_val)]
            if unit_val:
                back_parts.append(unit_val)
            back_parts.append(f"Solution: {solution_val}" if solution_val else "")
            back_text = " | ".join(p for p in back_parts if p)

            orm_item = model_class(
                deck_id=deck.id,
                activity_type=self.id,
                card_index=idx,
                front=item_data.get("question", ""),
                back=back_text,
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
CalculationActivity = CalculationActivityType()