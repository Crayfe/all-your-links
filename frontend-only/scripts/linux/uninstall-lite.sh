#!/bin/bash
# =============================================================
#  uninstall-lite.sh — AllYourLinks Lite Uninstaller (Linux)
#  Usage: bash uninstall-lite.sh
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
SERVICE_NAME="allyourlinks"
DEFAULT_INSTALL_DIR="$HOME/projects/allyourlinks"
SERVICE_FILE="$HOME/.config/systemd/user/${SERVICE_NAME}.service"

# ── Log helpers ───────────────────────────────────────────────
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }

# ── Banner ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   AllYourLinks — Lite Uninstaller    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Detect install directory from systemd service ────────────
if [ -f "$SERVICE_FILE" ]; then
  DETECTED_DIR=$(grep -oP '(?<=WorkingDirectory=).*' "$SERVICE_FILE" || true)
  if [ -n "$DETECTED_DIR" ] && [ -d "$DETECTED_DIR" ]; then
    INSTALL_DIR="$DETECTED_DIR"
    echo -e "  Installation detected at: ${CYAN}${INSTALL_DIR}${NC}"
  else
    INSTALL_DIR="$DEFAULT_INSTALL_DIR"
    echo -e "  Using default path: ${CYAN}${INSTALL_DIR}${NC}"
  fi
else
  echo -e "  No active installation detected."
  echo -e "  Default directory: ${CYAN}${DEFAULT_INSTALL_DIR}${NC}"
  read -rp "  Use this path? (Y/n): " use_default
  if [[ "$use_default" =~ ^[nN]$ ]]; then
    read -rp "  Enter the full path where the project was installed: " custom_dir
    custom_dir="${custom_dir/#\~/$HOME}"
    INSTALL_DIR="${custom_dir:-$DEFAULT_INSTALL_DIR}"
  else
    INSTALL_DIR="$DEFAULT_INSTALL_DIR"
  fi
fi

echo ""
echo -e "${YELLOW}This will remove:${NC}"
echo -e "  · Systemd service: $SERVICE_FILE"
echo -e "  · Project files:   $INSTALL_DIR"
echo ""
read -rp "Continue? (y/N): " confirm
if [[ ! "$confirm" =~ ^[yY]$ ]]; then
  echo "Uninstall cancelled."
  exit 0
fi

# ── Stop and disable service ──────────────────────────────────
if systemctl --user is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  systemctl --user stop "$SERVICE_NAME"
  success "Service stopped"
fi

if systemctl --user is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
  systemctl --user disable "$SERVICE_NAME"
  success "Service disabled"
fi

# ── Remove service file ───────────────────────────────────────
if [ -f "$SERVICE_FILE" ]; then
  rm "$SERVICE_FILE"
  systemctl --user daemon-reload
  success "Service file removed"
fi

# ── Remove project files ──────────────────────────────────────
if [ -d "$INSTALL_DIR" ]; then
  read -rp "Also delete project files at $INSTALL_DIR? (y/N): " confirm2
  if [[ "$confirm2" =~ ^[yY]$ ]]; then
    rm -rf "$INSTALL_DIR"
    success "Project files removed"
  else
    warn "Project files kept at $INSTALL_DIR"
  fi
else
  warn "Directory $INSTALL_DIR not found, skipping"
fi

echo ""
echo -e "${GREEN}Uninstall complete.${NC}"
echo ""
