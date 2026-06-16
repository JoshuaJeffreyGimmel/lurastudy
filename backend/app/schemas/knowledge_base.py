import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.document import DocumentResponse


class KnowledgeBaseCreate(BaseModel):
    name: str
    document_ids: list[uuid.UUID] = []


class KnowledgeBaseUpdate(BaseModel):
    name: str | None = None
    document_ids: list[uuid.UUID] | None = None


class KnowledgeBaseResponse(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime
    documents: list[DocumentResponse] = []

    model_config = {"from_attributes": True}


class KnowledgeBaseSummaryResponse(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime
    document_count: int

    model_config = {"from_attributes": True}


class KnowledgeBaseListResponse(BaseModel):
    knowledge_bases: list[KnowledgeBaseSummaryResponse]
    total: int
