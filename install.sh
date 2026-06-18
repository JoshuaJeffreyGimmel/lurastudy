#!/usr/bin/env bash
#
# LuraStudy — One-Command Installer
# ===================================
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/JoshuaJeffreyGimmel/lurastudy/main/install.sh | sh
#
# Prerequisites:
#   1. Docker Desktop (https://www.docker.com/products/docker-desktop/)
#   2. Ollama (https://ollama.ai/) — optional, for local AI
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
MAGENTA="\033[0;35m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
WHITE="\033[0;37m"
GRAY="\033[0;90m"
NC="\033[0m"

# ─── Helpers ──────────────────────────────────────────────────────────────────
info()    { echo -e "  ${CYAN}→${NC} $1"; }
success() { echo -e "  ${GREEN}✓${NC} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${NC} $1"; }
error()   { echo -e "  ${RED}✗${NC} $1"; }

print_banner() {
    cat << "EOF"
 █████                                       █████████   █████                   █████
░░███                                       ███░░░░░███ ░░███                   ░░███
 ░███        █████ ████ ████████   ██████  ░███    ░░░  ███████   █████ ████  ███████  █████ ████
 ░███       ░░███ ░███ ░░███░░███ ░░░░░███ ░░█████████ ░░░███░   ░░███ ░███  ███░░███ ░░███ ░███
 ░███        ░███ ░███  ░███ ░░░   ███████  ░░░░░░░░███  ░███     ░███ ░███ ░███ ░███  ░███ ░███
 ░███      █ ░███ ░███  ░███      ███░░███  ███    ░███  ░███ ███ ░███ ░███ ░███ ░███  ░███ ░███
 ███████████ ░░████████ █████    ░░████████░░█████████   ░░█████  ░░████████░░████████ ░░███████
░░░░░░░░░░░   ░░░░░░░░ ░░░░░      ░░░░░░░░  ░░░░░░░░░     ░░░░░    ░░░░░░░░  ░░░░░░░░   ░░░░░███
                                                                                        ███ ░███
                                                                                       ░░██████
                                                                                        ░░░░░░
EOF
    echo ""
    echo -e "  ${WHITE}Local-first AI study assistant${NC}"
    echo -e "  ${GRAY}One-command installer — v0.1.0${NC}"
    echo ""
}

check_cmd() {
    if ! command -v "$1" &> /dev/null; then
        error "$1 is not installed."
        return 1
    fi
    return 0
}

download_file() {
    local url="$1"
    local output="$2"
    if command -v curl &> /dev/null; then
        curl -fsSL "$url" -o "$output"
    elif command -v wget &> /dev/null; then
        wget -q "$url" -O "$output"
    else
        error "Neither curl nor wget found. Install curl and try again."
        exit 1
    fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
    print_banner

    INSTALL_DIR="$HOME/lurastudy"
    info "Setting up LuraStudy in: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"

    # ── Step 1: Check Docker ───────────────────────────────────────────────
    info "Checking prerequisites..."
    check_cmd docker || {
        error "Docker is not installed."
        echo "     Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
        exit 1
    }
    success "Docker is installed."

    if ! docker info &>/dev/null; then
        warn "Docker is installed but not running."
        echo "  Attempting to start Docker automatically..."
        case "$(uname -s)" in
            Darwin) open -a Docker ;;
            Linux)  sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true ;;
        esac
        info "Waiting for Docker to start (this can take up to 2 minutes)..."
        for i in $(seq 1 24); do
            sleep 5
            if docker info &>/dev/null; then
                success "Docker is now running."
                break
            fi
            if [ "$i" -eq 24 ]; then
                error "Docker did not start within 2 minutes."
                echo "  Please start Docker Desktop manually and run the installer again."
                exit 1
            fi
        done
    else
        success "Docker is running."
    fi

    # ── Step 2: Download required files ────────────────────────────────────
    echo ""
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
    echo ""
    info "Checking for Ollama..."
    if command -v ollama &> /dev/null; then
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
    echo ""
    info "Pulling Docker images..."
    docker compose pull 2>&1 || {
        warn "Pull failed, but continuing anyway (images may already be cached)..."
    }
    success "Docker images pulled."

    echo ""
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
    echo ""
    echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}  LuraStudy is running!                        ${NC}"
    echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${WHITE}Frontend:${NC}  http://localhost:5173"
    echo -e "  ${WHITE}Backend:${NC}   http://localhost:8000"
    echo -e "  ${WHITE}API Docs:${NC}  http://localhost:8000/docs"
    echo ""
    echo -e "  ${YELLOW}First time?${NC} Go to http://localhost:5173/register"
    echo "    to create your admin account."
    echo "  Then configure your AI provider in Settings -> LLM / Embedding."
    echo ""
    echo -e "  ${CYAN}Config files saved to:${NC} $INSTALL_DIR"
    echo ""
    echo -e "  ${CYAN}To restart later, run:${NC}"
    echo -e "    cd $INSTALL_DIR && docker compose up -d"
    echo ""
    echo -e "  ${CYAN}To update to the latest version:${NC}"
    echo -e "    cd $INSTALL_DIR && docker compose pull && docker compose up -d"
    echo ""

    # Try to open browser
    case "$(uname -s)" in
        Darwin) open http://localhost:5173/register 2>/dev/null || true ;;
        Linux)  xdg-open http://localhost:5173/register 2>/dev/null || true ;;
    esac
}

main "$@"