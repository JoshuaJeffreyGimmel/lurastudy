"""
Document management router.
Handles file uploads, text extraction, chunking, and embedding generation.
"""
import logging
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.document import Chunk, Document
from app.schemas.document import DocumentListResponse, DocumentResponse
from app.services.config_store import (
    EMBEDDING_API_KEY,
    EMBEDDING_BASE_URL,
    EMBEDDING_MODEL,
    get_all_settings,
)
from app.services.embeddings import embed_texts
from app.services.ingestion import chunk_text, extract_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {"pdf", "txt", "md"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
}


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a document (.pdf, .txt, .md).
    Extracts text, chunks it, generates embeddings, and stores everything in the DB.
    """
    # Validate file extension
    original_filename = file.filename or "unknown"
    ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '.{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read file bytes
    file_bytes = await file.read()
    file_size = len(file_bytes)

    # Check file size
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if file_size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {settings.max_file_size_mb} MB.",
        )

    # Save file to disk
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = f"{uuid.uuid4()}.{ext}"
    file_path = upload_dir / stored_filename

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # Create document record (status=processing)
    document = Document(
        filename=stored_filename,
        original_filename=original_filename,
        file_type=ext,
        file_size=file_size,
        status="processing",
    )
    db.add(document)
    await db.flush()  # Get the ID without committing

    try:
        # Extract text
        logger.info("Extracting text from '%s' (type=%s)", original_filename, ext)
        text = extract_text(file_bytes, ext)

        if not text.strip():
            raise ValueError("No text could be extracted from the file.")

        # Chunk text
        chunks = chunk_text(text)
        logger.info("Created %d chunks from '%s'", len(chunks), original_filename)

        if not chunks:
            raise ValueError("Document produced no usable text chunks.")

        # Load embedding config from DB (falls back to .env defaults)
        cfg = await get_all_settings(db)
        emb_base_url = cfg[EMBEDDING_BASE_URL]
        emb_api_key = cfg[EMBEDDING_API_KEY]
        emb_model = cfg[EMBEDDING_MODEL]

        # Generate embeddings
        logger.info(
            "Generating embeddings for %d chunks (model=%s)...", len(chunks), emb_model
        )
        embeddings = await embed_texts(
            chunks,
            embedding_base_url=emb_base_url,
            embedding_api_key=emb_api_key,
            embedding_model=emb_model,
        )

        # Store chunks with embeddings
        for idx, (content, embedding) in enumerate(zip(chunks, embeddings)):
            chunk = Chunk(
                document_id=document.id,
                chunk_index=idx,
                content=content,
                embedding=embedding,
            )
            db.add(chunk)

        document.status = "ready"
        logger.info("Document '%s' ingested successfully.", original_filename)

    except Exception as e:
        logger.error("Failed to process document '%s': %s", original_filename, e)
        document.status = "error"
        # Still commit so the document record exists with error status
        await db.flush()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document processing failed: {str(e)}",
        )

    return document


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    db: AsyncSession = Depends(get_db),
):
    """Return all uploaded documents."""
    stmt = select(Document).order_by(Document.created_at.desc())
    result = await db.execute(stmt)
    documents = result.scalars().all()
    return DocumentListResponse(documents=list(documents), total=len(documents))


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return a single document by ID."""
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a document and all its associated data."""
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Remove stored file
    file_path = Path(settings.upload_dir) / document.filename
    if file_path.exists():
        os.remove(file_path)

    await db.delete(document)
