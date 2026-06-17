"""
Pydantic schemas for authentication endpoints.
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ─── Registration ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    password: str = Field(..., min_length=8)
    invite_token: Optional[str] = None  # UUID string; required unless first user


# ─── Login ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ─── User info ─────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: Optional[str]
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Invite tokens ─────────────────────────────────────────────────────────────

class InviteTokenResponse(BaseModel):
    token: uuid.UUID
    created_by_id: uuid.UUID
    used_by_id: Optional[uuid.UUID]
    expires_at: Optional[datetime]
    used_at: Optional[datetime]
    created_at: datetime
    # Convenience: the full invite URL is built on the frontend
    is_used: bool

    model_config = {"from_attributes": True}


class InviteListResponse(BaseModel):
    invites: list[InviteTokenResponse]
    total: int


# ─── Admin user list ───────────────────────────────────────────────────────────

class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int
