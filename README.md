# 📚 LuraStudy

> **Local-first, self-hosted AI study assistant** — a privacy-focused alternative to NotebookLM for students.
>
> Upload your study materials and instantly generate flashcard decks, take AI-generated quizzes, chat with your documents, and preview exactly what the AI extracted — all powered by any OpenAI-compatible LLM (Ollama, OpenAI, vLLM, etc.).

---

## ✨ Features

- **User Authentication** — JWT-based login/registration; first registered user becomes admin automatically; invite-token system for controlled sign-ups
- **Per-User Data Isolation** — All documents, decks, knowledge bases, and settings are scoped to the authenticated user
- **Document Ingestion** — Upload `.pdf`, `.txt`, `.md`, `.docx`, `.pptx`, `.xlsx`, `.html`, `.csv`, `.xml`, `.ipynb`; text is extracted, chunked, and embedded automatically
- **Document Preview / Chunk Viewer** — Inspect every text chunk extracted from a document, with live search and highlighting, to verify what the AI actually sees
- **RAG Pipeline** — pgvector cosine-similarity search retrieves the most relevant context before generation
- **Knowledge Bases** — Group documents into named knowledge bases for focused RAG queries
- **Deck Workspace** — Create decks, attach source documents, chat with AI, and manage flashcards all in one place
- **AI Chat with History** — Ask questions about your source documents; conversations are saved and resumable per deck
- **AI Flashcard Generation** — Structured JSON prompts force the LLM to produce clean `front`/`back` card pairs
- **SM-2 Spaced Repetition** — Cards are scheduled using the SM-2 algorithm (ease factor, interval, repetitions, due date); study only cards that are due today
- **Interactive Study UI** — CSS 3D flip-card animation, Easy / Got It / Again rating, session completion screen
- **AI Quiz Generation** — Generate multiple-choice quizzes from deck source documents; save and replay quiz attempts with scoring history
- **Settings UI** — Configure LLM and embedding endpoints live from the browser; test your connection without restarting
- **Appearance Customization** — Customize every UI color with live preview; choose from preset themes (Dark/Light) or pick exact hex values; select from multiple font families or type any CSS font; save themes as templates (browser-local), export/import as JSON files
- **Admin Panel** — Manage users; generate, list, and revoke invite tokens (including used ones)
- **About Tab** — In-app README viewer renders the project documentation inside the Settings page
- **Local-first** — Works entirely with Ollama; no data leaves your machine

### Activity Types

| Type | Description | Spaced Repetition |
|---|---|---|
| 🃏 **Flashcards** | Classic front/back cards | ✅ SM-2 |
| 🧠 **Quiz** | Multiple-choice questions | ❌ |
| 📝 **Fill-in-the-Blank** | Cloze deletion sentences | ✅ SM-2 |
| 🔢 **Numerical** | Calculation problems | ✅ SM-2 |

> Activities are **pluggable** — see [`ACTIVITY_TYPE_TEMPLATE.md`](./ACTIVITY_TYPE_TEMPLATE.md) to add your own.

---

## 🚀 Quick Start (1 command)

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/JoshuaJeffreyGimmel/lurastudy/main/install.sh | sh
```

**Windows (PowerShell as Administrator):**
```powershell
iwr -useb https://raw.githubusercontent.com/JoshuaJeffreyGimmel/lurastudy/main/install.ps1 | iex
```

> That's it! The installer will check for Docker, download the configuration files, prompt
> you to choose local or cloud AI, then pull the pre-built Docker images and start everything.
> Your browser will open to **http://localhost:5173/register** when ready, where you can create
> your admin account immediately.

### Step-by-step (manual)

### Step 1: Install Prerequisites

| Required | Download | Why |
|---|---|---|
| **Docker Desktop** | [docker.com](https://www.docker.com/products/docker-desktop/) | Runs PostgreSQL + the app |
| **Ollama** (for local AI) | [ollama.ai](https://ollama.ai/) | Runs the AI model locally |

> **Using OpenAI instead?** You can skip Ollama! See [Cloud LLM Setup](#-using-openai-instead-of-ollama) below.

### Step 2: Pull AI models (Ollama only)

Open a terminal and run:
```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```
*This downloads ~2 GB. Takes 1-5 minutes depending on your internet.*

### Step 3: Start LuraStudy

```bash
# Clone the project
git clone https://github.com/JoshuaJeffreyGimmel/lurastudy.git
cd lurastudy

