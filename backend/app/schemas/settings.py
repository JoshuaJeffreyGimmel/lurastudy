"""
Pydantic schemas for the settings API.
"""
from pydantic import BaseModel


class LLMSettingsUpdate(BaseModel):
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None


class EmbeddingSettingsUpdate(BaseModel):
    embedding_base_url: str | None = None
    embedding_api_key: str | None = None
    embedding_model: str | None = None
    embedding_dimensions: int | None = None


class SettingsUpdate(BaseModel):
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
    embedding_base_url: str | None = None
    embedding_api_key: str | None = None
    embedding_model: str | None = None
    embedding_dimensions: int | None = None


class SettingsResponse(BaseModel):
    llm_base_url: str
    llm_api_key: str
    llm_model: str
    embedding_base_url: str
    embedding_api_key: str
    embedding_model: str
    embedding_dimensions: int


class TestConnectionRequest(BaseModel):
    type: str  # "llm" or "embedding"
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None


class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    model: str | None = None
