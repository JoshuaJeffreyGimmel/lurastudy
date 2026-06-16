import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: uuid.UUID
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


class ChunkResponse(BaseModel):
    id: uuid.UUID
    chunk_index: int
    content: str

    model_config = {"from_attributes": True}


class DocumentChunksResponse(BaseModel):
    document_id: uuid.UUID
    original_filename: str
    total_chunks: int
    chunks: list[ChunkResponse]