# Create config file
cp .env.example .env

# Start everything
docker compose up --build
```

> **Windows users:** Use `copy .env.example .env` instead of `cp`.
> The first build takes 2-5 minutes to download base images. Subsequent starts take <10 seconds.

### Step 4: Create your account

Open **http://localhost:5173/register** and register. The **first user** automatically becomes admin.

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## ⚙️ Using OpenAI Instead of Ollama

If you prefer a cloud AI (OpenAI, Anthropic, etc.) instead of running Ollama locally:

### Option A: Docker profile (recommended)

```bash
docker compose -f docker-compose.yml -f docker-compose.cloud.yml up --build
```

Then set your API key in the Settings page at **http://localhost:5173/settings**.

### Option B: Edit `.env` manually

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

## 🐛 Troubleshooting

| Problem | Likely cause | Solution |
|---|---|---|
| **"Can't reach the AI model"** | Ollama isn't running | Open Ollama or run `ollama serve` in a terminal |
| **"502 Bad Gateway"** | AI endpoint unreachable | Check Ollama is running and the URL in Settings is correct |
| **No documents appear "ready"** | Embedding model not loaded | Run `ollama pull nomic-embed-text` |
| **Docker build fails** | Out of date images | Run `docker compose pull` then try again |
| **Port already in use** | Another app on :5173 or :8000 | Change ports in `docker-compose.yml` |
| **DB connection error** | PostgreSQL not started yet | Wait 10 seconds and refresh — Docker healthcheck needs time |
| **"No ready documents"** | Document still processing | Wait a moment, then refresh the page |
| **Onboarding shows warnings** | AI not configured | Go to Settings and set up your LLM provider |

---

## 🏗️ Architecture

```
lurastudy-dev/
├── docker-compose.yml          # Main — PostgreSQL + Backend + Frontend + Ollama
├── docker-compose.cloud.yml    # Cloud profile — overrides for OpenAI users
├── .env.example                # Environment template
│
├── backend/                    # FastAPI (Python 3.11)
│   ├── app/
│   │   ├── main.py             # App entry point, CORS, startup
│   │   ├── config.py           # Pydantic settings
│   │   ├── database.py         # SQLAlchemy async engine + session
│   │   ├── dependencies.py     # JWT auth dependencies
│   │   ├── models/             # ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── routers/            # API endpoints
│   │   │   ├── auth.py         # /auth — register, login, me
│   │   │   ├── admin.py        # /admin — invite tokens, user list
│   │   │   ├── documents.py    # /documents
│   │   │   ├── study.py        # /study/decks, /study/flashcards
│   │   │   ├── knowledge_bases.py
│   │   │   ├── history.py      # /history — conversations, quizzes
│   │   │   ├── settings.py     # /settings
│   │   │   └── health.py       # /health — connectivity checks
│   │   ├── services/
│   │   │   ├── auth.py         # JWT creation/verification, bcrypt hashing
│   │   │   ├── ingestion.py    # Text extraction + chunking (MarkItDown)
│   │   │   ├── embeddings.py   # OpenAI-compatible embedding client
│   │   │   ├── rag.py          # pgvector semantic search
│   │   │   ├── llm.py          # LLM connector + JSON parsing
│   │   │   ├── sm2.py          # SM-2 spaced repetition algorithm
│   │   │   └── config_store.py # DB-backed per-user settings store
│   │   └── activities/         # Pluggable activity type system
│   │       ├── flashcard.py
│   │       ├── quiz.py
│   │       ├── cloze.py
│   │       └── calculation.py
│   └── requirements.txt
│
├── frontend/                   # React + Vite
│   └── src/
│       ├── api/client.js       # Fetch wrapper + error parsing
│       ├── components/
│       │   ├── StatusBanner.jsx         # Connectivity warning banner
│       │   ├── FlashCard.jsx            # 3D CSS flip card
│       │   ├── ProtectedRoute.jsx       # Auth guard
│       │   └── DocumentPreviewModal.jsx # Chunk viewer
│       ├── pages/
│       │   ├── OnboardingPage.jsx       # First-launch wizard
│       │   ├── LoginPage.jsx
│       │   ├── RegisterPage.jsx
│       │   ├── Dashboard.jsx
│       │   ├── DecksPage.jsx
│       │   ├── DeckWorkspacePage.jsx
│       │   ├── StudyPage.jsx
│       │   ├── QuizPage.jsx
│       │   ├── DocumentsPage.jsx
│       │   └── SettingsPage.jsx
│       └── theme.js                    # Theme engine
│
└── postgres/
    └── init.sql                # CREATE EXTENSION IF NOT EXISTS vector
