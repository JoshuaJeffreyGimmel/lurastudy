"""
Config store service — reads and writes per-user app settings from the database.
Provides a typed interface over the AppSetting key-value table.
Falls back to the .env / pydantic settings when a key is not in the DB.
"""
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as env_settings
from app.models.settings import AppSetting

logger = logging.getLogger(__name__)

# ─── Setting keys ─────────────────────────────────────────────────────────────
LLM_BASE_URL = "llm_base_url"
LLM_API_KEY = "llm_api_key"
LLM_MODEL = "llm_model"

EMBEDDING_BASE_URL = "embedding_base_url"
EMBEDDING_API_KEY = "embedding_api_key"
EMBEDDING_MODEL = "embedding_model"
EMBEDDING_DIMENSIONS = "embedding_dimensions"

# Ordered list of all setting keys (used for bulk read/write)
ALL_KEYS = [
    LLM_BASE_URL,
    LLM_API_KEY,
    LLM_MODEL,
    EMBEDDING_BASE_URL,
    EMBEDDING_API_KEY,
    EMBEDDING_MODEL,
    EMBEDDING_DIMENSIONS,
]

# Default values from .env / pydantic settings
DEFAULTS: dict[str, str] = {
    LLM_BASE_URL: env_settings.llm_base_url,
    LLM_API_KEY: env_settings.llm_api_key,
    LLM_MODEL: env_settings.llm_model,
    EMBEDDING_BASE_URL: env_settings.embedding_base_url,
    EMBEDDING_API_KEY: env_settings.embedding_api_key,
    EMBEDDING_MODEL: env_settings.embedding_model,
    EMBEDDING_DIMENSIONS: str(env_settings.embedding_dimensions),
}


async def get_all_settings(db: AsyncSession, user_id: uuid.UUID) -> dict[str, str]:
    """Return all settings for a user, merging DB values over defaults."""
    stmt = select(AppSetting).where(AppSetting.user_id == user_id)
    result = await db.execute(stmt)
    rows = {row.key: row.value for row in result.scalars().all()}

    merged = dict(DEFAULTS)
    merged.update(rows)
    return merged


async def get_setting(db: AsyncSession, user_id: uuid.UUID, key: str) -> str:
    """Return a single setting value for a user, falling back to the default."""
    stmt = select(AppSetting).where(
        AppSetting.user_id == user_id, AppSetting.key == key
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if row is not None:
        return row.value
    return DEFAULTS.get(key, "")


async def set_setting(db: AsyncSession, user_id: uuid.UUID, key: str, value: str) -> None:
    """Upsert a single setting value for a user."""
    stmt = select(AppSetting).where(
        AppSetting.user_id == user_id, AppSetting.key == key
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if row is None:
        row = AppSetting(user_id=user_id, key=key, value=value)
        db.add(row)
    else:
        row.value = value


async def set_settings(db: AsyncSession, user_id: uuid.UUID, updates: dict[str, str]) -> None:
    """Upsert multiple settings at once for a user."""
    for key, value in updates.items():
        await set_setting(db, user_id, key, value)
