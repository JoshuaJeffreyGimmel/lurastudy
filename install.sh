#!/usr/bin/env bash
#
# LuraStudy — One-Command Installer
# ===================================
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/JoshuaJeffreyGimmel/lurastudy/main/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/JoshuaJeffreyGimmel/lurastudy/main/install.sh | sh
#
# Prerequisites:
#   1. Docker (https://docs.docker.com/engine/install/)
#   2. Ollama (https://ollama.ai/) — optional, for local AI
#
# NOTE: If piping to "sh" on Debian/Ubuntu (where /bin/sh is dash),
#       the script still works because we avoid bash-specific constructs
#       like "echo -e" and "read -p".  If you see any issues, try:
#         curl -fsSL ... | bash
#

set -e

# ─── Config ──────────────────────────────────────────────────────────────────
REPO_OWNER="JoshuaJeffreyGimmel"
REPO_NAME="lurastudy"
REPO_BRANCH="main"
REPO_BASE="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env.example"

# ─── Colors (matching LuraStudy UI: primary=#6c63ff, bg=#0f1117) ────────────
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
WHITE="\033[0;37m"
GRAY="\033[0;90m"
NC="\033[0m"

# ─── POSIX-safe helpers (avoid echo -e / read -p) ────────────────────────────
info()    { printf "  %b→%b %s\n" "${CYAN}" "${NC}" "$1"; }
success() { printf "  %b✓%b %s\n" "${GREEN}" "${NC}" "$1"; }
warn()    { printf "  %b⚠%b %s\n" "${YELLOW}" "${NC}" "$1"; }
error()   { printf "  %b✗%b %s\n" "${RED}" "${NC}" "$1"; }

print_banner() {
    cat << "EOF"

                .
             .###*
           .###*   .#.
         .###*   .###*
       .###*   .###*   .#.       l#                                                             .=:
     .###*   .###*  .#####.      ll                                  s####S  =#=                -%+
   .###*   .###*  .###* *###.    ll       ##  ##  :%%+r%%r  +%%%%.  :#*    T%#####t ##  ##  d%%%%%+ =%+  :%.
 *###:   *###:  .###*    :###*   ll       #U  #U   :R*  :#: .aaa%A   SS##.   t#t    #U  #U  D:  -D+  ##..#y
   *###.   *######*    .###*     ll       #U  #U   :R*      :A  %A      *#:  t#:    #U  #U  d%. -D+  =#-Y#.
     *###.   *##*    .###*       +######L u+++++= .+rr+-    A+++:#+ s####S   *+++t  u+++++= *+++-:-   -#Y:
       *###.       .###*                                                                            -%#Y:
         *###.   .###*                                                                              *yy
           *#######*
             *###*
               *

EOF
    printf "\n"
    printf "  %bLocal-first AI study assistant%b\n" "${WHITE}" "${NC}"
    printf "  %bOne-command installer — v0.1.0%b\n" "${GRAY}" "${NC}"
    printf "\n"
}

check_cmd() {
    if ! command -v "$1" > /dev/null 2>&1; then
        error "$1 is not installed."
        return 1
    fi
    return 0
}

