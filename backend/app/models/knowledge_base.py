import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# Many-to-many join table: knowledge_base <-> document
knowledge_base_documents = Table(
    "knowledge_base_documents",
    Base.metadata,
    Column(
        "knowledge_base_id",
        UUID(as_uuid=True),
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "document_id",
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        "Document",
        secondary=knowledge_base_documents,
        back_populates="knowledge_bases",
        lazy="selectin",
    )
    decks: Mapped[list["Deck"]] = relationship(  # noqa: F821
        "Deck", back_populates="knowledge_base", cascade="all, delete-orphan"
    )
