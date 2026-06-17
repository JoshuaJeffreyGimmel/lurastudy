import uuid
from datetime import date, datetime

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.document import DocumentResponse


# ─── Activity Types ─────────────────────────────────────────────────────────────

class ActivityTypeResponse(BaseModel):
    """Metadata about a registered activity type, returned to the frontend."""
    id: str
    name: str
    icon: str
    description: str
    has_spaced_repetition: bool
    max_items_param: str
    generate_label: str
    max_items_label: str
    item_schema: dict


class ActivityGenerateRequest(BaseModel):
    """Generic request body for generating activity items."""
    max_items: int = 20


class FlashcardResponse(BaseModel):
    id: uuid.UUID
    deck_id: uuid.UUID
    activity_type: str = "flashcard"
    front: str
    back: str
    card_index: int
    # JSON metadata — type-specific extra fields
    item_metadata: dict | None = None
    # Legacy field — kept for backward compatibility
    got_it: bool | None
    # SM-2 Spaced Repetition fields
    due_date: date | None
    sm2_repetitions: int
    sm2_ease_factor: float
    sm2_interval: int

    model_config = {"from_attributes": True}


class FlashcardStateUpdate(BaseModel):
    """Legacy endpoint body — kept for backward compatibility."""
    got_it: bool


class FlashcardReviewUpdate(BaseModel):
    """SM-2 review update. quality is 0–5 per the SM-2 spec.

    Convenience mappings used by the frontend:
      5 → Easy (perfect recall)
      4 → Got It (correct with hesitation)
      1 → Again / Review Later (incorrect)
    """
    quality: int = Field(..., ge=0, le=5, description="SM-2 quality rating 0–5")


# ─── Deck schemas ──────────────────────────────────────────────────────────────

class DeckCreate(BaseModel):
    title: str
    description: str | None = None


class DeckUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class DeckResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    source_documents: list[DocumentResponse] = []
    flashcards: list[FlashcardResponse] = []

    model_config = {"from_attributes": True}


class DeckSummaryResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    source_count: int
    card_count: int
    due_count: int = 0
    source_documents: list[DocumentResponse] = []

    model_config = {"from_attributes": True}


class DeckListResponse(BaseModel):
    decks: list[DeckSummaryResponse]
    total: int


class DeckDueResponse(BaseModel):
    """Response for the /due endpoint — only cards due today or overdue."""
    deck_id: uuid.UUID
    due_cards: list[FlashcardResponse]
    due_count: int
    total_count: int


# ─── Flashcard generation ──────────────────────────────────────────────────────

class GenerateFlashcardsRequest(BaseModel):
    """Generate flashcards from the deck's own source documents."""
    max_cards: int = 20


# ─── Quiz ──────────────────────────────────────────────────────────────────────

class GenerateQuizRequest(BaseModel):
    """Generate a multiple-choice quiz from the deck's own source documents."""
    max_questions: int = 10


class QuizQuestion(BaseModel):
    question: str
    options: list[str]       # always 4 items
    correct_index: int       # 0-based index into options
    explanation: str


class QuizResponse(BaseModel):
    deck_id: uuid.UUID
    questions: list[QuizQuestion]


# ─── Chat ──────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
