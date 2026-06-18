<#
.SYNOPSIS
    LuraStudy — One-Command Installer (Windows)
.DESCRIPTION
    Downloads and starts LuraStudy with a single command.
    Run from PowerShell (as Administrator recommended):
        iwr -useb https://raw.githubusercontent.com/JoshuaJeffreyGimmel/lurastudy/main/install.ps1 | iex
#>

# ─── Config ──────────────────────────────────────────────────────────────────
$RepoOwner = "JoshuaJeffreyGimmel"
$RepoName = "lurastudy"
$RepoBranch = "main"
$RepoBase = "https://raw.githubusercontent.com/${RepoOwner}/${RepoName}/${RepoBranch}"
$ComposeFile = "docker-compose.yml"
$EnvExampleFile = ".env.example"
$InstallDir = Join-Path $env:USERPROFILE "lurastudy"

# ─── Colors ──────────────────────────────────────────────────────────────────
$Cyan = [System.ConsoleColor]::Cyan
$Green = [System.ConsoleColor]::Green
$Yellow = [System.ConsoleColor]::Yellow
$Red = [System.ConsoleColor]::Red
$White = [System.ConsoleColor]::White
$Magenta = [System.ConsoleColor]::Magenta
$DarkGray = [System.ConsoleColor]::DarkGray

# ─── Helper functions ────────────────────────────────────────────────────────
function Write-Info  { Write-Host "  -> $($args[0])" -ForegroundColor $Cyan }
function Write-OK   { Write-Host "  OK $($args[0])" -ForegroundColor $Green }
function Write-Warn { Write-Host "  !! $($args[0])" -ForegroundColor $Yellow }
function Write-Err  { Write-Host "  XX $($args[0])" -ForegroundColor $Red }

function Invoke-Native {
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
    Write-Host "  ___  _   _ ____   ____  _   _ _____    __  __" -ForegroundColor $Magenta
    Write-Host " / _ \| | | |  _ \ / ___|| | | |_   _|  |  \/  |" -ForegroundColor $Magenta
    Write-Host "| | | | | | | |_) |\___ \| | | | | |    | |\/| |" -ForegroundColor $Magenta
    Write-Host "| |_| | |_| |  _ <  ___) | |_| | | |    | |  | |" -ForegroundColor $Magenta
    Write-Host " \___/ \___/|_| \_\|____/ \___/  |_|    |_|  |_|" -ForegroundColor $Magenta
    Write-Host ""
    Write-Host "  Local-first AI study assistant" -ForegroundColor $White
    Write-Host "  One-command installer - v0.1.0" -ForegroundColor $DarkGray
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

    # Create permanent installation directory
    Write-Info "Setting up LuraStudy in: $InstallDir"
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Push-Location $InstallDir

    # ── Step 1: Check Docker ───────────────────────────────────────────────
    Write-Info "Checking prerequisites..."
    if (-not (Test-Command docker)) {
        Write-Err "Docker is not installed."
        Write-Host "     Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
        Pop-Location
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
            exit 1
        }

        if (-not $dockerRunning) {
            Write-Err "Docker Desktop did not start within 2 minutes."
            Write-Host "     Please start Docker Desktop manually and run the installer again."
            Pop-Location
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
    New-Item -ItemType Directory -Path "postgres" -Force | Out-Null
    Download-File "${RepoBase}/postgres/init.sql" "postgres/init.sql"
    Write-OK "Configuration files downloaded."

    # ── Step 3: Create .env ─────────────────────────────────────────────────
    Copy-Item $EnvExampleFile ".env"
    Write-OK "Created .env from template."

    # ── Step 4: Check for Ollama (optional) ────────────────────────────────
    Write-Host ""
    Write-Info "Checking for Ollama..."
    if (Test-Command ollama) {
        Write-OK "Ollama is installed."
        Write-Info "Checking AI models (this may take a minute)..."

        $models = Invoke-Native { ollama list }
        if ($global:LASTEXITCODE -eq 0 -and "$models" -match "llama3.2") {
            Write-OK "llama3.2 already downloaded."
        } else {
            Write-Info "Downloading llama3.2 (~2 GB)..."
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
        Write-Host "     To use local AI, install Ollama: https://ollama.ai/"
        Write-Host "     Then run: ollama pull llama3.2 and ollama pull nomic-embed-text"
        Write-Host "     Or use a cloud provider - configure it in Settings after logging in."
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
    $pullResult = Invoke-Native { docker compose pull }
    if ($global:LASTEXITCODE -ne 0) {
        Write-Warn "Pull failed, but continuing anyway (images may already be cached)..."
    } else {
        Write-OK "Docker images pulled."
    }

    # ── Step 7: Start Docker Compose ───────────────────────────────────────
    Write-Host ""
    Write-Info "Starting LuraStudy..."
    $upResult = Invoke-Native { docker compose up -d }
    if ($global:LASTEXITCODE -ne 0) {
        Write-Warn "docker compose up -d failed. Trying with local build..."
        $upResult = Invoke-Native { docker compose up --build -d }
        if ($global:LASTEXITCODE -ne 0) {
            Write-Err "Failed to start LuraStudy."
            Write-Host "  Last error output: $($upResult -join ' ')"
            Pop-Location
            exit 1
        }
    }

    # ── Step 8: Success ────────────────────────────────────────────────────
    Write-Host ""
    Write-Host "============================================" -ForegroundColor $Green
    Write-Host "  LuraStudy is running!" -ForegroundColor $Green
    Write-Host "============================================" -ForegroundColor $Green
    Write-Host ""
    Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor $White
    Write-Host "  Backend:   http://localhost:8000" -ForegroundColor $White
    Write-Host "  API Docs:  http://localhost:8000/docs" -ForegroundColor $White
    Write-Host ""
    Write-Host "  First time? Go to http://localhost:5173/register" -ForegroundColor $Yellow
    Write-Host "    to create your admin account."
    Write-Host "  Then configure your AI provider in Settings -> LLM / Embedding."
    Write-Host ""
    Write-Host "  Config files saved to: $InstallDir" -ForegroundColor $Cyan
    Write-Host ""
    Write-Host "  To restart later, open PowerShell and run:" -ForegroundColor $Cyan
    Write-Host "    cd $InstallDir ; docker compose up -d" -ForegroundColor $White
    Write-Host ""
    Write-Host "  To update to the latest version:" -ForegroundColor $Cyan
    Write-Host "    cd $InstallDir ; docker compose pull ; docker compose up -d" -ForegroundColor $White
    Write-Host ""

    # Open browser to register page
    try {
        Start-Process "http://localhost:5173/register"
    } catch {}

    Pop-Location

    Write-Host "Press any key to close this window..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
catch {
    Write-Err "Installation failed: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Press any key to close this window..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    Pop-Location
    exit 1
}