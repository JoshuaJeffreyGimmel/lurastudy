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
echo                .
echo             .###*
echo           .###*   .#.
echo         .###*   .###*
echo       .###*   .###*   .#.       l#                                                             .=:
echo     .###*   .###*  .#####.      ll                                  s####S  =#=                -#+
echo   .###*   .###*  .###* *###.    ll       ##  ##  :##+r##r  +####.  :#*    T######t ##  ##  d#####+ =#+  :#.
echo *###:   *###:  .###*    :###*   ll       #U  #U   :R*  :#: .aaa#A   SS##.   t#t    #U  #U  D:  -D+  ##..#y
echo   *###.   *######*    .###*     ll       #U  #U   :R*      :A  #A      *#:  t#:    #U  #U  d#. -D+  =#-Y#.
echo     *###.   *##*    .###*       +######L u+++++= .+rr+-    A+++:#+ s####S   *+++t  u+++++= *+++-:-   -#Y:
echo       *###.       .###*                                                                            -##Y:
echo         *###.   .###*                                                                              *yy
echo           *#######*
echo             *###*
echo               *
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

REM ─── Check for Ollama (optional) ────────────────────────────────────────────
echo.
echo  [INFO] Checking for Ollama...
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
    echo  [WARN] Ollama not detected.
    echo     To use local AI, install Ollama: https://ollama.ai/
    echo     Then run: ollama pull llama3.2 ^&^& ollama pull nomic-embed-text
    echo     Or use a cloud provider -- configure it in Settings after logging in.
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

echo   Note: If using local AI (Ollama), make sure it stays running
echo   in the background. If you close it, AI features won't work.
echo   To use a cloud provider, configure it in Settings after logging in.
echo.

pause