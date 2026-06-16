import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.document import DocumentResponse


class FlashcardResponse(BaseModel):
    id: uuid.UUID
    deck_id: uuid.UUID
    front: str
    back: str
    card_index: int
    got_it: bool | None

    model_config = {"from_attributes": True}


class FlashcardStateUpdate(BaseModel):
    got_it: bool


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
    source_documents: list[DocumentResponse] = []

    model_config = {"from_attributes": True}


class DeckListResponse(BaseModel):
    decks: list[DeckSummaryResponse]
    total: int


# ─── Flashcard generation ──────────────────────────────────────────────────────

class GenerateFlashcardsRequest(BaseModel):
    """Generate flashcards from the deck's own source documents."""
    max_cards: int = 20


# ─── Chat ──────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
