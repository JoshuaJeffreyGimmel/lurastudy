"""
Embedding generation service using the OpenAI-compatible API.
Works with Ollama (nomic-embed-text), OpenAI (text-embedding-3-small), etc.
"""
import asyncio
from openai import AsyncOpenAI

from app.config import settings

_embedding_client: AsyncOpenAI | None = None


def get_embedding_client() -> AsyncOpenAI:
    global _embedding_client
    if _embedding_client is None:
        _embedding_client = AsyncOpenAI(
            base_url=settings.embedding_base_url,
            api_key=settings.embedding_api_key,
        )
    return _embedding_client


async def embed_text(text: str) -> list[float]:
    """Generate an embedding vector for a single text string."""
    client = get_embedding_client()
    response = await client.embeddings.create(
        model=settings.embedding_model,
        input=text,
    )
    return response.data[0].embedding


async def embed_texts(texts: list[str], batch_size: int = 16) -> list[list[float]]:
    """
    Generate embeddings for a list of texts.
    Processes in batches to avoid overwhelming the embedding endpoint.
    """
    all_embeddings: list[list[float]] = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        tasks = [embed_text(t) for t in batch]
        batch_results = await asyncio.gather(*tasks)
        all_embeddings.extend(batch_results)
    return all_embeddings
