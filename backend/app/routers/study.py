"""
Study router.
Handles deck CRUD, flashcard generation, card state updates, and deck chat.
All endpoints require authentication; decks are scoped to the current user.
"""
import logging
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.document import Document
from app.models.study import Deck, Flashcard
from app.models.user import User
from app.schemas.study import (
    ChatRequest,
    ChatResponse,
    DeckCreate,
    DeckDueResponse,
    DeckListResponse,
    DeckResponse,
    DeckSummaryResponse,
    DeckUpdate,
    FlashcardResponse,
    FlashcardReviewUpdate,
    FlashcardStateUpdate,
    GenerateFlashcardsRequest,
    GenerateQuizRequest,
    QuizResponse,
)
from app.services.config_store import (
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_MODEL,
    get_all_settings,
)
from app.services.llm import chat_with_sources, generate_flashcards, generate_quiz
from app.services.rag import (
    get_all_chunks_text_multi,
    retrieve_relevant_chunks_multi,
)
from app.services.sm2 import apply_sm2, is_due

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/study", tags=["study"])


# ─── Helper ───────────────────────────────────────────────────────────────────

async def _load_deck(deck_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Deck:
    """Load a deck (owned by user) with its source_documents and flashcards, or raise 404."""
    stmt = (
        select(Deck)
        .where(Deck.id == deck_id, Deck.user_id == user_id)
        .options(
            selectinload(Deck.source_documents),
            selectinload(Deck.flashcards),
        )
    )
    result = await db.execute(stmt)
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    return deck


def _due_count(flashcards: list[Flashcard]) -> int:
    """Count how many cards in a list are due today or overdue."""
    return sum(1 for c in flashcards if is_due(c.due_date))


# ─── Deck CRUD ────────────────────────────────────────────────────────────────

@router.post("/decks", response_model=DeckResponse, status_code=status.HTTP_201_CREATED)
async def create_deck(
    payload: DeckCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new empty deck workspace."""
    deck = Deck(user_id=current_user.id, title=payload.title, description=payload.description)
    db.add(deck)
    await db.flush()
    await db.refresh(deck)
    return await _load_deck(deck.id, current_user.id, db)


@router.get("/decks", response_model=DeckListResponse)
async def list_decks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all decks belonging to the current user with summary info."""
    stmt = (
        select(Deck)
        .where(Deck.user_id == current_user.id)
        .options(selectinload(Deck.source_documents), selectinload(Deck.flashcards))
        .order_by(Deck.updated_at.desc())
    )
    result = await db.execute(stmt)
    decks = result.scalars().all()

    summaries = [
        DeckSummaryResponse(
            id=deck.id,
            title=deck.title,
            description=deck.description,
            created_at=deck.created_at,
            updated_at=deck.updated_at,
            source_count=len(deck.source_documents),
            card_count=len(deck.flashcards),
            due_count=_due_count(deck.flashcards),
            source_documents=deck.source_documents,
        )
        for deck in decks
    ]

    return DeckListResponse(decks=summaries, total=len(summaries))


@router.get("/decks/{deck_id}", response_model=DeckResponse)
async def get_deck(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a deck with its source documents and flashcards."""
    deck = await _load_deck(deck_id, current_user.id, db)
    deck.flashcards.sort(key=lambda c: c.card_index)
    return deck


@router.patch("/decks/{deck_id}", response_model=DeckResponse)
async def update_deck(
    deck_id: uuid.UUID,
    payload: DeckUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a deck's title or description."""
    deck = await _load_deck(deck_id, current_user.id, db)
    if payload.title is not None:
        deck.title = payload.title
    if payload.description is not None:
        deck.description = payload.description
    await db.flush()
    return await _load_deck(deck_id, current_user.id, db)


@router.delete("/decks/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a deck and all its flashcards."""
    stmt = select(Deck).where(Deck.id == deck_id, Deck.user_id == current_user.id)
    result = await db.execute(stmt)
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    await db.delete(deck)


# ─── Deck Source Documents ────────────────────────────────────────────────────

@router.post("/decks/{deck_id}/documents/{document_id}", response_model=DeckResponse)
async def add_document_to_deck(
    deck_id: uuid.UUID,
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a source document to a deck."""
    deck = await _load_deck(deck_id, current_user.id, db)

    doc_stmt = select(Document).where(
        Document.id == document_id, Document.user_id == current_user.id
    )
    doc_result = await db.execute(doc_stmt)
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if doc not in deck.source_documents:
        deck.source_documents.append(doc)
        await db.flush()

    return await _load_deck(deck_id, current_user.id, db)


@router.delete("/decks/{deck_id}/documents/{document_id}", response_model=DeckResponse)
async def remove_document_from_deck(
    deck_id: uuid.UUID,
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a source document from a deck."""
    deck = await _load_deck(deck_id, current_user.id, db)
    deck.source_documents = [d for d in deck.source_documents if d.id != document_id]
    await db.flush()
    return await _load_deck(deck_id, current_user.id, db)


# ─── Flashcard Generation ─────────────────────────────────────────────────────

@router.post("/decks/{deck_id}/generate", response_model=DeckResponse)
async def generate_deck_flashcards(
    deck_id: uuid.UUID,
    request: GenerateFlashcardsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate flashcards from all source documents in the deck."""
    deck = await _load_deck(deck_id, current_user.id, db)

    if not deck.source_documents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This deck has no source documents. Add at least one document before generating flashcards.",
        )

    ready_docs = [d for d in deck.source_documents if d.status == "ready"]
    if not ready_docs:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No ready documents found in this deck. Please wait for document processing to complete.",
        )

    cfg = await get_all_settings(db, current_user.id)
    llm_base_url = cfg[LLM_BASE_URL]
    llm_api_key = cfg[LLM_API_KEY]
    llm_model = cfg[LLM_MODEL]

    doc_ids = [d.id for d in ready_docs]

    logger.info(
        "Generating flashcards for deck '%s' (model=%s, %d docs)",
        deck_id, llm_model, len(ready_docs),
    )

    try:
        context_chunks = await retrieve_relevant_chunks_multi(
            db=db,
            document_ids=doc_ids,
            query="key concepts, definitions, important facts, and main ideas",
            top_k=min(15, request.max_cards),
        )
    except Exception as e:
        logger.warning("RAG retrieval failed (%s), falling back to all chunks.", e)
        context_chunks = await get_all_chunks_text_multi(db=db, document_ids=doc_ids)

    if not context_chunks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No text content found in the deck's source documents.",
        )

    try:
        card_data = await generate_flashcards(
            context_chunks=context_chunks,
            max_cards=request.max_cards,
            llm_base_url=llm_base_url,
            llm_api_key=llm_api_key,
            llm_model=llm_model,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM generation failed: {str(e)}",
        )
    except Exception as e:
        logger.error("Unexpected LLM error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to the LLM ({llm_model} @ {llm_base_url}). "
                   "Please check your LLM configuration in Settings.",
        )

    for existing_card in deck.flashcards:
        await db.delete(existing_card)
    await db.flush()

    for idx, card in enumerate(card_data):
        flashcard = Flashcard(
            deck_id=deck.id,
            front=card["front"],
            back=card["back"],
            card_index=idx,
            got_it=None,
            due_date=None,
            sm2_repetitions=0,
            sm2_ease_factor=2.5,
            sm2_interval=1,
        )
        db.add(flashcard)

    await db.flush()
    logger.info("Generated %d flashcards for deck '%s'.", len(card_data), deck_id)

    return await _load_deck(deck_id, current_user.id, db)


# ─── Due Cards ────────────────────────────────────────────────────────────────

@router.get("/decks/{deck_id}/due", response_model=DeckDueResponse)
async def get_due_cards(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return only the flashcards that are due today or overdue."""
    deck = await _load_deck(deck_id, current_user.id, db)

    due_cards = [c for c in deck.flashcards if is_due(c.due_date)]

    def sort_key(card: Flashcard):
        if card.due_date is None:
            return (1, date.today(), card.card_index)
        return (0, card.due_date, card.card_index)

    due_cards.sort(key=sort_key)

    return DeckDueResponse(
        deck_id=deck_id,
        due_cards=due_cards,
        due_count=len(due_cards),
        total_count=len(deck.flashcards),
    )


# ─── Deck Chat ────────────────────────────────────────────────────────────────

@router.post("/decks/{deck_id}/chat", response_model=ChatResponse)
async def chat_with_deck(
    deck_id: uuid.UUID,
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chat with the AI about the deck's source documents using RAG."""
    deck = await _load_deck(deck_id, current_user.id, db)

    if not deck.source_documents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This deck has no source documents to chat about. Add documents first.",
        )

    ready_docs = [d for d in deck.source_documents if d.status == "ready"]
    if not ready_docs:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No ready documents found in this deck.",
        )

    cfg = await get_all_settings(db, current_user.id)
    llm_base_url = cfg[LLM_BASE_URL]
    llm_api_key = cfg[LLM_API_KEY]
    llm_model = cfg[LLM_MODEL]

    doc_ids = [d.id for d in ready_docs]

    try:
        context_chunks = await retrieve_relevant_chunks_multi(
            db=db,
            document_ids=doc_ids,
            query=request.message,
            top_k=8,
        )
    except Exception as e:
        logger.warning("RAG retrieval failed for chat (%s), falling back to all chunks.", e)
        context_chunks = await get_all_chunks_text_multi(db=db, document_ids=doc_ids)

    if not context_chunks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No text content found in the deck's source documents.",
        )

    history = [{"role": msg.role, "content": msg.content} for msg in request.history]

    try:
        reply = await chat_with_sources(
            context_chunks=context_chunks,
            message=request.message,
            history=history,
            llm_base_url=llm_base_url,
            llm_api_key=llm_api_key,
            llm_model=llm_model,
        )
    except Exception as e:
        logger.error("Chat LLM call failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to get a response from the LLM. Please check your settings.",
        )

    return ChatResponse(reply=reply)


# ─── Quiz Generation ─────────────────────────────────────────────────────────

@router.post("/decks/{deck_id}/quiz", response_model=QuizResponse)
async def generate_deck_quiz(
    deck_id: uuid.UUID,
    request: GenerateQuizRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a multiple-choice quiz from all source documents in the deck."""
    deck = await _load_deck(deck_id, current_user.id, db)

    if not deck.source_documents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This deck has no source documents. Add at least one document before generating a quiz.",
        )

    ready_docs = [d for d in deck.source_documents if d.status == "ready"]
    if not ready_docs:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No ready documents found in this deck. Please wait for document processing to complete.",
        )

    cfg = await get_all_settings(db, current_user.id)
    llm_base_url = cfg[LLM_BASE_URL]
    llm_api_key = cfg[LLM_API_KEY]
    llm_model = cfg[LLM_MODEL]

    doc_ids = [d.id for d in ready_docs]

    logger.info(
        "Generating quiz for deck '%s' (model=%s, %d docs)",
        deck_id, llm_model, len(ready_docs),
    )

    try:
        context_chunks = await retrieve_relevant_chunks_multi(
            db=db,
            document_ids=doc_ids,
            query="key concepts, definitions, important facts, and main ideas",
            top_k=min(15, request.max_questions),
        )
    except Exception as e:
        logger.warning("RAG retrieval failed for quiz (%s), falling back to all chunks.", e)
        context_chunks = await get_all_chunks_text_multi(db=db, document_ids=doc_ids)

    if not context_chunks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No text content found in the deck's source documents.",
        )

    try:
        question_data = await generate_quiz(
            context_chunks=context_chunks,
            max_questions=request.max_questions,
            llm_base_url=llm_base_url,
            llm_api_key=llm_api_key,
            llm_model=llm_model,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM quiz generation failed: {str(e)}",
        )
    except Exception as e:
        logger.error("Unexpected LLM error during quiz generation: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to the LLM ({llm_model} @ {llm_base_url}). "
                   "Please check your LLM configuration in Settings.",
        )

    logger.info("Generated %d quiz questions for deck '%s'.", len(question_data), deck_id)

    return QuizResponse(deck_id=deck_id, questions=question_data)


# ─── Flashcard Review (SM-2) ──────────────────────────────────────────────────

@router.patch("/flashcards/{flashcard_id}/review", response_model=FlashcardResponse)
async def review_flashcard(
    flashcard_id: uuid.UUID,
    update: FlashcardReviewUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit an SM-2 review for a flashcard."""
    # Load flashcard and verify ownership via deck
    stmt = (
        select(Flashcard)
        .join(Deck, Flashcard.deck_id == Deck.id)
        .where(Flashcard.id == flashcard_id, Deck.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    flashcard = result.scalar_one_or_none()

    if not flashcard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found")

    new_reps, new_ef, new_interval, new_due_date = apply_sm2(
        repetitions=flashcard.sm2_repetitions,
        ease_factor=flashcard.sm2_ease_factor,
        interval=flashcard.sm2_interval,
        quality=update.quality,
    )

    flashcard.sm2_repetitions = new_reps
    flashcard.sm2_ease_factor = new_ef
    flashcard.sm2_interval = new_interval
    flashcard.due_date = new_due_date
    flashcard.got_it = update.quality >= 3

    await db.flush()
    await db.refresh(flashcard)
    return flashcard


@router.patch("/flashcards/{flashcard_id}", response_model=FlashcardResponse)
async def update_flashcard_state(
    flashcard_id: uuid.UUID,
    update: FlashcardStateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Legacy endpoint: Update the 'got_it' state of a flashcard."""
    stmt = (
        select(Flashcard)
        .join(Deck, Flashcard.deck_id == Deck.id)
        .where(Flashcard.id == flashcard_id, Deck.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    flashcard = result.scalar_one_or_none()

    if not flashcard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found")

    flashcard.got_it = update.got_it
    await db.flush()
    await db.refresh(flashcard)
    return flashcard
