"""
Embedding generation service using the OpenAI-compatible API.
Works with Ollama (nomic-embed-text), OpenAI (text-embedding-3-small), etc.

Configuration is read from the database (config_store) on every call,
so changes made via the Settings UI take effect immediately without restart.
"""
import asyncio
from openai import AsyncOpenAI

from app.config import settings as env_settings

_embedding_client: AsyncOpenAI | None = None


def get_embedding_client(base_url: str | None = None, api_key: str | None = None) -> AsyncOpenAI:
    """
    Return the cached embedding client, or build a new one.
    When called without arguments, uses the module-level cached client.
    """
    global _embedding_client
    if base_url is not None or api_key is not None:
        return AsyncOpenAI(
            base_url=base_url or env_settings.embedding_base_url,
            api_key=api_key or env_settings.embedding_api_key,
        )
    if _embedding_client is None:
        _embedding_client = AsyncOpenAI(
            base_url=env_settings.embedding_base_url,
            api_key=env_settings.embedding_api_key,
        )
    return _embedding_client


async def embed_text(
    text: str,
    embedding_base_url: str | None = None,
    embedding_api_key: str | None = None,
    embedding_model: str | None = None,
) -> list[float]:
    """Generate an embedding vector for a single text string."""
    client = get_embedding_client(embedding_base_url, embedding_api_key)
    model = embedding_model or env_settings.embedding_model
    response = await client.embeddings.create(
        model=model,
        input=text,
    )
    return response.data[0].embedding


async def embed_texts(
    texts: list[str],
    batch_size: int = 16,
    embedding_base_url: str | None = None,
    embedding_api_key: str | None = None,
    embedding_model: str | None = None,
) -> list[list[float]]:
    """
    Generate embeddings for a list of texts.
    Processes in batches to avoid overwhelming the embedding endpoint.
    """
    all_embeddings: list[list[float]] = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        tasks = [
            embed_text(t, embedding_base_url, embedding_api_key, embedding_model)
            for t in batch
        ]
        batch_results = await asyncio.gather(*tasks)
        all_embeddings.extend(batch_results)
    return all_embeddings
