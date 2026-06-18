<#
.SYNOPSIS
    LuraStudy — One-Command Installer (Windows)
.DESCRIPTION
    Downloads and starts LuraStudy with a single command.
    Run from PowerShell (as Administrator recommended):
        iwr -useb https://raw.githubusercontent.com/JoshuaJeffreyGimmel/lurastudy/main/install.ps1 | iex
.PARAMETER Defaults
    Use local AI (Ollama) defaults without asking.
.EXAMPLE
    iwr -useb https://raw.githubusercontent.com/JoshuaJeffreyGimmel/lurastudy/main/install.ps1 | iex
.EXAMPLE
    iwr -useb https://raw.githubusercontent.com/JoshuaJeffreyGimmel/lurastudy/main/install.ps1 | iex -args "--defaults"
#>

param(
    [switch]$Defaults = $false
)

# ─── Config ──────────────────────────────────────────────────────────────────
$RepoOwner = "JoshuaJeffreyGimmel"
$RepoName = "lurastudy"
$RepoBranch = "main"
$RepoBase = "https://raw.githubusercontent.com/${RepoOwner}/${RepoName}/${RepoBranch}"
$ComposeFile = "docker-compose.yml"
$EnvExampleFile = ".env.example"

# ─── Helper functions ────────────────────────────────────────────────────────
function Write-Info  { Write-Host "  -> $($args[0])" -ForegroundColor Cyan }
function Write-OK   { Write-Host "  OK $($args[0])" -ForegroundColor Green }
function Write-Warn { Write-Host "  !! $($args[0])" -ForegroundColor Yellow }
function Write-Err  { Write-Host "  XX $($args[0])" -ForegroundColor Red }

function Invoke-Native {
    # Run a native command safely, capturing output but NOT letting stderr
    # trigger PowerShell's error handling.
    param([ScriptBlock]$ScriptBlock)
    $global:LASTEXITCODE = 0
    $output = & $ScriptBlock 2>&1
    $result = @()
    foreach ($line in $output) {
        if ($line -is [System.Management.Automation.ErrorRecord]) {
            $result += "$line"
        } else {
            $result += $line
        }
    }
    $result
}

function Show-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  _     _               _   _     _           " -ForegroundColor Cyan
    Write-Host " | |   | |             | | | |   (_)          " -ForegroundColor Cyan
    Write-Host " | |   | | _ __ ___  __| | | |    _ _ __  ___ " -ForegroundColor Cyan
    Write-Host " | |   | || '__/ _ \/ _\` | | |   | | '_ \/ __|" -ForegroundColor Cyan
    Write-Host " | |___| || | |  __/ (_| | | |___| | | | \__ \" -ForegroundColor Cyan
    Write-Host "  \_____(_)_|  \___|\__,_| |_____|_|_| |_|___/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Local-first AI study assistant" -ForegroundColor White
    Write-Host "One-command installer - v0.1.0" -ForegroundColor Yellow
    Write-Host ""
}

function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true }
    catch { return $false }
}

function Download-File($url, $output) {
    Write-Info "Downloading $output..."
    Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
}

