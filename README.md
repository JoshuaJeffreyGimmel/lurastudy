# 📚 LuraStudy

> Local-first, self-hosted AI study assistant — a privacy-focused alternative to NotebookLM for students.

Upload your study materials (PDF, TXT, Markdown) and instantly generate interactive flashcard decks powered by any OpenAI-compatible LLM (Ollama, OpenAI, vLLM, etc.).

---

## ✨ Features (MVP)

- **Document Ingestion** — Upload `.pdf`, `.txt`, `.md` files; text is extracted, chunked, and embedded automatically
- **RAG Pipeline** — pgvector cosine-similarity search retrieves the most relevant context before generation
- **AI Flashcard Generation** — Structured JSON prompts force the LLM to produce clean `front`/`back` card pairs
- **Interactive Study UI** — CSS 3D flip-card animation, "Got It ✓" / "Review Later ↩" tracking, session completion screen
- **Deck Persistence** — All decks and card states are saved to PostgreSQL
- **Local-first** — Works entirely with Ollama; no data leaves your machine

---

## 🚀 Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Compose v2)
- [Ollama](https://ollama.ai/) running locally (or any OpenAI-compatible endpoint)

### 1. Pull required Ollama models
```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env if you want to use OpenAI or a different model
```

### 3. Start the stack
```bash
docker compose up --build
```

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:5173        |
| Backend   | http://localhost:8000        |
| API Docs  | http://localhost:8000/docs   |

---

## ⚙️ Configuration

All configuration is done via the `.env` file (copy from `.env.example`):

| Variable              | Default                                    | Description                        |
|-----------------------|--------------------------------------------|------------------------------------|
| `LLM_BASE_URL`        | `http://host.docker.internal:11434/v1`     | OpenAI-compatible LLM endpoint     |
| `LLM_API_KEY`         | `ollama`                                   | API key (use `ollama` for Ollama)  |
| `LLM_MODEL`           | `llama3.2`                                 | Model name for generation          |
| `EMBEDDING_BASE_URL`  | `http://host.docker.internal:11434/v1`     | Embedding endpoint                 |
| `EMBEDDING_MODEL`     | `nomic-embed-text`                         | Embedding model name               |
| `EMBEDDING_DIMENSIONS`| `768`                                      | Vector dimensions (768 for nomic)  |

### Using OpenAI instead of Ollama
```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-key-here
LLM_MODEL=gpt-4o-mini

EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=sk-your-key-here
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

---

## 🏗️ Architecture

```
lurastudy-dev/
├── docker-compose.yml          # Orchestrates all services
├── .env.example                # Environment template
│
├── backend/                    # FastAPI (Python 3.11)
│   ├── app/
│   │   ├── main.py             # App entry point, CORS, startup
│   │   ├── config.py           # Pydantic settings
│   │   ├── database.py         # SQLAlchemy async engine
│   │   ├── models/             # ORM models (Document, Chunk, Deck, Flashcard)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── routers/            # API endpoints (/documents, /study)
│   │   └── services/
│   │       ├── ingestion.py    # Text extraction + chunking
│   │       ├── embeddings.py   # OpenAI-compatible embedding client
│   │       ├── rag.py          # pgvector semantic search
│   │       └── llm.py          # LLM connector + JSON parsing
│   └── requirements.txt
│
├── frontend/                   # React + Vite
│   └── src/
│       ├── api/client.js       # Fetch wrapper for all API calls
│       ├── components/
│       │   ├── FlashCard.jsx   # 3D CSS flip card component
│       │   └── UploadZone.jsx  # Drag-and-drop file upload
│       └── pages/
│           ├── Dashboard.jsx   # Document list + upload
│           └── StudyPage.jsx   # Flashcard study session
│
└── postgres/
    └── init.sql                # CREATE EXTENSION IF NOT EXISTS vector
```

---

## 📡 API Reference

Full interactive docs available at **http://localhost:8000/docs**

| Method | Endpoint                          | Description                        |
|--------|-----------------------------------|------------------------------------|
| POST   | `/api/v1/documents/upload`        | Upload a document                  |
| GET    | `/api/v1/documents`               | List all documents                 |
| DELETE | `/api/v1/documents/{id}`          | Delete a document                  |
| POST   | `/api/v1/study/generate/flashcards` | Generate a flashcard deck        |
| GET    | `/api/v1/study/decks`             | List all decks                     |
| GET    | `/api/v1/study/decks/{id}`        | Get a deck with all cards          |
| PATCH  | `/api/v1/study/flashcards/{id}`   | Update card state (got_it)         |
| DELETE | `/api/v1/study/decks/{id}`        | Delete a deck                      |

---

## 🛠️ Development

### Backend only (without Docker)
```bash
cd backend
pip install -r requirements.txt
# Set DATABASE_URL to a local postgres instance
uvicorn app.main:app --reload
```

### Frontend only (without Docker)
```bash
cd frontend
npm install
npm run dev
```

---

## 📋 Tech Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Frontend  | React 18 + Vite 5 + React Router 6     |
| Backend   | FastAPI + Python 3.11 + SQLAlchemy 2   |
| Database  | PostgreSQL 16 + pgvector                |
| LLM       | OpenAI SDK (any compatible endpoint)   |
| Container | Docker + Docker Compose                 |

---

*Built for the July 2026 school project deadline. Local-first, privacy-respecting, open-source.*
