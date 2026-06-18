"""
Health check endpoint.
Reports status of the database, LLM, and embedding service connectivity.
"""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.config_store import (
    EMBEDDING_BASE_URL,
    EMBEDDING_MODEL,
    LLM_BASE_URL,
    LLM_MODEL,
    get_all_settings,
)
from app.services.embeddings import get_embedding_client
from app.services.llm import get_llm_client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """Simple liveness check — always returns ok if the server is running."""
    return {"status": "ok", "service": "lurastudy-backend"}


@router.get("/health/connectivity")
async def connectivity_check(db: AsyncSession = Depends(get_db)):
    """
    Detailed connectivity check.
    Tests DB reachability and attempts a lightweight LLM / embedding check.
    Returns a status dict with individual component results.
    """
    result = {
        "database": "unknown",
        "llm": "unknown",
        "embedding": "unknown",
        "llm_configured": False,
        "embedding_configured": False,
    }

    # ── Database ────────────────────────────────────────────────────────────
    try:
        await db.execute(select(1))
        result["database"] = "ok"
    except Exception as e:
        logger.warning("Health check — database unreachable: %s", e)
        result["database"] = f"error: {str(e)}"

    # ── LLM ─────────────────────────────────────────────────────────────────
    try:
        cfg = await get_all_settings(db)

        llm_base_url = cfg.get(LLM_BASE_URL, "")
        llm_model = cfg.get(LLM_MODEL, "")
        result["llm_configured"] = bool(llm_base_url and llm_model)

        if llm_base_url and llm_model:
            client = get_llm_client(base_url=llm_base_url, api_key="ollama")
            # Lightweight model list call to verify endpoint
            await client.models.list()
            result["llm"] = "ok"
        else:
            result["llm"] = "not_configured"
    except Exception as e:
        logger.warning("Health check — LLM unreachable: %s", e)
        result["llm"] = f"unreachable: {str(e)}"

    # ── Embedding ───────────────────────────────────────────────────────────
    try:
        emb_base_url = cfg.get(EMBEDDING_BASE_URL, "")
        emb_model = cfg.get(EMBEDDING_MODEL, "")
        result["embedding_configured"] = bool(emb_base_url and emb_model)

        if emb_base_url and emb_model:
            client = get_embedding_client(base_url=emb_base_url, api_key="ollama")
            await client.models.list()
            result["embedding"] = "ok"
        else:
            result["embedding"] = "not_configured"
    except Exception as e:
        logger.warning("Health check — embedding unreachable: %s", e)
        result["embedding"] = f"unreachable: {str(e)}"

    return result