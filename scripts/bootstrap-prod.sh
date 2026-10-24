#!/usr/bin/env bash
# =============================================================================
# Brabo Tabacos API — bootstrap producción Ubuntu (idempotente)
#
# Uso (una vez en el VPS, como root o con sudo):
#   export DB_PASSWORD='***' JWT_SECRET='***' CORS_ORIGIN='https://tu-front'
#   sudo -E bash scripts/bootstrap-prod.sh
#
# O desde fuera del repo (clona solo):
#   curl -fsSL ... | sudo -E bash   # o:
#   sudo -E GIT_URL=... bash -c '...'
#
# NUNCA apunta a la BD de prod de MF Computers.
# =============================================================================
set -euo pipefail

APP_NAME="${APP_NAME:-brabo-tabacos-api}"
APP_DIR="${APP_DIR:-/var/www/brabo-tabacos-api}"
GIT_URL="${GIT_URL:-https://github.com/fertadeo/Brabo-tabacos-api.git}"
GIT_BRANCH="${GIT_BRANCH:-main}"
PORT="${PORT:-8086}"
DOMAIN="${DOMAIN:-}"
NODE_MAJOR="${NODE_MAJOR:-20}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-brabo_tabacos}"
DB_USER="${DB_USER:-brabo}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-}"
# Dump opcional: copia funcional (schema+datos limpios). Si vacío → schema.sql + seed.
DB_DUMP="${DB_DUMP:-}"
SKIP_DB_SEED="${SKIP_DB_SEED:-false}"

INSTALL_NGINX="${INSTALL_NGINX:-true}"
CORS_ORIGIN="${CORS_ORIGIN:-http://127.0.0.1:43127}"
JWT_SECRET="${JWT_SECRET:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-CambiarYa123!}"
FEATURE_REPARACIONES="${FEATURE_REPARACIONES:-false}"
API_KEY="${API_KEY:-}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}WARN:${NC} $*"; }
die()  { echo -e "${RED}ERROR:${NC} $*" >&2; exit 1; }

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Corré con sudo: sudo -E bash scripts/bootstrap-prod.sh"
  fi
}

# --- Seguridad: nunca tocar BD MF prod ---
assert_safe_db() {
  local name_lc host_lc
  name_lc="$(echo "$DB_NAME" | tr '[:upper:]' '[:lower:]')"
  host_lc="$(echo "$DB_HOST" | tr '[:upper:]' '[:lower:]')"
  case "$name_lc" in
    mfcomputers|mf_computers|mf-computers|sistema_mf*)
      die "DB_NAME='$DB_NAME' parece BD de MF. Usá una BD nueva (ej. brabo_tabacos)."
      ;;
  esac
  if [[ "$host_lc" == *"mfcomputers"* ]]; then
    die "DB_HOST='$DB_HOST' parece host MF. Usá localhost o el MySQL del VPS Brabo."
  fi
  if [[ "$name_lc" != "brabo_tabacos" && "$name_lc" != brabo_* ]]; then
    warn "DB_NAME='$DB_NAME' no es brabo_*. Continuá solo si es intencional."
  fi
}

rand_hex() { openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | xxd -p | tr -d '\n' | head -c 48; }

ensure_vars() {
  assert_safe_db
  if [[ -z "$DB_PASSWORD" ]]; then
    DB_PASSWORD="$(rand_hex)"
    warn "DB_PASSWORD no seteado → generado (guardado en $APP_DIR/.env)"
  fi
  if [[ -z "$JWT_SECRET" ]]; then
    JWT_SECRET="$(rand_hex)"
    warn "JWT_SECRET no seteado → generado"
  fi
  if [[ -z "$API_KEY" ]]; then
    API_KEY="brabo-$(rand_hex | head -c 32)"
  fi
}

