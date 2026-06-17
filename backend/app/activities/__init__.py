"""
Activity Type Registry.

All available deck activity types are registered here.
Add a new activity type by:
  1. Creating a file in this package (e.g. ``cloze.py``)
  2. Importing the singleton here
  3. Adding it to ``ACTIVITY_TYPES``

The frontend can list available types via ``GET /api/v1/activities``.
"""

from app.activities.flashcard import FlashcardActivity
from app.activities.quiz import QuizActivity
from app.activities.cloze import ClozeActivity
from app.activities.base import ActivityType

# ── Registry ───────────────────────────────────────────────────────────────────
# Map activity_type_id → ActivityType instance
ACTIVITY_TYPES: dict[str, ActivityType] = {
    "flashcard": FlashcardActivity,
    "quiz": QuizActivity,
    "cloze": ClozeActivity,
    # Add new types here:
    # "true_false": TrueFalseActivity,
}


# ── Lookup helpers ─────────────────────────────────────────────────────────────

def get_activity(activity_id: str) -> ActivityType:
    """
    Look up an activity type by ID.

    Raises ``KeyError`` if the type is not registered.
    """
    if activity_id not in ACTIVITY_TYPES:
        raise KeyError(f"Unknown activity type '{activity_id}'. "
                       f"Available: {list(ACTIVITY_TYPES.keys())}")
    return ACTIVITY_TYPES[activity_id]


def list_activities() -> list[dict]:
    """
    Return a list of activity type metadata for the frontend.

    Each entry includes:
      - ``id`` (str)
      - ``name`` (str)
      - ``icon`` (str)
      - ``description`` (str)
      - ``has_spaced_repetition`` (bool)
      - ``max_items_param`` (str)
      - ``generate_label`` (str)
      - ``max_items_label`` (str)
      - ``item_schema`` (dict)
    """
    return [
        {
            "id": at.id,
            "name": at.name,
            "icon": at.icon,
            "description": at.description,
            "has_spaced_repetition": at.has_spaced_repetition,
            "max_items_param": at.max_items_param,
            "generate_label": at.generate_label,
            "max_items_label": at.max_items_label,
            "item_schema": at.item_schema,
        }
        for at in ACTIVITY_TYPES.values()
    ]


__all__ = [
    "ActivityType",
    "ACTIVITY_TYPES",
    "get_activity",
    "list_activities",
    "FlashcardActivity",
    "QuizActivity",
    "ClozeActivity",
]
