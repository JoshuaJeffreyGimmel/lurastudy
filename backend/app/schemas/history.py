"""
Pydantic schemas for chat conversations, chat messages, quizzes, and quiz attempts.
"""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


# ─── Chat ──────────────────────────────────────────────────────────────────────

class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatConversationSummary(BaseModel):
    """Lightweight summary used in the conversations list."""
    id: uuid.UUID
    deck_id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = {"from_attributes": True}


class ChatConversationResponse(BaseModel):
    id: uuid.UUID
    deck_id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[ChatMessageResponse] = []

    model_config = {"from_attributes": True}


class ChatConversationCreate(BaseModel):
    title: str = "New Chat"


class ConversationListResponse(BaseModel):
    conversations: list[ChatConversationSummary]
    total: int


class ConversationChatRequest(BaseModel):
    """Send a message within an existing conversation."""
    message: str


# ─── Quiz ──────────────────────────────────────────────────────────────────────

class QuizQuestionData(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    explanation: str


class QuizSummary(BaseModel):
    """Lightweight summary used in the quiz history list."""
    id: uuid.UUID
    deck_id: uuid.UUID
    title: str
    question_count: int
    created_at: datetime
    attempt_count: int = 0
    best_score: int | None = None
    best_total: int | None = None

    model_config = {"from_attributes": True}


class QuizResponse(BaseModel):
    id: uuid.UUID
    deck_id: uuid.UUID
    title: str
    questions: list[Any]  # raw JSON list
    created_at: datetime
    attempts: list["QuizAttemptResponse"] = []

    model_config = {"from_attributes": True}


class QuizListResponse(BaseModel):
    quizzes: list[QuizSummary]
    total: int


class SaveQuizRequest(BaseModel):
    """Save a newly generated quiz to the database."""
    title: str = "Quiz"
    questions: list[QuizQuestionData]


class QuizAttemptResponse(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    answers: Any  # JSON dict
    score: int
    total: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SaveAttemptRequest(BaseModel):
    """Save a completed quiz attempt."""
    answers: dict[str, int]  # { "0": 2, "1": 0, ... }
    score: int
    total: int


QuizResponse.model_rebuild()