install_packages() {
  log "1/8 Apt update + paquetes base"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y curl ca-certificates gnupg git build-essential openssl

  # MariaDB (más estable en Ubuntu reciente que mysql-server del archive)
  if ! command -v mysql >/dev/null 2>&1; then
    log "Instalando MariaDB server/client"
    apt-get install -y mariadb-server mariadb-client
    systemctl enable --now mariadb || systemctl enable --now mysql || true
  else
    log "MySQL/MariaDB ya presente"
    systemctl enable --now mariadb 2>/dev/null || systemctl enable --now mysql 2>/dev/null || true
  fi

  if [[ "$INSTALL_NGINX" == "true" ]]; then
    apt-get install -y nginx
    systemctl enable --now nginx || true
  fi

  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null | sed 's/v//;s/\..*//')" -lt "$NODE_MAJOR" ]]; then
    log "Instalando Node.js ${NODE_MAJOR}.x LTS"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y nodejs
  fi
  log "Node $(node -v) / npm $(npm -v)"

  if ! command -v pm2 >/dev/null 2>&1; then
    log "Instalando PM2"
    npm install -g pm2
  fi
}

clone_or_update() {
  log "2/8 Repo en $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  if [[ -d "$APP_DIR/.git" ]]; then
    git -C "$APP_DIR" fetch origin
    git -C "$APP_DIR" checkout "$GIT_BRANCH"
    git -C "$APP_DIR" pull --ff-only origin "$GIT_BRANCH" || warn "pull no ff-only; dejando árbol actual"
  else
    if [[ -d "$APP_DIR" ]] && [[ -f "$APP_DIR/package.json" ]]; then
      log "Directorio con código sin .git — se usa tal cual"
    else
      rm -rf "$APP_DIR"
      git clone --branch "$GIT_BRANCH" --depth 1 "$GIT_URL" "$APP_DIR"
    fi
  fi
  cd "$APP_DIR"
  [[ -f package.json ]] || die "No hay package.json en $APP_DIR"
}

mysql_root() {
  # Conexión root local (socket auth típico en MariaDB fresca)
  if [[ -n "$DB_ROOT_PASSWORD" ]]; then
    mysql -h"$DB_HOST" -P"$DB_PORT" -uroot -p"$DB_ROOT_PASSWORD" "$@"
  else
    mysql -h"$DB_HOST" -P"$DB_PORT" -uroot "$@"
  fi
}

