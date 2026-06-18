@echo off
REM
REM LuraStudy -- One-Click Setup (Windows)
REM =======================================
REM This script installs and starts LuraStudy with minimal user effort.
REM
REM Usage:
REM   Double-click setup.bat, or run from Command Prompt:
REM     setup.bat
REM

setlocal enabledelayedexpansion

title LuraStudy Setup

REM ─── Banner ─────────────────────────────────────────────────────────────────
cls
echo.
echo =============================================
echo   LuraStudy -- Local-first AI study assistant
echo   One-click setup -- v0.1.0
echo =============================================
echo.

REM ─── Early pause safeguard ──────────────────────────────────────────────────
REM If the script fails unexpectedly before reaching the normal pause
REM statements, this ensures the window stays open for a moment.
ping -n 2 127.0.0.1 > nul

REM ─── Check if already in repo ──────────────────────────────────────────────
if exist docker-compose.yml (
    echo  [INFO] Already in the LuraStudy repository.
) else (
    echo  [INFO] Cloning LuraStudy repository...
    where git >nul 2>nul
    if %ERRORLEVEL% neq 0 (
        echo  [ERROR] Git is not installed.
        echo     Install Git: https://git-scm.com/
        echo.
        pause
        exit /b 1
    )
    git clone --depth 1 https://github.com/JoshuaJeffreyGimmel/lurastudy.git 2>nul
    if not exist lurastudy (
        echo  [ERROR] Failed to clone repository.
        echo  Make sure you have internet access and try again.
        echo.
        pause
        exit /b 1
    )
    cd lurastudy
    echo  [OK] Repository ready.
)

REM ─── Check Docker ──────────────────────────────────────────────────────────
echo.
echo  [INFO] Checking prerequisites...
where docker >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] Docker is not installed.
    echo     Install Docker Desktop: https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)
echo  [OK] Docker is installed.

REM ─── Check Docker is running, auto-start if not ───────────────────────────
docker info >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  [INFO] Docker is installed but not running.
    echo  [INFO] Attempting to start Docker Desktop automatically...
    echo.
    goto :start_docker
)
echo  [OK] Docker Desktop is running.
goto :docker_ready

:start_docker
REM Try common Docker Desktop install locations
set DOCKER_EXE=
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" set DOCKER_EXE=C:\Program Files\Docker\Docker\Docker Desktop.exe
if exist "C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe" set DOCKER_EXE=C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe
if exist "%LOCALAPPDATA%\Docker\Docker Desktop.exe" set DOCKER_EXE=%LOCALAPPDATA%\Docker\Docker Desktop.exe
if exist "%PROGRAMDATA%\Docker\Docker Desktop.exe" set DOCKER_EXE=%PROGRAMDATA%\Docker\Docker Desktop.exe

if not defined DOCKER_EXE (
    echo  [ERROR] Could not find Docker Desktop executable.
    echo     Please start Docker Desktop manually and run setup.bat again.
    echo.
    pause
    exit /b 1
)

echo  [INFO] Found Docker Desktop at: !DOCKER_EXE!
start "" "!DOCKER_EXE!"
echo  [INFO] Waiting for Docker Desktop to start (this can take up to 2 minutes)...
echo.

REM Poll every 5 seconds up to 24 times (2 minutes max)
for /l %%i in (1,1,24) do (
    timeout /t 5 /nobreak >nul
    docker info >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        echo  [OK] Docker Desktop is now running.
        goto :docker_ready
    )
)

echo  [WARN] Docker Desktop did not start within 2 minutes.
echo     Please start Docker Desktop manually and run setup.bat again.
echo.
pause
exit /b 1

:docker_ready
REM End of Docker check section

REM ─── Create .env if missing ─────────────────────────────────────────────────
if not exist .env (
    copy .env.example .env >nul
    echo  [OK] Created .env from template.
) else (
    echo  [INFO] .env already exists -- keeping your settings.
)

REM ─── Ask local vs cloud ─────────────────────────────────────────────────────
echo.
echo  How do you want to run the AI?
echo    1) Local -- use Ollama (free, private, runs on your machine)
echo    2) Cloud -- use an API provider
echo.
set /p ai_choice="  Choose [1/2]: "

set USE_CLOUD=false
if "%ai_choice%"=="2" set USE_CLOUD=true
if /i "%ai_choice%"=="cloud" set USE_CLOUD=true

