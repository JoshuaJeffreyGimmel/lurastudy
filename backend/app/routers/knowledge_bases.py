"""
Knowledge Base router.
Handles CRUD for knowledge bases (named collections of documents).
"""
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.document import Document
from app.models.knowledge_base import KnowledgeBase
from app.schemas.knowledge_base import (
    KnowledgeBaseCreate,
    KnowledgeBaseListResponse,
    KnowledgeBaseResponse,
    KnowledgeBaseSummaryResponse,
    KnowledgeBaseUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge-bases", tags=["knowledge-bases"])


@router.post("", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_base(
    payload: KnowledgeBaseCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new knowledge base, optionally with an initial set of documents."""
    kb = KnowledgeBase(name=payload.name)
    db.add(kb)
    await db.flush()

    if payload.document_ids:
        stmt = select(Document).where(Document.id.in_(payload.document_ids))
        result = await db.execute(stmt)
        docs = result.scalars().all()
        found_ids = {d.id for d in docs}
        missing = set(payload.document_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Documents not found: {[str(m) for m in missing]}",
            )
        kb.documents = list(docs)

    await db.flush()
    await db.refresh(kb)

    # Reload with documents
    stmt = (
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb.id)
        .options(selectinload(KnowledgeBase.documents))
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get("", response_model=KnowledgeBaseListResponse)
async def list_knowledge_bases(
    db: AsyncSession = Depends(get_db),
):
    """Return all knowledge bases with document counts."""
    stmt = (
        select(KnowledgeBase)
        .options(selectinload(KnowledgeBase.documents))
        .order_by(KnowledgeBase.created_at.desc())
    )
    result = await db.execute(stmt)
    kbs = result.scalars().all()

    summaries = [
        KnowledgeBaseSummaryResponse(
            id=kb.id,
            name=kb.name,
            created_at=kb.created_at,
            document_count=len(kb.documents),
        )
        for kb in kbs
    ]
    return KnowledgeBaseListResponse(knowledge_bases=summaries, total=len(summaries))


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(
    kb_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return a knowledge base with its documents."""
    stmt = (
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id)
        .options(selectinload(KnowledgeBase.documents))
    )
    result = await db.execute(stmt)
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return kb


@router.patch("/{kb_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_base(
    kb_id: uuid.UUID,
    payload: KnowledgeBaseUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a knowledge base name and/or replace its document set."""
    stmt = (
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id)
        .options(selectinload(KnowledgeBase.documents))
    )
    result = await db.execute(stmt)
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    if payload.name is not None:
        kb.name = payload.name

    if payload.document_ids is not None:
        stmt = select(Document).where(Document.id.in_(payload.document_ids))
        result = await db.execute(stmt)
        docs = result.scalars().all()
        found_ids = {d.id for d in docs}
        missing = set(payload.document_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Documents not found: {[str(m) for m in missing]}",
            )
        kb.documents = list(docs)

    await db.flush()
    await db.refresh(kb)

    stmt = (
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id)
        .options(selectinload(KnowledgeBase.documents))
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.post("/{kb_id}/documents/{document_id}", response_model=KnowledgeBaseResponse)
async def add_document_to_knowledge_base(
    kb_id: uuid.UUID,
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Add a single document to a knowledge base."""
    stmt = (
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id)
        .options(selectinload(KnowledgeBase.documents))
    )
    result = await db.execute(stmt)
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    doc_stmt = select(Document).where(Document.id == document_id)
    doc_result = await db.execute(doc_stmt)
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if doc not in kb.documents:
        kb.documents.append(doc)
        await db.flush()

    await db.refresh(kb)
    stmt = (
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id)
        .options(selectinload(KnowledgeBase.documents))
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.delete("/{kb_id}/documents/{document_id}", response_model=KnowledgeBaseResponse)
async def remove_document_from_knowledge_base(
    kb_id: uuid.UUID,
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Remove a single document from a knowledge base."""
    stmt = (
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id)
        .options(selectinload(KnowledgeBase.documents))
    )
    result = await db.execute(stmt)
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    kb.documents = [d for d in kb.documents if d.id != document_id]
    await db.flush()

    stmt = (
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id)
        .options(selectinload(KnowledgeBase.documents))
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base(
    kb_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a knowledge base (does not delete the documents themselves)."""
    stmt = select(KnowledgeBase).where(KnowledgeBase.id == kb_id)
    result = await db.execute(stmt)
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    await db.delete(kb)
