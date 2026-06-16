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
    document_id: uuid.UUID | None
    knowledge_base_id: uuid.UUID | None
    title: str
    created_at: datetime
    flashcards: list[FlashcardResponse]

    model_config = {"from_attributes": True}


class DeckSummaryResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID | None
    knowledge_base_id: uuid.UUID | None
    title: str
    created_at: datetime
    card_count: int

    model_config = {"from_attributes": True}


class DeckListResponse(BaseModel):
    decks: list[DeckSummaryResponse]
    total: int


class GenerateFlashcardsRequest(BaseModel):
    document_id: uuid.UUID | None = None
    knowledge_base_id: uuid.UUID | None = None
    max_cards: int = 20

    def model_post_init(self, __context) -> None:
        if self.document_id is None and self.knowledge_base_id is None:
            raise ValueError("Either document_id or knowledge_base_id must be provided.")
        if self.document_id is not None and self.knowledge_base_id is not None:
            raise ValueError("Provide either document_id or knowledge_base_id, not both.")