if "%USE_CLOUD%"=="true" (
    echo.
    echo  Select your LLM provider:
    echo    1) OpenAI       - gpt-4o-mini
    echo    2) Groq         - llama-3.3-70b (free tier available)
    echo    3) Together AI  - Llama-3.2-3B-Instruct
    echo    4) DeepSeek     - deepseek-chat
    echo    5) Mistral AI   - mistral-small-latest
    echo    6) xAI (Grok)   - grok-2
    echo    7) OpenRouter   - any model (Claude, Gemini, GPT, etc.)
    echo    8) Custom       - enter your own endpoint
    echo.
    set /p prov_choice="  Choose [1-8]: "

    if "%prov_choice%"=="1" set LLM_URL=https://api.openai.com/v1& set LLM_MODEL=gpt-4o-mini& set EMBED_MODEL=text-embedding-3-small& set EMBED_DIMS=1536
    if "%prov_choice%"=="2" set LLM_URL=https://api.groq.com/openai/v1& set LLM_MODEL=llama-3.3-70b-versatile& set EMBED_MODEL=llama-3.3-70b-versatile& set EMBED_DIMS=768
    if "%prov_choice%"=="3" set LLM_URL=https://api.together.xyz/v1& set LLM_MODEL=meta-llama/Llama-3.2-3B-Instruct-Turbo& set EMBED_MODEL=thenlper/gte-base& set EMBED_DIMS=768
    if "%prov_choice%"=="4" set LLM_URL=https://api.deepseek.com/v1& set LLM_MODEL=deepseek-chat& set EMBED_MODEL=deepseek-chat& set EMBED_DIMS=1536
    if "%prov_choice%"=="5" set LLM_URL=https://api.mistral.ai/v1& set LLM_MODEL=mistral-small-latest& set EMBED_MODEL=mistral-embed& set EMBED_DIMS=1024
    if "%prov_choice%"=="6" set LLM_URL=https://api.x.ai/v1& set LLM_MODEL=grok-2& set EMBED_MODEL=grok-2& set EMBED_DIMS=1536
    if "%prov_choice%"=="7" set LLM_URL=https://openrouter.ai/api/v1& set LLM_MODEL=openai/gpt-4o-mini& set EMBED_MODEL=openai/text-embedding-3-small& set EMBED_DIMS=1536

    if "%prov_choice%"=="8" (
        echo.
        set /p LLM_URL="  Enter the LLM base URL (e.g. https://api.example.com/v1): "
        set /p LLM_MODEL="  Enter the model name (e.g. my-model): "
        set /p EMBED_MODEL="  Enter the embedding model name (e.g. my-embed-model): "
        set /p EMBED_DIMS="  Enter the embedding dimensions (e.g. 768): "
    )

    if not defined LLM_URL (
        set LLM_URL=https://api.openai.com/v1
        set LLM_MODEL=gpt-4o-mini
        set EMBED_MODEL=text-embedding-3-small
        set EMBED_DIMS=1536
    )

    echo.
    set /p api_key="  Enter your API key: "

    if not "!api_key!"=="" (
        REM Update .env with cloud settings
        findstr /b /v "LLM_BASE_URL LLM_API_KEY LLM_MODEL EMBEDDING_BASE_URL EMBEDDING_API_KEY EMBEDDING_MODEL EMBEDDING_DIMENSIONS" .env > .env.tmp
        echo LLM_BASE_URL=!LLM_URL! >> .env.tmp
        echo LLM_API_KEY=!api_key! >> .env.tmp
        echo LLM_MODEL=!LLM_MODEL! >> .env.tmp
        echo EMBEDDING_BASE_URL=!LLM_URL! >> .env.tmp
        echo EMBEDDING_API_KEY=!api_key! >> .env.tmp
        echo EMBEDDING_MODEL=!EMBED_MODEL! >> .env.tmp
        echo EMBEDDING_DIMENSIONS=!EMBED_DIMS! >> .env.tmp
        move /y .env.tmp .env >nul
        echo  [OK] API key saved.
    ) else (
        echo  [WARN] No API key provided. You can configure it later in Settings.
    )
) else (
    echo.
    echo  [INFO] Local AI selected. Checking for Ollama...
    where ollama >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        echo  [OK] Ollama is installed.

        echo.
        echo  [INFO] Checking AI models (this may take a minute)...
        echo.

        ollama list 2>nul | findstr "llama3.2" >nul
        if !ERRORLEVEL! equ 0 (
            echo  [OK] llama3.2 already downloaded.
        ) else (
            echo  [INFO] Downloading llama3.2 (~2 GB)...
            echo  This may take a while depending on your internet speed.
            ollama pull llama3.2
            echo  [OK] llama3.2 ready.
        )

        echo.
        ollama list 2>nul | findstr "nomic-embed-text" >nul
        if !ERRORLEVEL! equ 0 (
            echo  [OK] nomic-embed-text already downloaded.
        ) else (
            echo  [INFO] Downloading nomic-embed-text (~274 MB)...
            ollama pull nomic-embed-text
            echo  [OK] nomic-embed-text ready.
        )
    ) else (
        echo  [WARN] Ollama not detected. You'll need to run models separately.
        echo     Install: https://ollama.ai/
        echo     Then: ollama pull llama3.2 ^&^& ollama pull nomic-embed-text
    )
)

REM ─── Pull Docker images ──────────────────────────────────────────────────────
echo.
echo  [INFO] Pulling Docker images...
docker compose pull 2>nul
if %ERRORLEVEL% neq 0 (
    echo  [WARN] Pull failed. Make sure you have internet access.
    echo.
    pause
    exit /b 1
)
echo  [OK] Docker images pulled.

REM ─── Start Docker Compose ────────────────────────────────────────────────────
echo.
echo  [INFO] Starting LuraStudy...
docker compose up -d 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [ERROR] Failed to start LuraStudy.
    echo  Run 'docker compose logs' to see what went wrong.
    echo.
    pause
    exit /b 1
)

REM ─── Success ─────────────────────────────────────────────────────────────────
echo.
echo  ============================================
echo    LuraStudy is running!
echo  ============================================
echo.
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo.
echo   First time? Go to http://localhost:5173/register
echo   to create your admin account.
echo.
echo   Tip: Open http://localhost:5173 and follow the
echo   onboarding wizard to get started quickly.
echo.

if not "%USE_CLOUD%"=="true" (
    echo   Note: Make sure Ollama stays running in the background.
    echo   If you close it, AI features won't work.
    echo.
)

pause