"""
Auth router — registration, login, and current-user info.
"""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import InviteToken, User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.services.auth import create_access_token, hash_password, verify_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new user.
    - If no users exist yet, the first registrant becomes admin (no invite needed).
    - Otherwise a valid, unused invite token is required.
    """
    # Check if any users exist
    count_result = await db.execute(select(func.count()).select_from(User))
    user_count = count_result.scalar_one()
    is_first_user = user_count == 0

    if not is_first_user:
        # Require a valid invite token
        if not payload.invite_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="An invite token is required to register.",
            )
        try:
            token_uuid = uuid.UUID(payload.invite_token)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid invite token format.",
            )

        invite_result = await db.execute(
            select(InviteToken).where(InviteToken.token == token_uuid)
        )
        invite = invite_result.scalar_one_or_none()

        if invite is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invite token not found.",
            )
        if invite.used_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This invite token has already been used.",
            )
        if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This invite token has expired.",
            )
    else:
        invite = None

    # Check username uniqueness
    existing = await db.execute(select(User).where(User.username == payload.username))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken.",
        )

    # Check email uniqueness (if provided)
    if payload.email:
        existing_email = await db.execute(select(User).where(User.email == payload.email))
        if existing_email.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered.",
            )

    # Create user
    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_admin=is_first_user,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Mark invite as used
    if invite is not None:
        invite.used_by_id = user.id
        invite.used_at = datetime.now(timezone.utc)

    logger.info(
        "New user registered: %s (admin=%s)", user.username, user.is_admin
    )
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with username + password, returns a JWT access token."""
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended.",
        )

    token = create_access_token(
        user_id=user.id,
        username=user.username,
        is_admin=user.is_admin,
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user
