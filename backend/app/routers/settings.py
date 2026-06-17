"""
Settings router.
Handles reading and updating LLM / embedding configuration at runtime.
Settings are now per-user.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.settings import (
    SettingsResponse,
    SettingsUpdate,
    TestConnectionRequest,
    TestConnectionResponse,
)
from app.services.config_store import (
    EMBEDDING_API_KEY,
    EMBEDDING_BASE_URL,
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_MODEL,
    THEME_BG,
    THEME_BORDER,
    THEME_DANGER,
    THEME_FONT,
    THEME_PRIMARY,
    THEME_PRIMARY_HOVER,
    THEME_SUCCESS,
    THEME_SURFACE,
    THEME_SURFACE_2,
    THEME_TEXT,
    THEME_TEXT_MUTED,
    THEME_WARNING,
    get_all_settings,
    set_settings,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])


def _build_response(s: dict[str, str]) -> SettingsResponse:
    return SettingsResponse(
        llm_base_url=s[LLM_BASE_URL],
        llm_api_key=s[LLM_API_KEY],
        llm_model=s[LLM_MODEL],
        embedding_base_url=s[EMBEDDING_BASE_URL],
        embedding_api_key=s[EMBEDDING_API_KEY],
        embedding_model=s[EMBEDDING_MODEL],
        embedding_dimensions=int(s[EMBEDDING_DIMENSIONS]),
        theme_bg=s[THEME_BG],
        theme_surface=s[THEME_SURFACE],
        theme_surface_2=s[THEME_SURFACE_2],
        theme_border=s[THEME_BORDER],
        theme_primary=s[THEME_PRIMARY],
        theme_primary_hover=s[THEME_PRIMARY_HOVER],
        theme_success=s[THEME_SUCCESS],
        theme_warning=s[THEME_WARNING],
        theme_danger=s[THEME_DANGER],
        theme_text=s[THEME_TEXT],
        theme_text_muted=s[THEME_TEXT_MUTED],
        theme_font=s[THEME_FONT],
    )


@router.get("", response_model=SettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's LLM and embedding configuration."""
    s = await get_all_settings(db, current_user.id)
    return _build_response(s)


@router.patch("", response_model=SettingsResponse)
async def update_settings(
    update: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update one or more settings for the current user.
    Only provided (non-None) fields are updated.
    """
    updates: dict[str, str] = {}

    if update.llm_base_url is not None:
        updates[LLM_BASE_URL] = update.llm_base_url
    if update.llm_api_key is not None:
        updates[LLM_API_KEY] = update.llm_api_key
    if update.llm_model is not None:
        updates[LLM_MODEL] = update.llm_model
    if update.embedding_base_url is not None:
        updates[EMBEDDING_BASE_URL] = update.embedding_base_url
    if update.embedding_api_key is not None:
        updates[EMBEDDING_API_KEY] = update.embedding_api_key
    if update.embedding_model is not None:
        updates[EMBEDDING_MODEL] = update.embedding_model
    if update.embedding_dimensions is not None:
        updates[EMBEDDING_DIMENSIONS] = str(update.embedding_dimensions)

    # Theme fields
    if update.theme_bg is not None:
        updates[THEME_BG] = update.theme_bg
    if update.theme_surface is not None:
        updates[THEME_SURFACE] = update.theme_surface
    if update.theme_surface_2 is not None:
        updates[THEME_SURFACE_2] = update.theme_surface_2
    if update.theme_border is not None:
        updates[THEME_BORDER] = update.theme_border
    if update.theme_primary is not None:
        updates[THEME_PRIMARY] = update.theme_primary
    if update.theme_primary_hover is not None:
        updates[THEME_PRIMARY_HOVER] = update.theme_primary_hover
    if update.theme_success is not None:
        updates[THEME_SUCCESS] = update.theme_success
    if update.theme_warning is not None:
        updates[THEME_WARNING] = update.theme_warning
    if update.theme_danger is not None:
        updates[THEME_DANGER] = update.theme_danger
    if update.theme_text is not None:
        updates[THEME_TEXT] = update.theme_text
    if update.theme_text_muted is not None:
        updates[THEME_TEXT_MUTED] = update.theme_text_muted
    if update.theme_font is not None:
        updates[THEME_FONT] = update.theme_font

    if updates:
        await set_settings(db, current_user.id, updates)
        _invalidate_clients()

    s = await get_all_settings(db, current_user.id)
    return _build_response(s)


@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(
    req: TestConnectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Test connectivity to the LLM or embedding endpoint.
    Uses the provided values (or falls back to current saved settings).
    """
    s = await get_all_settings(db, current_user.id)

    if req.type == "llm":
        base_url = req.base_url or s[LLM_BASE_URL]
        api_key = req.api_key or s[LLM_API_KEY]
        model = req.model or s[LLM_MODEL]

        try:
            client = AsyncOpenAI(base_url=base_url, api_key=api_key)
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "Say 'ok' in one word."}],
                max_tokens=5,
                temperature=0,
            )
            reply = response.choices[0].message.content or ""
            return TestConnectionResponse(
                success=True,
                message=f"Connected successfully. Model replied: \"{reply.strip()}\"",
                model=model,
            )
        except Exception as e:
            logger.warning("LLM test connection failed: %s", e)
            return TestConnectionResponse(
                success=False,
                message=f"Connection failed: {str(e)}",
                model=model,
            )

    elif req.type == "embedding":
        base_url = req.base_url or s[EMBEDDING_BASE_URL]
        api_key = req.api_key or s[EMBEDDING_API_KEY]
        model = req.model or s[EMBEDDING_MODEL]

        try:
            client = AsyncOpenAI(base_url=base_url, api_key=api_key)
            response = await client.embeddings.create(
                model=model,
                input="test",
            )
            dims = len(response.data[0].embedding)
            return TestConnectionResponse(
                success=True,
                message=f"Connected successfully. Embedding dimensions: {dims}",
                model=model,
            )
        except Exception as e:
            logger.warning("Embedding test connection failed: %s", e)
            return TestConnectionResponse(
                success=False,
                message=f"Connection failed: {str(e)}",
                model=model,
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'type' must be 'llm' or 'embedding'",
        )


def _invalidate_clients() -> None:
    """Reset cached OpenAI client singletons so they rebuild with new config."""
    import app.services.llm as llm_svc
    import app.services.embeddings as emb_svc

    llm_svc._llm_client = None
    emb_svc._embedding_client = None
    logger.info("LLM and embedding clients invalidated (will rebuild on next use).")
