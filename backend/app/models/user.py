"""
User and InviteToken models for authentication.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_blocked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships to user-owned data
    documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        "Document", back_populates="owner", cascade="all, delete-orphan"
    )
    decks: Mapped[list["Deck"]] = relationship(  # noqa: F821
        "Deck", back_populates="owner", cascade="all, delete-orphan"
    )
    knowledge_bases: Mapped[list["KnowledgeBase"]] = relationship(  # noqa: F821
        "KnowledgeBase", back_populates="owner", cascade="all, delete-orphan"
    )
    app_settings: Mapped[list["AppSetting"]] = relationship(  # noqa: F821
        "AppSetting", back_populates="owner", cascade="all, delete-orphan"
    )
    invite_tokens_created: Mapped[list["InviteToken"]] = relationship(
        "InviteToken",
        foreign_keys="InviteToken.created_by_id",
        back_populates="created_by",
        cascade="all, delete-orphan",
    )


class InviteToken(Base):
    __tablename__ = "invite_tokens"

    token: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    used_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    created_by: Mapped["User"] = relationship(
        "User", foreign_keys=[created_by_id], back_populates="invite_tokens_created"
    )
    used_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[used_by_id]
    )