download_file() {
    url="$1"
    output="$2"
    if command -v curl > /dev/null 2>&1; then
        curl -fsSL "$url" -o "$output"
    elif command -v wget > /dev/null 2>&1; then
        wget -q "$url" -O "$output"
    else
        error "Neither curl nor wget found. Install curl and try again."
        exit 1
    fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
    print_banner

    # ── Step 0: Confirmation prompt ──────────────────────────────────────
    printf "  %bThis will install LuraStudy to:%b %s/lurastudy\n" "${WHITE}" "${NC}" "$HOME"
    printf "  %bDocker must be installed.%b\n" "${GRAY}" "${NC}"
    printf "  %bOllama is optional (for local AI).%b\n" "${GRAY}" "${NC}"
    printf "\n"
    printf "  Press ENTER to start, or type 'exit' to cancel: "
    read -r confirm
    if [ "$confirm" = "exit" ] || [ "$confirm" = "no" ] || [ "$confirm" = "n" ]; then
        printf "  %bInstallation cancelled.%b\n" "${YELLOW}" "${NC}"
        exit 0
    fi
    printf "\n"

    INSTALL_DIR="$HOME/lurastudy"
    info "Setting up LuraStudy in: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"

    # ── Step 1: Check Docker ───────────────────────────────────────────────
    info "Checking prerequisites..."
    check_cmd docker || {
        error "Docker is not installed."
        echo "     Install Docker: https://docs.docker.com/engine/install/"
        exit 1
    }
    success "Docker is installed."

    if ! docker info > /dev/null 2>&1; then
        warn "Docker is installed but not running."
        echo "  Attempting to start Docker automatically..."
        case "$(uname -s)" in
            Darwin) open -a Docker ;;
            Linux)  sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true ;;
        esac
        info "Waiting for Docker to start (this can take up to 2 minutes)..."
        i=1
        while [ "$i" -le 24 ]; do
            sleep 5
            if docker info > /dev/null 2>&1; then
                success "Docker is now running."
                break
            fi
            if [ "$i" -eq 24 ]; then
                error "Docker did not start within 2 minutes."
                echo "  Please start Docker manually and run the installer again."
                exit 1
            fi
            i=$((i + 1))
        done
    else
        success "Docker is running."
    fi

    # ── Step 2: Download required files ────────────────────────────────────
    printf "\n"
    info "Downloading configuration files..."
    download_file "${REPO_BASE}/${COMPOSE_FILE}" "${COMPOSE_FILE}"
    download_file "${REPO_BASE}/${ENV_FILE}" "${ENV_FILE}"
    mkdir -p postgres
    download_file "${REPO_BASE}/postgres/init.sql" "postgres/init.sql"
    success "Configuration files downloaded."

    # ── Step 3: Create .env ─────────────────────────────────────────────────
    cp "${ENV_FILE}" .env
    success "Created .env from template."

    # ── Step 4: Check for Ollama (optional) ────────────────────────────────
    printf "\n"
    info "Checking for Ollama..."
    if command -v ollama > /dev/null 2>&1; then
        success "Ollama is installed."
        info "Checking AI models (this may take a minute)..."
        if ollama list 2>/dev/null | grep -q "llama3.2"; then
            success "llama3.2 already downloaded."
        else
            info "Downloading llama3.2 (~2 GB)..."
            ollama pull llama3.2
            success "llama3.2 ready."
        fi
        if ollama list 2>/dev/null | grep -q "nomic-embed-text"; then
            success "nomic-embed-text already downloaded."
        else
            info "Downloading nomic-embed-text (~274 MB)..."
            ollama pull nomic-embed-text
            success "nomic-embed-text ready."
        fi
    else
        warn "Ollama not detected."
        echo "     To use local AI, install Ollama: https://ollama.ai/"
        echo "     Then run: ollama pull llama3.2 && ollama pull nomic-embed-text"
        echo "     Or use a cloud provider — configure it in Settings after logging in."
    fi

    # ── Step 5: Pull Docker images and start ──────────────────────────────
    printf "\n"
    info "Pulling Docker images..."
    docker compose pull 2>&1 || {
        warn "Pull failed, but continuing anyway (images may already be cached)..."
    }
    success "Docker images pulled."

    printf "\n"
    info "Starting LuraStudy..."
    docker compose up -d 2>&1 || {
        warn "'docker compose up -d' failed. Trying with local build..."
        docker compose up --build -d 2>&1 || {
            error "Failed to start LuraStudy."
            echo "  Run 'docker compose logs' to see what went wrong."
            exit 1
        }
    }

    # ── Step 6: Success ────────────────────────────────────────────────────
    printf "\n"
    printf "%b%b════════════════════════════════════════════════%b\n" "${GREEN}" "${BOLD}" "${NC}"
    printf "%b%b  LuraStudy is running!                        %b\n" "${GREEN}" "${BOLD}" "${NC}"
    printf "%b%b════════════════════════════════════════════════%b\n" "${GREEN}" "${BOLD}" "${NC}"
    printf "\n"
    printf "  %bFrontend:%b  http://localhost:5173\n" "${WHITE}" "${NC}"
    printf "  %bBackend:%b   http://localhost:8000\n" "${WHITE}" "${NC}"
    printf "  %bAPI Docs:%b  http://localhost:8000/docs\n" "${WHITE}" "${NC}"
    printf "\n"
    printf "  %bFirst time?%b Go to http://localhost:5173/register\n" "${YELLOW}" "${NC}"
    echo "    to create your admin account."
    echo "  Then configure your AI provider in Settings -> LLM / Embedding."
    printf "\n"
    printf "  %bConfig files saved to:%b %s\n" "${CYAN}" "${NC}" "$INSTALL_DIR"
    printf "\n"
    printf "  %bTo restart later, run:%b\n" "${CYAN}" "${NC}"
    echo "    cd $INSTALL_DIR && docker compose up -d"
    printf "\n"
    printf "  %bTo update to the latest version:%b\n" "${CYAN}" "${NC}"
    echo "    cd $INSTALL_DIR && docker compose pull && docker compose up -d"
    printf "\n"

    # Try to open browser
    case "$(uname -s)" in
        Darwin) open http://localhost:5173/register 2>/dev/null || true ;;
        Linux)  xdg-open http://localhost:5173/register 2>/dev/null || true ;;
    esac
}

main "$@"