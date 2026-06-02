"""
RAG (Retrieval-Augmented Generation) service.
Performs semantic search over document chunks using pgvector cosine similarity.
"""
import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Chunk
from app.services.embeddings import embed_text


async def retrieve_relevant_chunks(
    db: AsyncSession,
    document_id: uuid.UUID,
    query: str,
    top_k: int = 10,
) -> list[str]:
    """
    Embed the query and return the top-k most semantically similar
    chunk contents from the given document.
    """
    query_embedding = await embed_text(query)

    # pgvector cosine distance operator: <=>
    # We cast the Python list to a vector literal for the query
    embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

    stmt = (
        select(Chunk.content)
        .where(Chunk.document_id == document_id)
        .where(Chunk.embedding.is_not(None))
        .order_by(
            Chunk.embedding.op("<=>")(text(f"'{embedding_str}'::vector"))
        )
        .limit(top_k)
    )

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return list(rows)


async def get_all_chunks_text(
    db: AsyncSession,
    document_id: uuid.UUID,
) -> list[str]:
    """
    Return all chunk contents for a document (used when embeddings are
    not available or as a fallback).
    """
    stmt = (
        select(Chunk.content)
        .where(Chunk.document_id == document_id)
        .order_by(Chunk.chunk_index)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())