# ─── Main ────────────────────────────────────────────────────────────────────
try {
    Show-Banner

    # Create temp directory
    $TmpDir = Join-Path $env:TEMP "lurastudy-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null
    Push-Location $TmpDir

    # ── Step 1: Check Docker ───────────────────────────────────────────────
    Write-Info "Checking prerequisites..."
    if (-not (Test-Command docker)) {
        Write-Err "Docker is not installed."
        Write-Host "     Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
        Pop-Location
        Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
        exit 1
    }
    Write-OK "Docker is installed."

    # Check Docker is running
    $dockerRunning = $false
    $dockerInfo = Invoke-Native { docker info }
    if ($global:LASTEXITCODE -eq 0) { $dockerRunning = $true }

    if (-not $dockerRunning) {
        Write-Warn "Docker is installed but not running."
        Write-Info "Attempting to start Docker Desktop automatically..."
        
        # Try common Docker Desktop locations
        $dockerPaths = @(
            "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
            "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
            "$env:LOCALAPPDATA\Docker\Docker Desktop.exe",
            "$env:ProgramData\Docker\Docker Desktop.exe"
        )
        
        $dockerExe = $null
        foreach ($path in $dockerPaths) {
            if (Test-Path $path) { $dockerExe = $path; break }
        }

        if ($dockerExe) {
            Write-Info "Found Docker Desktop at: $dockerExe"
            Start-Process -FilePath $dockerExe
            Write-Info "Waiting for Docker Desktop to start (this can take up to 2 minutes)..."
            
            $maxAttempts = 24
            for ($i = 1; $i -le $maxAttempts; $i++) {
                Start-Sleep -Seconds 5
                $dockerInfo = Invoke-Native { docker info }
                if ($global:LASTEXITCODE -eq 0) {
                    Write-OK "Docker Desktop is now running."
                    $dockerRunning = $true
                    break
                }
            }
        } else {
            Write-Err "Could not find Docker Desktop executable."
            Write-Host "     Please start Docker Desktop manually and run the installer again."
            Pop-Location
            Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
            exit 1
        }

        if (-not $dockerRunning) {
            Write-Err "Docker Desktop did not start within 2 minutes."
            Write-Host "     Please start Docker Desktop manually and run the installer again."
            Pop-Location
            Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
            exit 1
        }
    } else {
        Write-OK "Docker Desktop is running."
    }

    # ── Step 2: Download required files ────────────────────────────────────
    Write-Host ""
    Write-Info "Downloading configuration files..."
    Download-File "${RepoBase}/${ComposeFile}" $ComposeFile
    Download-File "${RepoBase}/${EnvExampleFile}" $EnvExampleFile
    # Also download the init.sql for PostgreSQL (referenced by compose file)
    New-Item -ItemType Directory -Path "postgres" -Force | Out-Null
    Download-File "${RepoBase}/postgres/init.sql" "postgres/init.sql"
    Write-OK "Configuration files downloaded."

    # ── Step 3: Create .env ─────────────────────────────────────────────────
    Copy-Item $EnvExampleFile ".env"
    Write-OK "Created .env from template."

    # ── Step 4: Configure AI (local vs cloud) ──────────────────────────────
    Write-Host ""
    $useCloud = $false

    if ($Defaults) {
        Write-Info "Non-interactive mode: using local AI (Ollama)."
        $useCloud = $false
    } else {
        Write-Info "How do you want to run the AI?"
        Write-Host "   1) Local - use Ollama (free, private, runs on your machine) [default]"
        Write-Host "   2) Cloud - use OpenAI (no installation, ~`$2/month in API costs)"
        Write-Host ""
        $aiChoice = Read-Host "  Choose [1/2]"

        if ($aiChoice -eq "2" -or $aiChoice -eq "cloud" -or $aiChoice -eq "openai") {
            $useCloud = $true
        }
    }

    if ($useCloud) {
        Write-Host ""
        Write-Info "Cloud AI selected."
        Write-Host "  You'll need an OpenAI API key (https://platform.openai.com/api-keys)."
        Write-Host ""
        $apiKey = Read-Host "  Enter your OpenAI API key (sk-...)"

        if (-not [string]::IsNullOrWhiteSpace($apiKey)) {
            # Update .env with cloud settings
            $envContent = Get-Content ".env" -Raw
            
            $replaces = @{
                "LLM_BASE_URL=.*" = "LLM_BASE_URL=https://api.openai.com/v1"
                "LLM_API_KEY=.*" = "LLM_API_KEY=$apiKey"
                "LLM_MODEL=.*" = "LLM_MODEL=gpt-4o-mini"
                "EMBEDDING_BASE_URL=.*" = "EMBEDDING_BASE_URL=https://api.openai.com/v1"
                "EMBEDDING_API_KEY=.*" = "EMBEDDING_API_KEY=$apiKey"
                "EMBEDDING_MODEL=.*" = "EMBEDDING_MODEL=text-embedding-3-small"
                "EMBEDDING_DIMENSIONS=.*" = "EMBEDDING_DIMENSIONS=1536"
            }

            foreach ($pattern in $replaces.Keys) {
                $envContent = $envContent -replace $pattern, $replaces[$pattern]
            }
            Set-Content ".env" -Value $envContent
            Write-OK "OpenAI API key saved."
        } else {
            Write-Warn "No API key provided. You can configure it later in Settings."
        }

    } else {
        # Local AI — check Ollama
        Write-Host ""
        Write-Info "Local AI selected. Checking for Ollama..."
        if (Test-Command ollama) {
            Write-OK "Ollama is installed."

            Write-Host ""
            Write-Info "Checking AI models (this may take a minute)..."
            
            $models = Invoke-Native { ollama list }
            if ($global:LASTEXITCODE -eq 0 -and "$models" -match "llama3.2") {
                Write-OK "llama3.2 already downloaded."
            } else {
                Write-Info "Downloading llama3.2 (~2 GB)..."
                Write-Host "  This may take a while depending on your internet speed."
                Invoke-Native { ollama pull llama3.2 } | Out-Null
                Write-OK "llama3.2 ready."
            }

            if ($global:LASTEXITCODE -eq 0 -and "$models" -match "nomic-embed-text") {
                Write-OK "nomic-embed-text already downloaded."
            } else {
                Write-Info "Downloading nomic-embed-text (~274 MB)..."
                Invoke-Native { ollama pull nomic-embed-text } | Out-Null
                Write-OK "nomic-embed-text ready."
            }
        } else {
            Write-Warn "Ollama not detected."
            Write-Host "     You'll need to install Ollama and pull the models manually:"
            Write-Host "       1. Install: https://ollama.ai/"
            Write-Host "       2. Run: ollama pull llama3.2 && ollama pull nomic-embed-text"
            Write-Host ""
            Write-Host "     The app will still start, but AI features won't work until Ollama is set up."
        }

    }

    # ── Step 5: Clean up any previous LuraStudy containers ────────────────
    Write-Host ""
    Write-Info "Cleaning up old containers..."
    foreach ($name in @("lurastudy_db", "lurastudy_backend", "lurastudy_frontend")) {
        Invoke-Native { docker rm -f $name 2>$null } | Out-Null
    }

    # ── Step 6: Pull Docker images ─────────────────────────────────────────
    Write-Host ""
    Write-Info "Pulling Docker images..."
    if ($useCloud) {
        $pullResult = Invoke-Native { docker compose -f docker-compose.yml -f docker-compose.cloud.yml pull }
    } else {
        $pullResult = Invoke-Native { docker compose pull }
    }
    if ($global:LASTEXITCODE -ne 0) {
        Write-Warn "Pull failed, but continuing anyway (images may already be cached)..."
    } else {
        Write-OK "Docker images pulled."
    }

    # ── Step 7: Start Docker Compose ───────────────────────────────────────
    Write-Host ""
    Write-Info "Starting LuraStudy..."
    if ($useCloud) {
        $upResult = Invoke-Native { docker compose -f docker-compose.yml -f docker-compose.cloud.yml up -d }
    } else {
        $upResult = Invoke-Native { docker compose up -d }
    }
    if ($global:LASTEXITCODE -ne 0) {
        Write-Warn "'docker compose up -d' failed."
        Write-Info "Trying with local build instead..."
        if ($useCloud) {
            $upResult = Invoke-Native { docker compose -f docker-compose.yml -f docker-compose.cloud.yml up --build -d }
        } else {
            $upResult = Invoke-Native { docker compose up --build -d }
        }
        if ($global:LASTEXITCODE -ne 0) {
            Write-Err "Failed to start LuraStudy."
            Write-Host "  Last error output: $($upResult -join ' ')"
            Pop-Location
            Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
            exit 1
        }
    }

    # ── Step 8: Success ────────────────────────────────────────────────────
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  LuraStudy is running!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor White
    Write-Host "  Backend:   http://localhost:8000" -ForegroundColor White
    Write-Host "  API Docs:  http://localhost:8000/docs" -ForegroundColor White
    Write-Host ""
    Write-Host "  First time? Go to http://localhost:5173/register" -ForegroundColor Yellow
    Write-Host "    to create your admin account."
    Write-Host ""

    # Open browser
    try {
        Start-Process "http://localhost:5173"
    } catch {}

    # Cleanup
    Pop-Location
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue

    # Keep window open
    Write-Host "Press any key to close this window..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
catch {
    Write-Err "Installation failed: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Press any key to close this window..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    Pop-Location
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
    exit 1
}