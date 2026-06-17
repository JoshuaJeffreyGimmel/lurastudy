"""
Base class for deck activity types.

Each "activity type" (flashcards, quiz, cloze, true/false, etc.) is a
registered ActivityType instance that defines:
  - LLM prompt template and response parsing
  - How items are stored in / retrieved from the database
  - Metadata for the frontend (name, icon, etc.)
"""

from __future__ import annotations

import json
import logging
from typing import Any, ClassVar

from pydantic import BaseModel, Field

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class ActivityType(BaseModel):
    """
    Definition of one activity type that can be generated for a deck.

    Subclass this and provide the concrete prompts / parsers, then
    register the instance in ``activities/__init__.py``.
    """

    # ── Identity ──────────────────────────────────────────────────────────────
    id: str = Field(description="Unique machine-readable identifier e.g. 'flashcard'")
    name: str = Field(description="Human-readable name e.g. 'Flashcards'")
    icon: str = Field(description="Emoji icon e.g. '🃏'")
    description: str = Field(description="Short description shown in the UI")

    # ── Behaviour flags ───────────────────────────────────────────────────────
    has_spaced_repetition: bool = False
    """If True items get SM-2 scheduling (due dates, ease factor, etc.)."""

    # ── LLM configuration ────────────────────────────────────────────────────
    system_prompt_template: str = Field(
        description="LLM system prompt. May contain {max_items} placeholder."
    )
    json_root_key: str = Field(
        description="Top-level JSON key the LLM must wrap items in, "
        "e.g. 'flashcards', 'questions', 'cloze_cards'"
    )
    max_items_param: str = "max_items"
    """Query-parameter name the frontend sends for the item count."""

    item_schema: dict = Field(
        default_factory=dict,
        description="JSON Schema describing each generated item. "
        "Used by the frontend for rendering hints.",
    )

    # ── Optional custom labels ────────────────────────────────────────────────
    generate_label: str = "Generate"
    """Label for the generate button."""
    max_items_label: str = "Items"
    """Label for the max-items input field."""

    # ── Item validation ───────────────────────────────────────────────────────

    def parse_llm_response(self, raw: str) -> list[dict[str, Any]]:
        """
        Parse the raw LLM response string into a list of item dicts.

        The default implementation handles markdown code-fence wrapping and
        validates that *json_root_key* is present.  Override for types that
        need special JSON structure handling.
        """
        cleaned = raw.strip()
        # Strip ```json … ``` fences if present
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines[-1].strip() == "```":
                cleaned = "\n".join(lines[1:-1])
            else:
                cleaned = "\n".join(lines[1:])
            cleaned = cleaned.strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            raise ValueError(
                f"LLM returned invalid JSON: {e}\nRaw snippet: {raw[:300]}"
            )

        if self.json_root_key not in data:
            raise ValueError(
                f"LLM response missing '{self.json_root_key}' key. "
                f"Got keys: {list(data.keys())}"
            )

        items = data[self.json_root_key]
        if not isinstance(items, list):
            raise ValueError(f"'{self.json_root_key}' must be a list")

        validated: list[dict[str, Any]] = []
        for i, item in enumerate(items):
            if not isinstance(item, dict):
                logger.warning("Skipping non-dict item at index %d", i)
                continue
            item = self._validate_item(item)
            if item is not None:
                validated.append(item)

        if not validated:
            raise ValueError(f"LLM returned no valid {self.id} items")

        return validated

    def _validate_item(self, item: dict[str, Any]) -> dict[str, Any] | None:
        """
        Validate a single parsed item dict.  Return the item (possibly cleaned)
        or *None* to skip.  Override per activity type.
        """
        return item  # no-op by default

    # ── DB persistence ────────────────────────────────────────────────────────

    async def save_to_db(
        self,
        deck: Any,
        items: list[dict[str, Any]],
        db: AsyncSession,
        model_class: type,
    ) -> list[Any]:
        """
        Persist generated items to the database.

        The default implementation assumes *model_class* is ``Flashcard``
        (or any ORM model with ``activity_type``, ``front``, ``back``,
        ``card_index``, and SM-2 fields).  Override for types that need a
        different storage strategy (e.g. quiz questions stored as a separate
        object).
        """
        # ── Delete existing items of this type for the deck ──────────────
        from sqlalchemy import select

        existing_stmt = select(model_class).where(
            model_class.deck_id == deck.id,  # type: ignore[attr-defined]
            model_class.activity_type == self.id,
        )
        existing_result = await db.execute(existing_stmt)
        for row in existing_result.scalars().all():
            await db.delete(row)
        await db.flush()

        # ── Insert new items ─────────────────────────────────────────────
        orm_items: list[Any] = []
        for idx, item_data in enumerate(items):
            orm_item = model_class(
                deck_id=deck.id,
                activity_type=self.id,
                card_index=idx,
                front=item_data.get("front", ""),
                back=item_data.get("back", ""),
                item_metadata=item_data,
                # SM-2 fields (only meaningful for flashcard-like types,
                # but harmless to set for all)
                got_it=None,
                due_date=None,
                sm2_repetitions=0,
                sm2_ease_factor=2.5,
                sm2_interval=1,
            )
            db.add(orm_item)
            orm_items.append(orm_item)

        await db.flush()
        logger.info("Saved %d '%s' items for deck '%s'.", len(items), self.id, deck.id)
        return orm_items

    # ── Helpers ────────────────────────────────────────────────────────────────

    def build_user_prompt(self, context: str) -> str:
        """Build the user message for the LLM call."""
        return f"""Please create {self.id} items from the following educational material:

{context}"""

    @property
    def _prompt_example(self) -> str:
        """Generate an example JSON block for the system prompt."""
        return json.dumps({self.json_root_key: []}, indent=2)

    # ── Config ─────────────────────────────────────────────────────────────────

    model_config = {"arbitrary_types_allowed": True}
