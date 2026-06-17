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

# Theme keys
THEME_BG = "theme_bg"
THEME_SURFACE = "theme_surface"
THEME_SURFACE_2 = "theme_surface_2"
THEME_BORDER = "theme_border"
THEME_PRIMARY = "theme_primary"
THEME_PRIMARY_HOVER = "theme_primary_hover"
THEME_SUCCESS = "theme_success"
THEME_WARNING = "theme_warning"
THEME_DANGER = "theme_danger"
THEME_TEXT = "theme_text"
THEME_TEXT_MUTED = "theme_text_muted"
THEME_FONT = "theme_font"

# Ordered list of all setting keys (used for bulk read/write)
ALL_KEYS = [
    LLM_BASE_URL,
    LLM_API_KEY,
    LLM_MODEL,
    EMBEDDING_BASE_URL,
    EMBEDDING_API_KEY,
    EMBEDDING_MODEL,
    EMBEDDING_DIMENSIONS,
    THEME_BG,
    THEME_SURFACE,
    THEME_SURFACE_2,
    THEME_BORDER,
    THEME_PRIMARY,
    THEME_PRIMARY_HOVER,
    THEME_SUCCESS,
    THEME_WARNING,
    THEME_DANGER,
    THEME_TEXT,
    THEME_TEXT_MUTED,
    THEME_FONT,
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
    # Theme defaults matching the dark theme in index.css
    THEME_BG: "#0f1117",
    THEME_SURFACE: "#1a1d27",
    THEME_SURFACE_2: "#22263a",
    THEME_BORDER: "#2e3250",
    THEME_PRIMARY: "#6c63ff",
    THEME_PRIMARY_HOVER: "#5a52e0",
    THEME_SUCCESS: "#22c55e",
    THEME_WARNING: "#f59e0b",
    THEME_DANGER: "#ef4444",
    THEME_TEXT: "#e2e8f0",
    THEME_TEXT_MUTED: "#8892a4",
    THEME_FONT: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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