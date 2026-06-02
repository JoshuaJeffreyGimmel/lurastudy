import uuid
from datetime import datetime

from pydantic import BaseModel


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


class DeckResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    title: str
    created_at: datetime
    flashcards: list[FlashcardResponse]

    model_config = {"from_attributes": True}


class DeckSummaryResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    title: str
    created_at: datetime
    card_count: int

    model_config = {"from_attributes": True}


class DeckListResponse(BaseModel):
    decks: list[DeckSummaryResponse]
    total: int


class GenerateFlashcardsRequest(BaseModel):
    document_id: uuid.UUID
    max_cards: int = 20
