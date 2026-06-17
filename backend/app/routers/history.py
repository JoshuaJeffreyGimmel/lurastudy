"""
History router.
Handles chat conversations (CRUD + messaging) and quiz save/history.
All endpoints require authentication; data is scoped to the current user via deck ownership.
"""
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.history import ChatConversation, ChatMessage, Quiz, QuizAttempt
from app.models.study import Deck
from app.models.user import User
from app.schemas.history import (
    ChatConversationCreate,
    ChatConversationResponse,
    ChatConversationSummary,
    ChatMessageResponse,
    ConversationChatRequest,
    ConversationListResponse,
    QuizAttemptResponse,
    QuizListResponse,
    QuizResponse,
    QuizSummary,
    SaveAttemptRequest,
    SaveQuizRequest,
)
from app.services.config_store import (
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_MODEL,
    get_all_settings,
)
from app.services.llm import chat_with_sources
from app.services.rag import retrieve_relevant_chunks_multi, get_all_chunks_text_multi

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/history", tags=["history"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_deck_or_404(deck_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Deck:
    result = await db.execute(
        select(Deck)
        .where(Deck.id == deck_id, Deck.user_id == user_id)
        .options(selectinload(Deck.source_documents))
    )
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    return deck


async def _load_conversation(conv_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> ChatConversation:
    """Load a conversation, verifying ownership via the deck."""
    result = await db.execute(
        select(ChatConversation)
        .join(Deck, ChatConversation.deck_id == Deck.id)
        .where(ChatConversation.id == conv_id, Deck.user_id == user_id)
        .options(selectinload(ChatConversation.messages))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv


# ─── Chat Conversations ───────────────────────────────────────────────────────

@router.get("/decks/{deck_id}/conversations", response_model=ConversationListResponse)
async def list_conversations(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all chat conversations for a deck, newest first."""
    await _get_deck_or_404(deck_id, current_user.id, db)

    result = await db.execute(
        select(ChatConversation)
        .where(ChatConversation.deck_id == deck_id)
        .options(selectinload(ChatConversation.messages))
        .order_by(ChatConversation.updated_at.desc())
    )
    convs = result.scalars().all()

    summaries = [
        ChatConversationSummary(
            id=c.id,
            deck_id=c.deck_id,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            message_count=len(c.messages),
        )
        for c in convs
    ]
    return ConversationListResponse(conversations=summaries, total=len(summaries))


@router.post(
    "/decks/{deck_id}/conversations",
    response_model=ChatConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    deck_id: uuid.UUID,
    payload: ChatConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new empty chat conversation for a deck."""
    await _get_deck_or_404(deck_id, current_user.id, db)

    conv = ChatConversation(deck_id=deck_id, title=payload.title)
    db.add(conv)
    await db.flush()
    return await _load_conversation(conv.id, current_user.id, db)


@router.get("/conversations/{conv_id}", response_model=ChatConversationResponse)
async def get_conversation(
    conv_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Load a conversation with all its messages."""
    return await _load_conversation(conv_id, current_user.id, db)


@router.delete("/conversations/{conv_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conv_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a conversation and all its messages."""
    conv = await _load_conversation(conv_id, current_user.id, db)
    await db.delete(conv)


@router.patch("/conversations/{conv_id}/title", response_model=ChatConversationResponse)
async def rename_conversation(
    conv_id: uuid.UUID,
    payload: ChatConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rename a conversation."""
    conv = await _load_conversation(conv_id, current_user.id, db)
    conv.title = payload.title
    await db.flush()
    return await _load_conversation(conv_id, current_user.id, db)


@router.post("/conversations/{conv_id}/chat", response_model=ChatMessageResponse)
async def chat_in_conversation(
    conv_id: uuid.UUID,
    request: ConversationChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a message in a conversation. Saves both the user message and the AI reply."""
    conv = await _load_conversation(conv_id, current_user.id, db)

    # Load the deck to get source documents
    deck_result = await db.execute(
        select(Deck)
        .where(Deck.id == conv.deck_id, Deck.user_id == current_user.id)
        .options(selectinload(Deck.source_documents))
    )
    deck = deck_result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

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
        logger.warning("RAG retrieval failed for conversation chat (%s), falling back.", e)
        context_chunks = await get_all_chunks_text_multi(db=db, document_ids=doc_ids)

    if not context_chunks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No text content found in the deck's source documents.",
        )

    history = [{"role": m.role, "content": m.content} for m in conv.messages]

    try:
        reply_text = await chat_with_sources(
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

    user_msg = ChatMessage(
        conversation_id=conv_id,
        role="user",
        content=request.message,
    )
    db.add(user_msg)

    assistant_msg = ChatMessage(
        conversation_id=conv_id,
        role="assistant",
        content=reply_text,
    )
    db.add(assistant_msg)

    if len(conv.messages) == 0 and conv.title == "New Chat":
        conv.title = request.message[:60] + ("…" if len(request.message) > 60 else "")

    await db.flush()
    await db.refresh(assistant_msg)
    return assistant_msg


# ─── Quiz History ─────────────────────────────────────────────────────────────

@router.get("/decks/{deck_id}/quizzes", response_model=QuizListResponse)
async def list_quizzes(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all saved quizzes for a deck, newest first."""
    await _get_deck_or_404(deck_id, current_user.id, db)

    result = await db.execute(
        select(Quiz)
        .where(Quiz.deck_id == deck_id)
        .options(selectinload(Quiz.attempts))
        .order_by(Quiz.created_at.desc())
    )
    quizzes = result.scalars().all()

    summaries = []
    for q in quizzes:
        best_score = None
        best_total = None
        if q.attempts:
            best = max(q.attempts, key=lambda a: a.score / max(a.total, 1))
            best_score = best.score
            best_total = best.total
        summaries.append(
            QuizSummary(
                id=q.id,
                deck_id=q.deck_id,
                title=q.title,
                question_count=len(q.questions) if q.questions else 0,
                created_at=q.created_at,
                attempt_count=len(q.attempts),
                best_score=best_score,
                best_total=best_total,
            )
        )

    return QuizListResponse(quizzes=summaries, total=len(summaries))


@router.post(
    "/decks/{deck_id}/quizzes",
    response_model=QuizResponse,
    status_code=status.HTTP_201_CREATED,
)
async def save_quiz(
    deck_id: uuid.UUID,
    payload: SaveQuizRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a newly generated quiz to the database."""
    await _get_deck_or_404(deck_id, current_user.id, db)

    quiz = Quiz(
        deck_id=deck_id,
        title=payload.title,
        questions=[q.model_dump() for q in payload.questions],
    )
    db.add(quiz)
    await db.flush()
    await db.refresh(quiz)

    result = await db.execute(
        select(Quiz)
        .where(Quiz.id == quiz.id)
        .options(selectinload(Quiz.attempts))
    )
    return result.scalar_one()


@router.get("/quizzes/{quiz_id}", response_model=QuizResponse)
async def get_quiz(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Load a saved quiz with all its attempts (ownership verified via deck)."""
    result = await db.execute(
        select(Quiz)
        .join(Deck, Quiz.deck_id == Deck.id)
        .where(Quiz.id == quiz_id, Deck.user_id == current_user.id)
        .options(selectinload(Quiz.attempts))
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return quiz


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a saved quiz and all its attempts."""
    result = await db.execute(
        select(Quiz)
        .join(Deck, Quiz.deck_id == Deck.id)
        .where(Quiz.id == quiz_id, Deck.user_id == current_user.id)
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    await db.delete(quiz)


@router.post(
    "/quizzes/{quiz_id}/attempts",
    response_model=QuizAttemptResponse,
    status_code=status.HTTP_201_CREATED,
)
async def save_attempt(
    quiz_id: uuid.UUID,
    payload: SaveAttemptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a completed quiz attempt."""
    result = await db.execute(
        select(Quiz)
        .join(Deck, Quiz.deck_id == Deck.id)
        .where(Quiz.id == quiz_id, Deck.user_id == current_user.id)
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    attempt = QuizAttempt(
        quiz_id=quiz_id,
        answers=payload.answers,
        score=payload.score,
        total=payload.total,
    )
    db.add(attempt)
    await db.flush()
    await db.refresh(attempt)
    return attempt