```

---

## ⚙️ Configuration

All configuration is done via the `.env` file or live through the **Settings** page:

| Variable | Default | Description |
|---|---|---|
| `LLM_BASE_URL` | `http://host.docker.internal:11434/v1` | OpenAI-compatible LLM endpoint |
| `LLM_API_KEY` | `ollama` | API key (use `ollama` for Ollama) |
| `LLM_MODEL` | `llama3.2` | Model name for generation |
| `EMBEDDING_BASE_URL` | `http://host.docker.internal:11434/v1` | Embedding endpoint |
| `EMBEDDING_MODEL` | `nomic-embed-text` | Embedding model name |
| `EMBEDDING_DIMENSIONS` | `768` | Vector dimensions (768 for nomic) |
| `SECRET_KEY` | *(change this!)* | JWT signing secret |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | Token lifetime (default: 7 days) |

---

## 💻 System Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| **RAM** | 4 GB (with `llama3.2:1b`) | 8-16 GB |
| **Disk** | 5 GB free | 10+ GB |
| **OS** | Windows 10+, macOS 12+, Linux | Windows 11, macOS 14+, Ubuntu 22+ |
| **Docker** | Docker Desktop 4.x+ | Latest |
| **Ollama** | 0.3+ | Latest |

**RAM breakdown:**
- Docker stack (PostgreSQL + backend + frontend): ~500 MB idle
- Ollama (`llama3.2` + `nomic-embed-text`): ~2.5-3.5 GB
- **Total with local AI:** ~3-4 GB idle, ~5 GB under load
- **Total with cloud AI (OpenAI):** ~500 MB + Docker

> For low-RAM machines (4-8 GB): use `llama3.2:1b` instead of the 3B model, or switch to a cloud LLM.

---

## 📡 API Endpoints

| Category | Endpoints |
|---|---|
| **Auth** | `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me` |
| **Admin** | `POST/GET/DELETE /api/v1/admin/invites`, `GET /api/v1/admin/users` |
| **Documents** | `POST/GET/DELETE /api/v1/documents`, `GET /api/v1/documents/{id}/chunks` |
| **Decks** | `POST/GET/PATCH/DELETE /api/v1/study/decks`, `GET /api/v1/study/decks/{id}/due` |
| **Activities** | `GET /api/v1/study/activities`, `POST /api/v1/study/decks/{id}/activities/{type}/generate` |
| **Chat** | `POST /api/v1/study/decks/{id}/chat` |
| **Flashcards** | `PATCH /api/v1/study/flashcards/{id}/review` |
| **Knowledge Bases** | `POST/GET/PATCH/DELETE /api/v1/knowledge-bases` |
| **History** | `POST/GET/DELETE /api/v1/history/conversations`, `POST/GET/DELETE /api/v1/history/quizzes` |
| **Settings** | `GET/PATCH /api/v1/settings`, `POST /api/v1/settings/test-connection` |
| **Health** | `GET /api/v1/health`, `GET /api/v1/health/connectivity` |

Full interactive docs at **http://localhost:8000/docs**.

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

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5 + React Router 6 |
| Backend | FastAPI + Python 3.11 + SQLAlchemy 2 (async) |
| Database | PostgreSQL 16 + pgvector |
| Auth | JWT (`python-jose`) + bcrypt password hashing |
| LLM | OpenAI SDK (any compatible endpoint — Ollama, OpenAI, vLLM, etc.) |
| Container | Docker + Docker Compose |

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

---

## ⭐ Early Access

New features land on the `develop` branch first and are published as Docker images tagged `:early-access`.
Stable releases ship to the `main` branch as `:latest` approximately 2–3 months later.

If you'd like to support development and get early access to the newest features, check the project
discussions for membership details.

---

*Built for the July 2026 school project deadline. Local-first, privacy-respecting, open-source.*
