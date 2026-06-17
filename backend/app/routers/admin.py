"""
Admin router — invite token management and user listing.
Only accessible to admin users.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin
from app.models.user import InviteToken, User
from app.schemas.auth import InviteListResponse, InviteTokenResponse, UserListResponse, UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


# ─── Invite Tokens ────────────────────────────────────────────────────────────

@router.post("/invites", response_model=InviteTokenResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    expires_in_days: Optional[int] = Query(None, ge=1, le=365, description="Token expiry in days (omit for no expiry)"),
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new invite token. Admin only."""
    expires_at = None
    if expires_in_days is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

    invite = InviteToken(
        created_by_id=current_admin.id,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.flush()
    await db.refresh(invite)

    logger.info("Admin %s created invite token %s", current_admin.username, invite.token)

    return InviteTokenResponse(
        token=invite.token,
        created_by_id=invite.created_by_id,
        used_by_id=invite.used_by_id,
        expires_at=invite.expires_at,
        used_at=invite.used_at,
        created_at=invite.created_at,
        is_used=invite.used_at is not None,
    )


@router.get("/invites", response_model=InviteListResponse)
async def list_invites(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all invite tokens. Admin only."""
    result = await db.execute(
        select(InviteToken).order_by(InviteToken.created_at.desc())
    )
    invites = result.scalars().all()

    items = [
        InviteTokenResponse(
            token=inv.token,
            created_by_id=inv.created_by_id,
            used_by_id=inv.used_by_id,
            expires_at=inv.expires_at,
            used_at=inv.used_at,
            created_at=inv.created_at,
            is_used=inv.used_at is not None,
        )
        for inv in invites
    ]
    return InviteListResponse(invites=items, total=len(items))


@router.delete("/invites/{token}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite(
    token: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Revoke (delete) an unused invite token. Admin only."""
    result = await db.execute(select(InviteToken).where(InviteToken.token == token))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite token not found.")
    if invite.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot revoke an already-used invite token.",
        )
    await db.delete(invite)
    logger.info("Admin %s revoked invite token %s", current_admin.username, token)


# ─── User Management ──────────────────────────────────────────────────────────

@router.get("/users", response_model=UserListResponse)
async def list_users(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all registered users. Admin only."""
    result = await db.execute(select(User).order_by(User.created_at.asc()))
    users = result.scalars().all()
    return UserListResponse(users=list(users), total=len(users))
