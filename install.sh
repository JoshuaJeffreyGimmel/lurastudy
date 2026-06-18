#!/usr/bin/env bash
#
# LuraStudy — One-Command Installer
# ===================================
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/JoshuaJeffreyGimmel/lurastudy/main/install.sh | sh
#
# Or with local AI defaults (non-interactive):
#   curl -fsSL https://raw.githubusercontent.com/JoshuaJeffreyGimmel/lurastudy/main/install.sh | sh -s -- --defaults
#
# Prerequisites:
#   1. Docker Desktop (https://www.docker.com/products/docker-desktop/)
#   2. Ollama (https://ollama.ai/) — only if using local AI (default)
#

set -e

# ─── Config ──────────────────────────────────────────────────────────────────
REPO_OWNER="JoshuaJeffreyGimmel"
REPO_NAME="lurastudy"
REPO_BRANCH="main"
REPO_BASE="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env.example"

# ─── Colors ──────────────────────────────────────────────────────────────────
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
NC="\033[0m"

# ─── Flags ───────────────────────────────────────────────────────────────────
USE_DEFAULTS=false
for arg in "$@"; do
    case "$arg" in
        --defaults) USE_DEFAULTS=true ;;
    esac
done

# ─── Helpers ──────────────────────────────────────────────────────────────────
info()    { echo -e "  ${CYAN}→${NC} $1"; }
success() { echo -e "  ${GREEN}✓${NC} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${NC} $1"; }
error()   { echo -e "  ${RED}✗${NC} $1"; }

