#!/bin/bash
# =============================================================
#  install-lite.sh — AllYourLinks Lite Installer (Linux)
#  Installs the frontend-only version (no backend required)
#  Usage: bash install-lite.sh
# =============================================================

set -e

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Config ────────────────────────────────────────────────────
DEFAULT_INSTALL_DIR="$HOME/projects/allyourlinks"
SERVICE_NAME="allyourlinks"
PORT=8000

# ── Log helpers ───────────────────────────────────────────────
info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Banner ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   AllYourLinks — Lite Installer      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ── 1. Detect project root ────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(realpath "$SCRIPT_DIR/../..")"

if [ -f "$PROJECT_ROOT/index.html" ]; then
  SOURCE_DIR="$PROJECT_ROOT"
  info "Project detected at: $SOURCE_DIR"
else
  error "Project not found. Make sure you run this script from inside the project folder."
fi

echo ""

# ── 2. Choose install path ────────────────────────────────────
echo -e "  Default install directory: ${CYAN}${DEFAULT_INSTALL_DIR}${NC}"
read -rp "  Use this path? (Y/n): " use_default

if [[ "$use_default" =~ ^[nN]$ ]]; then
  read -rp "  Enter full install path (e.g. /home/user/apps/allyourlinks): " custom_dir
  custom_dir="${custom_dir/#\~/$HOME}"
  INSTALL_DIR="${custom_dir:-$DEFAULT_INSTALL_DIR}"
else
  INSTALL_DIR="$DEFAULT_INSTALL_DIR"
fi

info "Source:      $SOURCE_DIR"
info "Destination: $INSTALL_DIR"
echo ""

# ── 3. Check dependencies ─────────────────────────────────────
info "Checking dependencies..."

if ! command -v python3 &>/dev/null; then
  error "python3 is not installed. Install it with: sudo apt install python3"
fi

PYTHON_VERSION=$(python3 --version 2>&1)
success "Python found: $PYTHON_VERSION"

# ── 4. Prepare install directory ──────────────────────────────
info "Preparing install directory..."

# Guard: source and destination cannot be the same
if [ "$(realpath "$SOURCE_DIR")" = "$(realpath "$INSTALL_DIR" 2>/dev/null || echo "$INSTALL_DIR")" ]; then
  error "Source and destination are the same directory: '$INSTALL_DIR'\n       Please choose a different destination path."
fi

if [ -d "$INSTALL_DIR" ]; then
  warn "Directory '$INSTALL_DIR' already exists."
  read -rp "Overwrite? (y/N): " confirm
  if [[ ! "$confirm" =~ ^[yY]$ ]]; then
    echo "Installation cancelled."
    exit 0
  fi
  rm -rf "$INSTALL_DIR"
fi

mkdir -p "$INSTALL_DIR"
cp -r "$SOURCE_DIR/." "$INSTALL_DIR/"
success "Files copied to $INSTALL_DIR"

# ── 5. Create systemd user service ───────────────────────────
info "Configuring systemd service..."

SERVICE_DIR="$HOME/.config/systemd/user"
mkdir -p "$SERVICE_DIR"

cat > "$SERVICE_DIR/${SERVICE_NAME}.service" << EOF
[Unit]
Description=AllYourLinks Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=python3 -m http.server ${PORT}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

success "Service file created at $SERVICE_DIR/${SERVICE_NAME}.service"

# ── 6. Enable and start service ───────────────────────────────
info "Enabling service..."

systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME" 2>/dev/null
systemctl --user restart "$SERVICE_NAME"

sleep 2

if systemctl --user is-active --quiet "$SERVICE_NAME"; then
  success "Service started successfully"
else
  warn "Service may not have started. Check status with:"
  warn "  systemctl --user status $SERVICE_NAME"
fi

# ── 7. Summary ────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       Installation complete          ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Dashboard:${NC}    http://localhost:${PORT}"
echo -e "  ${CYAN}Installed at:${NC} ${INSTALL_DIR}"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "  ${YELLOW}systemctl --user start   ${SERVICE_NAME}${NC}"
echo -e "  ${YELLOW}systemctl --user stop    ${SERVICE_NAME}${NC}"
echo -e "  ${YELLOW}systemctl --user restart ${SERVICE_NAME}${NC}"
echo -e "  ${YELLOW}systemctl --user status  ${SERVICE_NAME}${NC}"
echo ""
echo -e "  ${BOLD}To uninstall:${NC}"
echo -e "  ${YELLOW}bash ${INSTALL_DIR}/scripts/linux/uninstall-lite.sh${NC}"
echo ""
