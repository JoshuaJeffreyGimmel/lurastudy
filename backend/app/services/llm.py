"""
LLM connector service using the OpenAI-compatible API.
Handles structured JSON output for flashcard generation.
"""
import json
import logging
from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

_llm_client: AsyncOpenAI | None = None

FLASHCARD_SYSTEM_PROMPT = """You are an expert study assistant that creates high-quality flashcards from educational material.

Your task is to generate flashcards from the provided text. Each flashcard should:
- Have a clear, concise FRONT (a question, term, or concept)
- Have an accurate, informative BACK (the answer, definition, or explanation)
- Focus on the most important concepts, facts, and relationships
- Be self-contained and understandable without additional context

You MUST respond with ONLY valid JSON in this exact format, with no additional text, markdown, or explanation:
{
  "flashcards": [
    {"front": "Question or term here", "back": "Answer or definition here"},
    {"front": "Another question", "back": "Another answer"}
  ]
}

Generate between 5 and {max_cards} flashcards. Prioritize quality over quantity."""


def get_llm_client() -> AsyncOpenAI:
    global _llm_client
    if _llm_client is None:
        _llm_client = AsyncOpenAI(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
        )
    return _llm_client


async def generate_flashcards(
    context_chunks: list[str],
    max_cards: int = 20,
) -> list[dict[str, str]]:
    """
    Generate flashcards from a list of text chunks using the LLM.

    Returns a list of dicts with 'front' and 'back' keys.
    Raises ValueError if the LLM response cannot be parsed.
    """
    client = get_llm_client()

    # Build the context from retrieved chunks
    context = "\n\n---\n\n".join(context_chunks)

    # Truncate context if it's extremely long (safety guard)
    max_context_chars = 12000
    if len(context) > max_context_chars:
        context = context[:max_context_chars] + "\n\n[... content truncated ...]"

    system_prompt = FLASHCARD_SYSTEM_PROMPT.format(max_cards=max_cards)

    user_message = f"""Please create flashcards from the following educational material:

{context}"""

    logger.info(
        "Requesting flashcard generation from LLM (model=%s, chunks=%d)",
        settings.llm_model,
        len(context_chunks),
    )

    try:
        response = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
        )
    except Exception as e:
        # Some local models don't support response_format; retry without it
        logger.warning(
            "LLM call with response_format failed (%s), retrying without it.", e
        )
        response = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.4,
        )

    raw_content = response.choices[0].message.content or ""
    logger.debug("LLM raw response: %s", raw_content[:500])

    # Parse and validate the JSON response
    parsed = _parse_flashcard_response(raw_content)
    return parsed


def _parse_flashcard_response(raw: str) -> list[dict[str, str]]:
    """
    Parse the LLM response into a list of flashcard dicts.
    Handles common LLM quirks like wrapping JSON in markdown code blocks.
    """
    # Strip markdown code fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first and last fence lines
        cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}\nRaw response: {raw[:300]}")

    if "flashcards" not in data:
        raise ValueError(
            f"LLM response missing 'flashcards' key. Got keys: {list(data.keys())}"
        )

    cards = data["flashcards"]
    if not isinstance(cards, list):
        raise ValueError("'flashcards' must be a list")

    validated: list[dict[str, str]] = []
    for i, card in enumerate(cards):
        if not isinstance(card, dict):
            logger.warning("Skipping non-dict card at index %d", i)
            continue
        front = str(card.get("front", "")).strip()
        back = str(card.get("back", "")).strip()
        if front and back:
            validated.append({"front": front, "back": back})
        else:
            logger.warning("Skipping card %d with empty front or back", i)

    if not validated:
        raise ValueError("LLM returned no valid flashcards")

    return validated
