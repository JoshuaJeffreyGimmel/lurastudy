from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://lurastudy:lurastudy@db:5432/lurastudy"

    # LLM
    llm_base_url: str = "http://host.docker.internal:11434/v1"
    llm_api_key: str = "ollama"
    llm_model: str = "llama3.2"

    # Embeddings
    embedding_base_url: str = "http://host.docker.internal:11434/v1"
    embedding_api_key: str = "ollama"
    embedding_model: str = "nomic-embed-text"
    embedding_dimensions: int = 768

    # File uploads
    upload_dir: str = "/app/uploads"
    max_file_size_mb: int = 50


settings = Settings()