print_banner() {
    echo ""
    echo -e "${BOLD}${CYAN}  _     _               _   _     _           ${NC}"
    echo -e "${BOLD}${CYAN} | |   | |             | | | |   (_)          ${NC}"
    echo -e "${BOLD}${CYAN} | |   | | _ __ ___  __| | | |    _ _ __  ___ ${NC}"
    echo -e "${BOLD}${CYAN} | |   | || '__/ _ \/ _\` | | |   | | '_ \/ __|${NC}"
    echo -e "${BOLD}${CYAN} | |___| || | |  __/ (_| | | |___| | | | \__ \${NC}"
    echo -e "${BOLD}${CYAN}  \_____(_)_|  \___|\__,_| |_____|_|_| |_|___/${NC}"
    echo ""
    echo -e "${BOLD}Local-first AI study assistant${NC}"
    echo -e "${YELLOW}One-command installer — v0.1.0${NC}"
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

    TMP_DIR=$(mktemp -d)
    cd "$TMP_DIR"

    # ── Step 1: Check Docker ───────────────────────────────────────────────
    info "Checking prerequisites..."
    check_cmd docker || {
        error "Docker is not installed."
        echo "     Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
        exit 1
    }
    success "Docker is installed."

    # Check Docker is running; if not, try to auto-start
    if ! docker info &>/dev/null; then
        warn "Docker is installed but not running."
        echo "  Attempting to start Docker automatically..."
        case "$(uname -s)" in
            Darwin)
                open -a Docker
                ;;
            Linux)
                sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true
                ;;
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
    success "Configuration files downloaded."

    # ── Step 3: Create .env ─────────────────────────────────────────────────
    cp "${ENV_FILE}" .env
    success "Created .env from template."

    # ── Step 4: Configure AI (local vs cloud) ──────────────────────────────
    echo ""
    USE_CLOUD=false
    if [ "$USE_DEFAULTS" = true ]; then
        info "Non-interactive mode: using local AI (Ollama)."
        USE_CLOUD=false
    else
        info "How do you want to run the AI?"
        echo "   1) Local — use Ollama (free, private, runs on your machine) [default]"
        echo "   2) Cloud — use OpenAI (no installation, ~\$2/month in API costs)"
        echo ""
        read -r -p "  Choose [1/2]: " ai_choice

        case "$ai_choice" in
            2|cloud|Cloud|openai|OpenAI) USE_CLOUD=true ;;
            *) USE_CLOUD=false ;;
        esac
    fi

    if [ "$USE_CLOUD" = true ]; then
        echo ""
        info "Cloud AI selected."
        echo "  You'll need an OpenAI API key (https://platform.openai.com/api-keys)."
        echo ""
        read -r -p "  Enter your OpenAI API key (sk-...): " api_key

        if [ -n "$api_key" ]; then
            # Update .env with cloud settings
            if [[ "$(uname -s)" == "Darwin" ]]; then
                sed -i '' "s|^LLM_BASE_URL=.*|LLM_BASE_URL=https://api.openai.com/v1|" .env
                sed -i '' "s|^LLM_API_KEY=.*|LLM_API_KEY=$api_key|" .env
                sed -i '' "s|^LLM_MODEL=.*|LLM_MODEL=gpt-4o-mini|" .env
                sed -i '' "s|^EMBEDDING_BASE_URL=.*|EMBEDDING_BASE_URL=https://api.openai.com/v1|" .env
                sed -i '' "s|^EMBEDDING_API_KEY=.*|EMBEDDING_API_KEY=$api_key|" .env
                sed -i '' "s|^EMBEDDING_MODEL=.*|EMBEDDING_MODEL=text-embedding-3-small|" .env
                sed -i '' "s|^EMBEDDING_DIMENSIONS=.*|EMBEDDING_DIMENSIONS=1536|" .env
            else
                sed -i "s|^LLM_BASE_URL=.*|LLM_BASE_URL=https://api.openai.com/v1|" .env
                sed -i "s|^LLM_API_KEY=.*|LLM_API_KEY=$api_key|" .env
                sed -i "s|^LLM_MODEL=.*|LLM_MODEL=gpt-4o-mini|" .env
                sed -i "s|^EMBEDDING_BASE_URL=.*|EMBEDDING_BASE_URL=https://api.openai.com/v1|" .env
                sed -i "s|^EMBEDDING_API_KEY=.*|EMBEDDING_API_KEY=$api_key|" .env
                sed -i "s|^EMBEDDING_MODEL=.*|EMBEDDING_MODEL=text-embedding-3-small|" .env
                sed -i "s|^EMBEDDING_DIMENSIONS=.*|EMBEDDING_DIMENSIONS=1536|" .env
            fi
            success "OpenAI API key saved."
        else
            warn "No API key provided. You can configure it later in Settings."
        fi
    else
        # Local AI — check/install Ollama
        echo ""
        info "Local AI selected. Checking for Ollama..."
        if command -v ollama &> /dev/null; then
            success "Ollama is installed."

            echo ""
            info "Checking AI models (this may take a minute)..."
            if ollama list 2>/dev/null | grep -q "llama3.2"; then
                success "llama3.2 already downloaded."
            else
                info "Downloading llama3.2 (~2 GB)..."
                echo "  This may take a while depending on your internet speed."
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
            echo "     You'll need to install Ollama and pull the models manually:"
            echo "       1. Install: https://ollama.ai/"
            echo "       2. Run: ollama pull llama3.2 && ollama pull nomic-embed-text"
            echo ""
            echo "     The app will still start, but AI features won't work until Ollama is set up."
        fi
    fi

    # ── Step 5: Pull Docker images and start ──────────────────────────────
    echo ""
    info "Pulling Docker images..."
    docker compose pull 2>&1 || {
        warn "Pull failed. Make sure you have internet access."
        exit 1
    }
    success "Docker images pulled."

    echo ""
    info "Starting LuraStudy..."
    docker compose up -d 2>&1 || {
        error "Failed to start LuraStudy."
        echo "  Run 'docker compose logs' to see what went wrong."
        exit 1
    }

    # ── Step 6: Success ────────────────────────────────────────────────────
    echo ""
    echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}  LuraStudy is running!                        ${NC}"
    echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Frontend:  ${BOLD}http://localhost:5173${NC}"
    echo -e "  Backend:   ${BOLD}http://localhost:8000${NC}"
    echo -e "  API Docs:  ${BOLD}http://localhost:8000/docs${NC}"
    echo ""
    echo -e "  👤 ${BOLD}First time?${NC} Go to http://localhost:5173/register"
    echo "    to create your admin account."
    echo ""

    # Try to open browser
    case "$(uname -s)" in
        Darwin) open http://localhost:5173 2>/dev/null || true ;;
        Linux)  xdg-open http://localhost:5173 2>/dev/null || true ;;
    esac

    # Cleanup
    cd /tmp
    rm -rf "$TMP_DIR"
}

main "$@"