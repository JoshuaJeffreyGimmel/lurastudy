"""
LLM connector service using the OpenAI-compatible API.
Handles structured JSON output for flashcard generation and chat.

Configuration is read from the database (config_store) on every call,
so changes made via the Settings UI take effect immediately without restart.
"""
import json
import logging
from openai import AsyncOpenAI

from app.config import settings as env_settings

logger = logging.getLogger(__name__)

_llm_client: AsyncOpenAI | None = None

FLASHCARD_SYSTEM_PROMPT = """You are an expert study assistant that creates high-quality flashcards from educational material.

Your task is to generate flashcards from the provided text. Each flashcard should:
- Have a clear, concise FRONT (a question, term, or concept)
- Have an accurate, informative BACK (the answer, definition, or explanation)
- Focus on the most important concepts, facts, and relationships
- Be self-contained and understandable without additional context

You MUST respond with ONLY valid JSON in this exact format, with no additional text, markdown, or explanation:
{{
  "flashcards": [
    {{"front": "Question or term here", "back": "Answer or definition here"}},
    {{"front": "Another question", "back": "Another answer"}}
  ]
}}

Generate between 5 and {max_cards} flashcards. Prioritize quality over quantity."""

CHAT_SYSTEM_PROMPT = """You are a helpful study assistant. You have been given excerpts from study materials.
Answer the user's questions based on the provided context. Be concise, accurate, and helpful.
If the answer is not in the provided context, say so honestly.
Format your responses clearly — use bullet points or numbered lists when appropriate."""

QUIZ_SYSTEM_PROMPT = """You are an expert quiz creator that generates multiple-choice questions from educational material.

Your task is to generate quiz questions from the provided text. Each question should:
- Have a clear, unambiguous question
- Have exactly 4 answer options labeled A, B, C, D
- Have exactly one correct answer
- Have plausible but clearly incorrect distractors
- Focus on important concepts, facts, and relationships

You MUST respond with ONLY valid JSON in this exact format, with no additional text, markdown, or explanation:
{{
  "questions": [
    {{
      "question": "What is the question?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correct_index": 0,
      "explanation": "Brief explanation of why the correct answer is right."
    }}
  ]
}}

The correct_index is 0-based (0 = first option, 1 = second, etc.).
Generate between 5 and {max_questions} questions. Prioritize quality over quantity."""


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


async def generate_flashcards(
    context_chunks: list[str],
    max_cards: int = 20,
    llm_base_url: str | None = None,
    llm_api_key: str | None = None,
    llm_model: str | None = None,
) -> list[dict[str, str]]:
    """
    Generate flashcards from a list of text chunks using the LLM.

    Accepts optional override parameters so the settings router can pass
    DB-stored config without needing a global state mutation.

    Returns a list of dicts with 'front' and 'back' keys.
    Raises ValueError if the LLM response cannot be parsed.
    """
    # Resolve config: explicit args > cached client defaults
    if llm_base_url or llm_api_key:
        client = AsyncOpenAI(
            base_url=llm_base_url or env_settings.llm_base_url,
            api_key=llm_api_key or env_settings.llm_api_key,
        )
    else:
        client = get_llm_client()

    model = llm_model or env_settings.llm_model

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
        model,
        len(context_chunks),
    )

    try:
        response = await client.chat.completions.create(
            model=model,
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
            model=model,
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


async def generate_quiz(
    context_chunks: list[str],
    max_questions: int = 10,
    llm_base_url: str | None = None,
    llm_api_key: str | None = None,
    llm_model: str | None = None,
) -> list[dict]:
    """
    Generate multiple-choice quiz questions from a list of text chunks using the LLM.

    Returns a list of dicts with keys:
      question (str), options (list[str] of 4), correct_index (int 0-3), explanation (str)
    Raises ValueError if the LLM response cannot be parsed.
    """
    if llm_base_url or llm_api_key:
        client = AsyncOpenAI(
            base_url=llm_base_url or env_settings.llm_base_url,
            api_key=llm_api_key or env_settings.llm_api_key,
        )
    else:
        client = get_llm_client()

    model = llm_model or env_settings.llm_model

    context = "\n\n---\n\n".join(context_chunks)
    max_context_chars = 12000
    if len(context) > max_context_chars:
        context = context[:max_context_chars] + "\n\n[... content truncated ...]"

    system_prompt = QUIZ_SYSTEM_PROMPT.format(max_questions=max_questions)
    user_message = f"""Please create multiple-choice quiz questions from the following educational material:

{context}"""

    logger.info(
        "Requesting quiz generation from LLM (model=%s, chunks=%d)",
        model,
        len(context_chunks),
    )

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
        )
    except Exception as e:
        logger.warning(
            "LLM quiz call with response_format failed (%s), retrying without it.", e
        )
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.4,
        )

    raw_content = response.choices[0].message.content or ""
    logger.debug("LLM quiz raw response: %s", raw_content[:500])

    return _parse_quiz_response(raw_content)


def _parse_quiz_response(raw: str) -> list[dict]:
    """
    Parse the LLM response into a list of quiz question dicts.
    Handles common LLM quirks like wrapping JSON in markdown code blocks.
    """
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}\nRaw response: {raw[:300]}")

    if "questions" not in data:
        raise ValueError(
            f"LLM response missing 'questions' key. Got keys: {list(data.keys())}"
        )

    questions = data["questions"]
    if not isinstance(questions, list):
        raise ValueError("'questions' must be a list")

    validated: list[dict] = []
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            logger.warning("Skipping non-dict question at index %d", i)
            continue
        question = str(q.get("question", "")).strip()
        options = q.get("options", [])
        correct_index = q.get("correct_index", None)
        explanation = str(q.get("explanation", "")).strip()

        if not question:
            logger.warning("Skipping question %d with empty question text", i)
            continue
        if not isinstance(options, list) or len(options) != 4:
            logger.warning("Skipping question %d: options must be a list of 4", i)
            continue
        if not isinstance(correct_index, int) or not (0 <= correct_index <= 3):
            logger.warning("Skipping question %d: invalid correct_index %s", i, correct_index)
            continue

        validated.append({
            "question": question,
            "options": [str(o).strip() for o in options],
            "correct_index": correct_index,
            "explanation": explanation,
        })

    if not validated:
        raise ValueError("LLM returned no valid quiz questions")

    return validated
