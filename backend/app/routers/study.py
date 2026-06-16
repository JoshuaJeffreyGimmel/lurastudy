"""
Study router.
Handles flashcard deck generation, retrieval, and card state updates.
"""
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.document import Document
from app.models.knowledge_base import KnowledgeBase
from app.models.study import Deck, Flashcard
from app.schemas.study import (
    DeckListResponse,
    DeckResponse,
    DeckSummaryResponse,
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
from app.services.llm import generate_flashcards
from app.services.rag import (
    get_all_chunks_text,
    get_all_chunks_text_multi,
    retrieve_relevant_chunks,
    retrieve_relevant_chunks_multi,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/study", tags=["study"])


@router.post("/generate/flashcards", response_model=DeckResponse, status_code=status.HTTP_201_CREATED)
async def generate_flashcard_deck(
    request: GenerateFlashcardsRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a flashcard deck for a document or knowledge base using RAG + LLM.
    Saves the deck and cards to the database.
    Uses the LLM model configured in Settings (DB-backed, falls back to .env).
    """
    # Load current LLM config from DB (falls back to .env defaults)
    cfg = await get_all_settings(db)
    llm_base_url = cfg[LLM_BASE_URL]
    llm_api_key = cfg[LLM_API_KEY]
    llm_model = cfg[LLM_MODEL]

    # ── Single-document path ──────────────────────────────────────────────────
    if request.document_id is not None:
        stmt = select(Document).where(Document.id == request.document_id)
        result = await db.execute(stmt)
        document = result.scalar_one_or_none()

        if not document:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

        if document.status != "ready":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Document is not ready for generation (status: {document.status}). "
                       "Please wait for processing to complete.",
            )

        logger.info(
            "Using LLM model '%s' at '%s' for document '%s'",
            llm_model, llm_base_url, document.original_filename,
        )

        try:
            context_chunks = await retrieve_relevant_chunks(
                db=db,
                document_id=request.document_id,
                query="key concepts, definitions, important facts, and main ideas",
                top_k=min(15, request.max_cards),
            )
        except Exception as e:
            logger.warning("RAG retrieval failed (%s), falling back to all chunks.", e)
            context_chunks = await get_all_chunks_text(db=db, document_id=request.document_id)

        if not context_chunks:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No text content found for this document.",
            )

        deck_title = f"Flashcards: {document.original_filename}"
        deck_document_id = request.document_id
        deck_kb_id = None

    # ── Knowledge-base path ───────────────────────────────────────────────────
    else:
        stmt = (
            select(KnowledgeBase)
            .where(KnowledgeBase.id == request.knowledge_base_id)
            .options(selectinload(KnowledgeBase.documents))
        )
        result = await db.execute(stmt)
        kb = result.scalar_one_or_none()

        if not kb:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

        ready_docs = [d for d in kb.documents if d.status == "ready"]
        if not ready_docs:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No ready documents found in this knowledge base.",
            )

        doc_ids = [d.id for d in ready_docs]

        logger.info(
            "Using LLM model '%s' at '%s' for knowledge base '%s' (%d docs)",
            llm_model, llm_base_url, kb.name, len(ready_docs),
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
                detail="No text content found in this knowledge base.",
            )

        deck_title = f"Flashcards: {kb.name}"
        deck_document_id = None
        deck_kb_id = request.knowledge_base_id

    # ── Generate flashcards via LLM ───────────────────────────────────────────
    logger.info("Generating flashcards (model=%s)...", llm_model)
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

    # ── Persist deck + cards ──────────────────────────────────────────────────
    deck = Deck(
        document_id=deck_document_id,
        knowledge_base_id=deck_kb_id,
        title=deck_title,
    )
    db.add(deck)
    await db.flush()

    flashcards = []
    for idx, card in enumerate(card_data):
        flashcard = Flashcard(
            deck_id=deck.id,
            front=card["front"],
            back=card["back"],
            card_index=idx,
            got_it=None,
        )
        db.add(flashcard)
        flashcards.append(flashcard)

    await db.flush()

    logger.info("Created deck '%s' with %d cards.", deck.id, len(flashcards))

    stmt = (
        select(Deck)
        .where(Deck.id == deck.id)
        .options(selectinload(Deck.flashcards))
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get("/decks", response_model=DeckListResponse)
async def list_decks(
    db: AsyncSession = Depends(get_db),
):
    """Return all flashcard decks with summary info."""
    stmt = select(Deck).order_by(Deck.created_at.desc())
    result = await db.execute(stmt)
    decks = result.scalars().all()

    summaries = []
    for deck in decks:
        count_stmt = select(Flashcard).where(Flashcard.deck_id == deck.id)
        count_result = await db.execute(count_stmt)
        card_count = len(count_result.scalars().all())
        summaries.append(
            DeckSummaryResponse(
                id=deck.id,
                document_id=deck.document_id,
                knowledge_base_id=deck.knowledge_base_id,
                title=deck.title,
                created_at=deck.created_at,
                card_count=card_count,
            )
        )

    return DeckListResponse(decks=summaries, total=len(summaries))


@router.get("/decks/{deck_id}", response_model=DeckResponse)
async def get_deck(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return a deck with all its flashcards."""
    stmt = (
        select(Deck)
        .where(Deck.id == deck_id)
        .options(selectinload(Deck.flashcards))
    )
    result = await db.execute(stmt)
    deck = result.scalar_one_or_none()

    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    deck.flashcards.sort(key=lambda c: c.card_index)
    return deck


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


@router.delete("/decks/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a flashcard deck and all its cards."""
    stmt = select(Deck).where(Deck.id == deck_id)
    result = await db.execute(stmt)
    deck = result.scalar_one_or_none()

    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    await db.delete(deck)
