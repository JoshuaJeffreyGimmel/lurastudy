import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Table, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# Many-to-many join table: deck <-> document (deck sources)
deck_documents = Table(
    "deck_documents",
    Base.metadata,
    Column(
        "deck_id",
        UUID(as_uuid=True),
        ForeignKey("decks.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "document_id",
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Deck(Base):
    __tablename__ = "decks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Source documents for this deck (many-to-many)
    source_documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        "Document",
        secondary=deck_documents,
        back_populates="decks",
        lazy="selectin",
    )
    flashcards: Mapped[list["Flashcard"]] = relationship(
        "Flashcard", back_populates="deck", cascade="all, delete-orphan"
    )
    chat_conversations: Mapped[list["ChatConversation"]] = relationship(  # noqa: F821
        "ChatConversation", back_populates="deck", cascade="all, delete-orphan"
    )
    quizzes: Mapped[list["Quiz"]] = relationship(  # noqa: F821
        "Quiz", back_populates="deck", cascade="all, delete-orphan"
    )


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    deck_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("decks.id", ondelete="CASCADE"), nullable=False
    )
    front: Mapped[str] = mapped_column(Text, nullable=False)
    back: Mapped[str] = mapped_column(Text, nullable=False)
    card_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Legacy study state (kept for backward compatibility)
    got_it: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ── SM-2 Spaced Repetition fields ──────────────────────────────────────────
    # due_date: null means the card is new/unseen (treat as due immediately)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, default=None)
    # Number of consecutive correct reviews
    sm2_repetitions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Ease factor — how quickly the interval grows (min 1.3, starts at 2.5)
    sm2_ease_factor: Mapped[float] = mapped_column(Float, nullable=False, default=2.5)
    # Current interval in days between reviews
    sm2_interval: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    deck: Mapped["Deck"] = relationship("Deck", back_populates="flashcards")
