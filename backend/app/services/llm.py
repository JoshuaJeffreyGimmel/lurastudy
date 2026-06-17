"""
LLM connector service using the OpenAI-compatible API.
Handles structured JSON output for activity generation and chat.

Configuration is read from the database (config_store) on every call,
so changes made via the Settings UI take effect immediately without restart.
"""
import json
import logging
from typing import Any

from openai import AsyncOpenAI

from app.activities import get_activity
from app.config import settings as env_settings

logger = logging.getLogger(__name__)

_llm_client: AsyncOpenAI | None = None

CHAT_SYSTEM_PROMPT = """You are a helpful study assistant. You have been given excerpts from study materials.
Answer the user's questions based on the provided context. Be concise, accurate, and helpful.
If the answer is not in the provided context, say so honestly.
Format your responses clearly — use bullet points or numbered lists when appropriate."""


# ─── Generic Activity Generation ───────────────────────────────────────────────

async def generate_activity_items(
    activity_type: str,
    context_chunks: list[str],
    max_items: int = 20,
    llm_base_url: str | None = None,
    llm_api_key: str | None = None,
    llm_model: str | None = None,
) -> list[dict[str, Any]]:
    """
    Generate items for any registered activity type.

    Looks up the activity definition, builds the prompt, calls the LLM,
    and parses the response using the activity type's own parser.

    Returns a list of validated item dicts.
    Raises ``KeyError`` for unknown activity types, ``ValueError`` for
    LLM parsing failures.
    """
    activity = get_activity(activity_type)

    # Resolve config: explicit args > cached client defaults
    if llm_base_url or llm_api_key:
        client = AsyncOpenAI(
            base_url=llm_base_url or env_settings.llm_base_url,
            api_key=llm_api_key or env_settings.llm_api_key,
        )
    else:
        client = get_llm_client()

    model = llm_model or env_settings.llm_model

    # Build the context string
    context = "\n\n---\n\n".join(context_chunks)
    max_context_chars = 12000
    if len(context) > max_context_chars:
        context = context[:max_context_chars] + "\n\n[... content truncated ...]"

    system_prompt = activity.system_prompt_template.format(max_items=max_items)
    user_prompt = activity.build_user_prompt(context)

    logger.info(
        "Requesting '%s' generation from LLM (model=%s, chunks=%d, max_items=%d)",
        activity_type, model, len(context_chunks), max_items,
    )

    # Try with response_format first; retry without for models that don't support it
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
        )
    except Exception as e:
        logger.warning(
            "LLM call with response_format failed (%s), retrying without it.", e
        )
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
        )

    raw_content = response.choices[0].message.content or ""
    logger.debug("LLM raw response for '%s': %s", activity_type, raw_content[:300])

    return activity.parse_llm_response(raw_content)


# ─── Backward-compatible wrappers ──────────────────────────────────────────────
# These delegate to the generic function so existing frontend code still works.

async def generate_flashcards(
    context_chunks: list[str],
    max_cards: int = 20,
    llm_base_url: str | None = None,
    llm_api_key: str | None = None,
    llm_model: str | None = None,
) -> list[dict[str, str]]:
    """Backward-compatible wrapper — delegates to ``generate_activity_items``."""
    return await generate_activity_items(
        activity_type="flashcard",
        context_chunks=context_chunks,
        max_items=max_cards,
        llm_base_url=llm_base_url,
        llm_api_key=llm_api_key,
        llm_model=llm_model,
    )


async def generate_quiz(
    context_chunks: list[str],
    max_questions: int = 10,
    llm_base_url: str | None = None,
    llm_api_key: str | None = None,
    llm_model: str | None = None,
) -> list[dict]:
    """Backward-compatible wrapper — delegates to ``generate_activity_items``."""
    return await generate_activity_items(
        activity_type="quiz",
        context_chunks=context_chunks,
        max_items=max_questions,
        llm_base_url=llm_base_url,
        llm_api_key=llm_api_key,
        llm_model=llm_model,
    )


# ─── LLM Client ────────────────────────────────────────────────────────────────

def get_llm_client(base_url: str | None = None, api_key: str | None = None) -> AsyncOpenAI:
    """
    Return the cached LLM client, or build a new one if config has changed.
    When called without arguments, uses the module-level cached client.
    """
    global _llm_client
    if base_url is not None or api_key is not None:
        # Explicit config provided — build a fresh client (used by test-connection)
        return AsyncOpenAI(
            base_url=base_url or env_settings.llm_base_url,
            api_key=api_key or env_settings.llm_api_key,
        )
    if _llm_client is None:
        _llm_client = AsyncOpenAI(
            base_url=env_settings.llm_base_url,
            api_key=env_settings.llm_api_key,
        )
    return _llm_client


# ─── Chat ──────────────────────────────────────────────────────────────────────

async def chat_with_sources(
    context_chunks: list[str],
    message: str,
    history: list[dict[str, str]] | None = None,
    llm_base_url: str | None = None,
    llm_api_key: str | None = None,
    llm_model: str | None = None,
) -> str:
    """
    Chat with the LLM using retrieved context chunks as grounding.

    Args:
        context_chunks: Relevant text chunks retrieved via RAG
        message: The user's current message
        history: Previous conversation turns [{"role": "user"|"assistant", "content": "..."}]
        llm_base_url: Optional LLM base URL override
        llm_api_key: Optional LLM API key override
        llm_model: Optional model name override

    Returns:
        The assistant's reply as a string.
    """
    if llm_base_url or llm_api_key:
        client = AsyncOpenAI(
            base_url=llm_base_url or env_settings.llm_base_url,
            api_key=llm_api_key or env_settings.llm_api_key,
        )
    else:
        client = get_llm_client()

    model = llm_model or env_settings.llm_model

    # Build context string
    context = "\n\n---\n\n".join(context_chunks)
    max_context_chars = 10000
    if len(context) > max_context_chars:
        context = context[:max_context_chars] + "\n\n[... content truncated ...]"

    # Build messages list
    messages = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Here are the study materials to reference:\n\n{context}\n\n---\n\nPlease answer questions based on the above materials.",
        },
        {
            "role": "assistant",
            "content": "I've reviewed the study materials. I'm ready to help you understand them. What would you like to know?",
        },
    ]

    # Add conversation history
    if history:
        for turn in history:
            messages.append({"role": turn["role"], "content": turn["content"]})

    # Add the current user message
    messages.append({"role": "user", "content": message})

    logger.info("Requesting chat response from LLM (model=%s, context_chunks=%d)", model, len(context_chunks))

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.6,
        )
    except Exception as e:
        logger.error("LLM chat call failed: %s", e)
        raise

    reply = response.choices[0].message.content or ""
    return reply.strip()
