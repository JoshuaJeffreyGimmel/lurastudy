"""
Study router.
Handles deck CRUD, flashcard generation, card state updates, and deck chat.
"""
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.document import Document
from app.models.study import Deck, Flashcard
from app.schemas.study import (
    ChatRequest,
    ChatResponse,
    DeckCreate,
    DeckListResponse,
    DeckResponse,
    DeckSummaryResponse,
    DeckUpdate,
    FlashcardResponse,
    FlashcardStateUpdate,
    GenerateFlashcardsRequest,
)
from app.services.config_store import (
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_MODEL,
    get_all_settings,
)
from app.services.llm import chat_with_sources, generate_flashcards
from app.services.rag import (
    get_all_chunks_text_multi,
    retrieve_relevant_chunks_multi,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/study", tags=["study"])


# ─── Helper ───────────────────────────────────────────────────────────────────

async def _load_deck(deck_id: uuid.UUID, db: AsyncSession) -> Deck:
    """Load a deck with its source_documents and flashcards, or raise 404."""
    stmt = (
        select(Deck)
        .where(Deck.id == deck_id)
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


# ─── Deck CRUD ────────────────────────────────────────────────────────────────

@router.post("/decks", response_model=DeckResponse, status_code=status.HTTP_201_CREATED)
async def create_deck(
    payload: DeckCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new empty deck workspace."""
    deck = Deck(title=payload.title, description=payload.description)
    db.add(deck)
    await db.flush()
    await db.refresh(deck)
    return await _load_deck(deck.id, db)


@router.get("/decks", response_model=DeckListResponse)
async def list_decks(
    db: AsyncSession = Depends(get_db),
):
    """Return all decks with summary info."""
    stmt = (
        select(Deck)
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
        )
        for deck in decks
    ]

    return DeckListResponse(decks=summaries, total=len(summaries))


@router.get("/decks/{deck_id}", response_model=DeckResponse)
async def get_deck(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return a deck with its source documents and flashcards."""
    deck = await _load_deck(deck_id, db)
    deck.flashcards.sort(key=lambda c: c.card_index)
    return deck


@router.patch("/decks/{deck_id}", response_model=DeckResponse)
async def update_deck(
    deck_id: uuid.UUID,
    payload: DeckUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a deck's title or description."""
    deck = await _load_deck(deck_id, db)
    if payload.title is not None:
        deck.title = payload.title
    if payload.description is not None:
        deck.description = payload.description
    await db.flush()
    return await _load_deck(deck_id, db)


@router.delete("/decks/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a deck and all its flashcards."""
    stmt = select(Deck).where(Deck.id == deck_id)
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
):
    """Add a source document to a deck."""
    deck = await _load_deck(deck_id, db)

    doc_stmt = select(Document).where(Document.id == document_id)
    doc_result = await db.execute(doc_stmt)
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if doc not in deck.source_documents:
        deck.source_documents.append(doc)
        await db.flush()

    return await _load_deck(deck_id, db)


@router.delete("/decks/{deck_id}/documents/{document_id}", response_model=DeckResponse)
async def remove_document_from_deck(
    deck_id: uuid.UUID,
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Remove a source document from a deck."""
    deck = await _load_deck(deck_id, db)
    deck.source_documents = [d for d in deck.source_documents if d.id != document_id]
    await db.flush()
    return await _load_deck(deck_id, db)


# ─── Flashcard Generation ─────────────────────────────────────────────────────

@router.post("/decks/{deck_id}/generate", response_model=DeckResponse)
async def generate_deck_flashcards(
    deck_id: uuid.UUID,
    request: GenerateFlashcardsRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate flashcards from all source documents in the deck.
    Replaces any existing flashcards in the deck.
    """
    deck = await _load_deck(deck_id, db)

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

    # Load LLM config
    cfg = await get_all_settings(db)
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

    # Delete existing flashcards and replace with new ones
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
        )
        db.add(flashcard)

    await db.flush()
    logger.info("Generated %d flashcards for deck '%s'.", len(card_data), deck_id)

    return await _load_deck(deck_id, db)


# ─── Deck Chat ────────────────────────────────────────────────────────────────

@router.post("/decks/{deck_id}/chat", response_model=ChatResponse)
async def chat_with_deck(
    deck_id: uuid.UUID,
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Chat with the AI about the deck's source documents using RAG.
    """
    deck = await _load_deck(deck_id, db)

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

    # Load LLM config
    cfg = await get_all_settings(db)
    llm_base_url = cfg[LLM_BASE_URL]
    llm_api_key = cfg[LLM_API_KEY]
    llm_model = cfg[LLM_MODEL]

    doc_ids = [d.id for d in ready_docs]

    # Retrieve relevant chunks for the user's message
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

    # Convert history to the format expected by the LLM service
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
            detail=f"Failed to get a response from the LLM. Please check your settings.",
        )

    return ChatResponse(reply=reply)


# ─── Flashcard State ──────────────────────────────────────────────────────────

@router.patch("/flashcards/{flashcard_id}", response_model=FlashcardResponse)
async def update_flashcard_state(
    flashcard_id: uuid.UUID,
    update: FlashcardStateUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update the 'got_it' state of a flashcard (true = got it, false = review later)."""
    stmt = select(Flashcard).where(Flashcard.id == flashcard_id)
    result = await db.execute(stmt)
    flashcard = result.scalar_one_or_none()

    if not flashcard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found")

    flashcard.got_it = update.got_it
    await db.flush()
    await db.refresh(flashcard)
    return flashcard