setup_database() {
  log "3/8 Base de datos $DB_NAME (nueva, no MF)"
  assert_safe_db

  mysql_root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

  local table_count
  table_count="$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null || echo 0)"

  if [[ -n "$DB_DUMP" ]]; then
    [[ -f "$DB_DUMP" ]] || die "DB_DUMP no existe: $DB_DUMP"
    log "Restaurando dump funcional → $DB_NAME (desde $DB_DUMP)"
    # Reescribir USE/nombre si el dump viene de otro schema (sin tocar MF remoto)
    sed -E \
      -e 's/USE[[:space:]]+`?mfcomputers`?/USE `'"${DB_NAME}"'`/Ig' \
      -e 's/USE[[:space:]]+`?brabo_tabacos`?/USE `'"${DB_NAME}"'`/Ig' \
      "$DB_DUMP" | mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME"
  elif [[ "${table_count}" -lt 5 ]]; then
    log "Importando db/schema.sql (BD vacía)"
    [[ -f db/schema.sql ]] || die "Falta db/schema.sql"
    # Quitar USE hardcodeado si aparece
    sed -E 's/USE[[:space:]]+`[^`]+`/USE `'"${DB_NAME}"'`/Ig' db/schema.sql \
      | mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME"
    # Migraciones incrementales (best-effort; ignore already-applied)
    if [[ -d migrations ]]; then
      log "Aplicando migrations/*.sql (best-effort)"
      for f in migrations/*.sql; do
        [[ -f "$f" ]] || continue
        mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$f" \
          && log "  ok $(basename "$f")" \
          || warn "  skip/error $(basename "$f") (puede estar aplicada)"
      done
    fi
  else
    log "BD ya tiene ${table_count} tablas — no reimporta schema (idempotente)"
  fi
}

write_env() {
  log "4/8 Escribiendo .env (no pisa secretos existentes salvo FORCE_ENV=true)"
  local env_file="$APP_DIR/.env"
  if [[ -f "$env_file" && "${FORCE_ENV:-false}" != "true" ]]; then
    warn ".env ya existe — no se sobrescribe (FORCE_ENV=true para regenerar)"
    return
  fi
  umask 077
  cat > "$env_file" <<EOF
NODE_ENV=production
PORT=${PORT}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
DB_POOL_SIZE=10
CORS_ORIGIN=${CORS_ORIGIN}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_SECRET}-refresh
JWT_ACCESS_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
FEATURE_REPARACIONES=${FEATURE_REPARACIONES}
API_KEY=${API_KEY}
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@brabotabacos.local
ADMIN_PASSWORD=${ADMIN_PASSWORD}
INIT_ADMIN_ON_START=true
INIT_SUPERADMIN_ON_START=false
EOF
  chmod 600 "$env_file"
  log ".env escrito en $env_file"
}

build_app() {
  log "5/8 npm ci + build"
  cd "$APP_DIR"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
  npm run build
  [[ -f dist/index.js ]] || die "Build falló: no hay dist/index.js"
}

seed_db() {
  if [[ "$SKIP_DB_SEED" == "true" ]]; then
    log "6/8 Seed omitido (SKIP_DB_SEED=true)"
    return
  fi
  if [[ -n "$DB_DUMP" ]]; then
    log "6/8 Seed mínimo omitido (vino dump); asegurando admin si falta"
  else
    log "6/8 Seed Brabo mínimo (admin + categorías)"
  fi
  cd "$APP_DIR"
  npm run seed:brabo || warn "seed:brabo falló — revisá schema/categorías"
}

write_ecosystem() {
  cat > "$APP_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [{
    name: '${APP_NAME}',
    script: 'dist/index.js',
    cwd: '${APP_DIR}',
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production' },
    max_memory_restart: '512M',
    time: true,
  }],
};
EOF
}

start_pm2() {
  log "7/8 PM2 start/restart"
  cd "$APP_DIR"
  write_ecosystem
  mkdir -p logs
  # Correr PM2 como el usuario dueño del dir si no es root-only
  pm2 delete "$APP_NAME" 2>/dev/null || true
  pm2 start ecosystem.config.cjs
  pm2 save
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
}

maybe_nginx() {
  if [[ "$INSTALL_NGINX" != "true" ]]; then
    return
  fi
  if [[ -z "$DOMAIN" ]]; then
    warn "DOMAIN vacío — nginx site no se configura (API queda en :${PORT})"
    return
  fi
  log "Nginx reverse proxy → $DOMAIN → 127.0.0.1:${PORT}"
  cat > "/etc/nginx/sites-available/${APP_NAME}" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    client_max_body_size 20M;
    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
  ln -sfn "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
  nginx -t && systemctl reload nginx
  warn "TLS: corré certbot --nginx -d ${DOMAIN} cuando el DNS apunte acá"
}

healthcheck() {
  log "8/8 Healthcheck"
  local url="http://127.0.0.1:${PORT}/health"
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS "$url" >/tmp/brabo-health.json 2>/dev/null; then
      log "OK $url → $(cat /tmp/brabo-health.json)"
      echo
      echo "---- Resumen ----"
      echo "APP_DIR=$APP_DIR"
      echo "PORT=$PORT"
      echo "DB_NAME=$DB_NAME  DB_USER=$DB_USER"
      echo "DOMAIN=${DOMAIN:-"(sin nginx host)"}"
      echo "Admin mock: admin / (ver ADMIN_PASSWORD en .env)"
      echo "Cambiá ADMIN_PASSWORD y JWT_SECRET en producción real."
      echo "Fenec Admin: registrar instancia después (otro workstream)."
      return 0
    fi
    sleep 2
  done
  warn "Healthcheck falló. Logs: pm2 logs $APP_NAME --lines 50"
  pm2 logs "$APP_NAME" --lines 40 --nostream || true
  exit 1
}

main() {
  need_root
  ensure_vars
  install_packages
  clone_or_update
  setup_database
  write_env
  build_app
  seed_db
  start_pm2
  maybe_nginx
  healthcheck
}

main "$@"
