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
    # Theme fields
    theme_bg: str | None = None
    theme_surface: str | None = None
    theme_surface_2: str | None = None
    theme_border: str | None = None
    theme_primary: str | None = None
    theme_primary_hover: str | None = None
    theme_success: str | None = None
    theme_warning: str | None = None
    theme_danger: str | None = None
    theme_text: str | None = None
    theme_text_muted: str | None = None
    theme_font: str | None = None


class SettingsResponse(BaseModel):
    llm_base_url: str
    llm_api_key: str
    llm_model: str
    embedding_base_url: str
    embedding_api_key: str
    embedding_model: str
    embedding_dimensions: int
    # Theme fields
    theme_bg: str
    theme_surface: str
    theme_surface_2: str
    theme_border: str
    theme_primary: str
    theme_primary_hover: str
    theme_success: str
    theme_warning: str
    theme_danger: str
    theme_text: str
    theme_text_muted: str
    theme_font: str


class TestConnectionRequest(BaseModel):
    type: str  # "llm" or "embedding"
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None


class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    model: str | None = None