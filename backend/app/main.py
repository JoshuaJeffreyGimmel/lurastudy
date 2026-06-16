"""
LuraStudy FastAPI application entry point.
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import documents, knowledge_bases, settings, study

# Import models so SQLAlchemy registers them before create_all
import app.models  # noqa: F401

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LuraStudy API",
    description="Local-first AI study assistant — document ingestion, RAG, and flashcard generation.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow the Vite dev server and any configured frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(documents.router, prefix="/api/v1")
app.include_router(study.router, prefix="/api/v1")
app.include_router(settings.router, prefix="/api/v1")
app.include_router(knowledge_bases.router, prefix="/api/v1")


@app.on_event("startup")
async def on_startup():
    """Create all database tables on startup (idempotent)."""
    logger.info("Running database migrations / table creation...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database ready.")


@app.get("/health", tags=["health"])
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "service": "lurastudy-backend"}
