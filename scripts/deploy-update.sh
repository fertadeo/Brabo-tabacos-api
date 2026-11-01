#!/usr/bin/env bash
# Actualiza Brabo Tabacos API en Ubuntu VPS:
#   git pull → deps si hace falta → build → pm2 restart
#
# Uso (desde el repo o con APP_DIR):
#   sudo bash scripts/deploy-update.sh
#   sudo APP_DIR=/var/www/brabo-tabacos-api bash scripts/deploy-update.sh
#   sudo BRANCH=main PM2_NAME=brabo-tabacos-api bash scripts/deploy-update.sh
#
# Variables opcionales:
#   APP_DIR      Ruta del repo (default: directorio padre de scripts/)
#   BRANCH       Rama a pull (default: main)
#   PM2_NAME     Nombre del proceso PM2 (default: brabo-tabacos-api)
#   PM2_HOME     Home de PM2 (default: /root/.pm2 — el de root)
#   FORCE_NPM    1 = siempre npm ci (default: solo si cambió package-lock / node_modules)

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}!!${NC} $*"; }
die()  { echo -e "${RED}ERROR:${NC} $*" >&2; exit 1; }

# Resolver APP_DIR
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
BRANCH="${BRANCH:-main}"
PM2_NAME="${PM2_NAME:-brabo-tabacos-api}"
export PM2_HOME="${PM2_HOME:-/root/.pm2}"
FORCE_NPM="${FORCE_NPM:-0}"

pm2_root() {
  env HOME=/root PM2_HOME="${PM2_HOME}" pm2 "$@"
}

need_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    die "Ejecutá con sudo (PM2 de Brabo vive en /root/.pm2). Ejemplo: sudo bash scripts/deploy-update.sh"
  fi
}

need_root

[[ -d "$APP_DIR" ]] || die "No existe APP_DIR=$APP_DIR"
[[ -f "$APP_DIR/package.json" ]] || die "No hay package.json en $APP_DIR"
command -v git >/dev/null || die "git no está instalado"
command -v node >/dev/null || die "node no está instalado"
command -v npm >/dev/null || die "npm no está instalado"
command -v pm2 >/dev/null || die "pm2 no está instalado (npm i -g pm2)"

cd "$APP_DIR"
log "Directorio: $APP_DIR"
log "Rama: $BRANCH | PM2: $PM2_NAME | PM2_HOME=$PM2_HOME"

# --- git pull ---
log "git fetch + pull ($BRANCH)"
git fetch --prune origin
# Evitar fallar si hay cambios locales en tracked files
if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "Hay cambios locales sin commit. Se hace stash automático."
  git stash push -u -m "deploy-update auto-stash $(date -u +%Y%m%dT%H%M%SZ)" || true
fi
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

# --- dependencias (solo si hace falta) ---
LOCK_BEFORE=""
[[ -f package-lock.json ]] && LOCK_BEFORE="$(sha256sum package-lock.json | awk '{print $1}')"

NEED_INSTALL=0
if [[ "$FORCE_NPM" == "1" ]]; then
  NEED_INSTALL=1
elif [[ ! -d node_modules ]]; then
  NEED_INSTALL=1
  warn "No hay node_modules → npm ci"
elif [[ -f package-lock.json ]]; then
  # Comparar lock actual vs el que se usó al instalar (marcador)
  MARKER=".deploy-lock-sha"
  LOCK_NOW="$(sha256sum package-lock.json | awk '{print $1}')"
  if [[ ! -f "$MARKER" ]] || [[ "$(cat "$MARKER")" != "$LOCK_NOW" ]]; then
    NEED_INSTALL=1
    warn "package-lock.json cambió → npm ci"
  fi
fi

if [[ "$NEED_INSTALL" -eq 1 ]]; then
  log "Instalando dependencias (incluye devDeps para tsc)…"
  if [[ -f package-lock.json ]]; then
    npm ci --include=dev
  else
    npm install
  fi
  if [[ -f package-lock.json ]]; then
    sha256sum package-lock.json | awk '{print $1}' > .deploy-lock-sha
  fi
else
  log "Dependencias OK (sin reinstall)"
fi

# --- build ---
log "Build (npm run build)"
npm run build
[[ -f dist/index.js ]] || die "Build falló: no existe dist/index.js"

# --- pm2 restart ---
log "Reiniciando PM2 ($PM2_NAME)"
if pm2_root describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2_root restart "$PM2_NAME" --update-env
else
  warn "Proceso '$PM2_NAME' no existe. Intentando start…"
  if [[ -f ecosystem.config.js ]]; then
    pm2_root start ecosystem.config.js --update-env
  else
    # Fallback típico Brabo
    PORT="${PORT:-8087}"
    pm2_root start dist/index.js --name "$PM2_NAME" --update-env
  fi
fi

pm2_root save
pm2_root list

log "Listo. Logs: sudo PM2_HOME=/root/.pm2 pm2 logs $PM2_NAME --lines 50"
log "Health (si aplica): curl -sS http://127.0.0.1:${PORT:-8087}/health || true"
