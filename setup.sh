#!/usr/bin/env bash
#
# LuraStudy — One-Click Setup
# ============================
# This script installs and starts LuraStudy with minimal user effort.
#
# Usage:
#   bash setup.sh
#
# Or from the repo directory:
#   ./setup.sh
#

set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
NC="\033[0m"

REPO_URL="https://github.com/JoshuaJeffreyGimmel/lurastudy.git"
REPO_DIR="lurastudy"

# ─── Helpers ──────────────────────────────────────────────────────────────────

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
    echo -e "${YELLOW}One-click setup — v0.1.0${NC}"
    echo ""
}

info()    { echo -e "  ${CYAN}→${NC} $1"; }
success() { echo -e "  ${GREEN}✓${NC} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${NC} $1"; }
error()   { echo -e "  ${RED}✗${NC} $1"; }

check_cmd() {
    if ! command -v "$1" &> /dev/null; then
        error "$1 is not installed."
        case "$1" in
            docker)
                echo "     Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
                ;;
            ollama)
                echo "     Install Ollama: https://ollama.ai/"
                ;;
            git)
                echo "     Install Git: https://git-scm.com/"
                ;;
        esac
        return 1
    fi
    return 0
}

# ─── Main ────────────────────────────────────────────────────────────────────

main() {
    print_banner

    # Step 0: Determine working directory
    if [ -f "docker-compose.yml" ]; then
        REPO_DIR="."
        info "Already in the LuraStudy repository."
    else
        info "Cloning LuraStudy repository..."
        check_cmd git || exit 1
        git clone --depth 1 "$REPO_URL" 2>/dev/null || {
            warn "Clone failed — directory may already exist."
            if [ -d "$REPO_DIR" ]; then
                info "Using existing '$REPO_DIR' directory."
            else
                error "Cannot clone. Please clone manually:"
                echo "     git clone $REPO_URL"
                exit 1
            fi
        }
        cd "$REPO_DIR"
        success "Repository ready."
    fi

    # Step 1: Check Docker
    echo ""
    info "Checking prerequisites..."
    check_cmd docker || exit 1
    success "Docker is installed."

    # Step 2: Create .env if missing
    if [ ! -f ".env" ]; then
        cp .env.example .env
        success "Created .env from template."
    else
        info ".env already exists — keeping your settings."
    fi

    # Step 3: Ask local vs cloud
    echo ""
    info "How do you want to run the AI?"
    echo "   1) Local — use Ollama (free, private, runs on your machine)"
    echo "   2) Cloud — use OpenAI (no installation, ~$2/month in API costs)"
    echo ""
    read -r -p "  Choose [1/2]: " ai_choice

    USE_CLOUD=false
    case "$ai_choice" in
        2|cloud|Cloud|openai|OpenAI)
            USE_CLOUD=true
            ;;
        *)
            USE_CLOUD=false
            ;;
    esac

    COMPOSE_CMD="docker compose up -d"

    if [ "$USE_CLOUD" = true ]; then
        echo ""
        info "Select your LLM provider (all use OpenAI-compatible API):"
        echo "   1) OpenAI       - gpt-4o-mini"
        echo "   2) Groq         - llama-3.3-70b (free tier available)"
        echo "   3) Together AI  - Llama-3.2-3B-Instruct"
        echo "   4) DeepSeek     - deepseek-chat"
        echo "   5) Mistral AI   - mistral-small-latest"
        echo "   6) xAI (Grok)   - grok-2"
        echo "   7) OpenRouter   - any model (Claude, Gemini, GPT, etc.)"
        echo "   8) Custom       - enter your own endpoint"
        echo ""
        read -r -p "  Choose [1-8]: " prov_choice

        case "$prov_choice" in
            1) LLM_URL="https://api.openai.com/v1";     LLM_MODEL="gpt-4o-mini";           EMBED_MODEL="text-embedding-3-small";           EMBED_DIMS="1536" ;;
            2) LLM_URL="https://api.groq.com/openai/v1"; LLM_MODEL="llama-3.3-70b-versatile"; EMBED_MODEL="llama-3.3-70b-versatile";          EMBED_DIMS="768" ;;
            3) LLM_URL="https://api.together.xyz/v1";   LLM_MODEL="meta-llama/Llama-3.2-3B-Instruct-Turbo"; EMBED_MODEL="thenlper/gte-base";        EMBED_DIMS="768" ;;
            4) LLM_URL="https://api.deepseek.com/v1";   LLM_MODEL="deepseek-chat";          EMBED_MODEL="deepseek-chat";                    EMBED_DIMS="1536" ;;
            5) LLM_URL="https://api.mistral.ai/v1";     LLM_MODEL="mistral-small-latest";   EMBED_MODEL="mistral-embed";                    EMBED_DIMS="1024" ;;
            6) LLM_URL="https://api.x.ai/v1";           LLM_MODEL="grok-2";                 EMBED_MODEL="grok-2";                           EMBED_DIMS="1536" ;;
            7) LLM_URL="https://openrouter.ai/api/v1";  LLM_MODEL="openai/gpt-4o-mini";     EMBED_MODEL="openai/text-embedding-3-small";    EMBED_DIMS="1536" ;;
            8)
                echo ""
                read -r -p "  Enter the LLM base URL (e.g. https://api.example.com/v1): " LLM_URL
                read -r -p "  Enter the model name (e.g. my-model): " LLM_MODEL
                read -r -p "  Enter the embedding model name (e.g. my-embed-model): " EMBED_MODEL
                read -r -p "  Enter the embedding dimensions (e.g. 768): " EMBED_DIMS
                ;;
            *)
                LLM_URL="https://api.openai.com/v1";    LLM_MODEL="gpt-4o-mini";           EMBED_MODEL="text-embedding-3-small";           EMBED_DIMS="1536" ;;
        esac

        echo ""
        read -r -p "  Enter your API key: " api_key

        if [ -n "$api_key" ]; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^LLM_BASE_URL=.*|LLM_BASE_URL=$LLM_URL|" .env
                sed -i '' "s|^LLM_API_KEY=.*|LLM_API_KEY=$api_key|" .env
                sed -i '' "s|^LLM_MODEL=.*|LLM_MODEL=$LLM_MODEL|" .env
                sed -i '' "s|^EMBEDDING_BASE_URL=.*|EMBEDDING_BASE_URL=$LLM_URL|" .env
                sed -i '' "s|^EMBEDDING_API_KEY=.*|EMBEDDING_API_KEY=$api_key|" .env
                sed -i '' "s|^EMBEDDING_MODEL=.*|EMBEDDING_MODEL=$EMBED_MODEL|" .env
                sed -i '' "s|^EMBEDDING_DIMENSIONS=.*|EMBEDDING_DIMENSIONS=$EMBED_DIMS|" .env
            else
                sed -i "s|^LLM_BASE_URL=.*|LLM_BASE_URL=$LLM_URL|" .env
                sed -i "s|^LLM_API_KEY=.*|LLM_API_KEY=$api_key|" .env
                sed -i "s|^LLM_MODEL=.*|LLM_MODEL=$LLM_MODEL|" .env
                sed -i "s|^EMBEDDING_BASE_URL=.*|EMBEDDING_BASE_URL=$LLM_URL|" .env
                sed -i "s|^EMBEDDING_API_KEY=.*|EMBEDDING_API_KEY=$api_key|" .env
                sed -i "s|^EMBEDDING_MODEL=.*|EMBEDDING_MODEL=$EMBED_MODEL|" .env
                sed -i "s|^EMBEDDING_DIMENSIONS=.*|EMBEDDING_DIMENSIONS=$EMBED_DIMS|" .env
            fi
            success "API key saved."
        else
            warn "No API key provided. You can configure it later in Settings."
        fi
    else
        # Local AI — check Ollama
        echo ""
        info "Local AI selected. Checking for Ollama..."
        if check_cmd ollama; then
            success "Ollama is installed."

            # Check if models are already pulled
            echo ""
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
            warn "Ollama not detected. You'll need to run models separately."
            echo "     Install: https://ollama.ai/"
            echo "     Then: ollama pull llama3.2 && ollama pull nomic-embed-text"
        fi
    fi

    # Step 4: Pull Docker images (pre-built on Docker Hub)
    echo ""
    info "Pulling Docker images..."
    docker compose pull 2>/dev/null || {
        warn "Pull failed. Make sure you have internet access."
        echo ""
        warn "Check your internet connection and try again."
        exit 1
    }
    success "Docker images pulled."

    # Step 5: Start Docker Compose
    echo ""
    info "Starting LuraStudy..."
    $COMPOSE_CMD 2>&1 || {
        error "Failed to start LuraStudy."
        echo "  Run 'docker compose logs' to see what went wrong."
        exit 1
    }

    # Step 6: Success
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
    echo -e "  ${YELLOW}Tip:${NC} Open http://localhost:5173 and follow the"
    echo "  onboarding wizard to get started quickly."
    echo ""

    if [ "$USE_CLOUD" = false ] && command -v ollama &> /dev/null; then
        echo -e "  ${YELLOW}Note:${NC} Make sure Ollama stays running in the background."
        echo "  If you close it, AI features won't work."
        echo ""
    fi
}

main "$@"