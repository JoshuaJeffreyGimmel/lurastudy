"""
Authentication service — JWT creation/verification and password hashing.
"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.config import settings

# ─── Password hashing ─────────────────────────────────────────────────────────
# bcrypt has a hard 72-byte limit. We pre-hash the password with SHA-256 so
# that any password length is safely handled without silent truncation.

def _prepare(plain: str) -> bytes:
    """SHA-256 pre-hash → 64 hex chars (well within bcrypt's 72-byte limit)."""
    return hashlib.sha256(plain.encode("utf-8")).hexdigest().encode("ascii")


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_prepare(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_prepare(plain), hashed.encode("utf-8"))


# ─── JWT ──────────────────────────────────────────────────────────────────────

ALGORITHM = "HS256"


def create_access_token(user_id: uuid.UUID, username: str, is_admin: bool) -> str:
    """Create a signed JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {
        "sub": str(user_id),
        "username": username,
        "is_admin": is_admin,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and verify a JWT token.
    Returns the payload dict on success, None on failure.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
