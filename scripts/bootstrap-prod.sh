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
# Regla producto Fenec: cada cliente = PORT distinto. No usar 8086 (MF) ni 8087 (HGroup). Brabo=8088.
PORT="${PORT:-8088}"
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
# Si la BD quedó a medias (p.ej. falló en triggers ERROR 1419): RECREATE_DB=true dropea y reimporta.
RECREATE_DB="${RECREATE_DB:-false}"
# Umbral: menos de N tablas = "vacía/parcial leve" → importar; entre N y COMPLETE = parcial → pedir RECREATE_DB
DB_TABLES_MIN_OK="${DB_TABLES_MIN_OK:-40}"

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
  # sudo -E a veces preserva HOME del usuario (fenecstudio) → PM2 cae en ~/.pm2 de ese user.
  # Brabo debe vivir en el PM2 de root: sudo pm2 list
  export HOME=/root
  export PM2_HOME=/root/.pm2
}

# Siempre el PM2 de root (daemon + dump en /root/.pm2)
pm2_root() {
  env HOME=/root PM2_HOME=/root/.pm2 pm2 "$@"
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

assert_safe_port() {
  # Inventario VPS Fenec (no reutilizar):
  # 8080 stock | 8081 cortinova | 8086 MF | 8087 HGroup | 8088 Brabo
  case "$PORT" in
    8080|8081|8086|8087)
      die "PORT=$PORT está reservado (stock/cortinova/MF/HGroup). Brabo default 8088. Regla: cada cliente = un PORT distinto."
      ;;
  esac
}

ensure_vars() {
  assert_safe_db
  assert_safe_port
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
    log "Instalando PM2 global (root)"
    npm install -g pm2
  fi
  # Asegurar que el daemon no quede atado al HOME de fenecstudio
  export HOME=/root
  export PM2_HOME=/root/.pm2
  mkdir -p /root/.pm2
  log "PM2_HOME=$PM2_HOME (listar con: sudo pm2 list)"
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

# schema.sql crea TRIGGERS → con binlog activo hace falta SUPER o log_bin_trust_function_creators=1
# (ERROR 1419 HY000). Preferimos SET GLOBAL como root; si falla, mensaje claro.
enable_trigger_creators() {
  log "Habilitando log_bin_trust_function_creators (triggers del schema)"
  if mysql_root -e "SET GLOBAL log_bin_trust_function_creators = 1;"; then
    log "log_bin_trust_function_creators=1 OK"
    return 0
  fi
  warn "No se pudo SET GLOBAL log_bin_trust_function_creators (¿sin SUPER?)."
  warn "En el VPS como root MySQL: SET GLOBAL log_bin_trust_function_creators = 1;"
  warn "O en my.cnf: [mysqld] log_bin_trust_function_creators=1  → reiniciar MariaDB/MySQL."
  return 1
}

db_table_count() {
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -N -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null || echo 0
}

import_sql_file() {
  local file="$1"
  [[ -f "$file" ]] || die "No existe SQL: $file"
  # Import como root → evita faltantes de TRIGGER privilege en el user app
  # (el app user sigue siendo DB_USER para la API).
  enable_trigger_creators || warn "Continuando import; si falla ERROR 1419, aplicá el SET GLOBAL a mano y reintentá con RECREATE_DB=true"
  local errf="/tmp/brabo-sql-import.err"
  : >"$errf"
  # shellcheck disable=SC2094
  if ! sed -E \
    -e 's/USE[[:space:]]+`?mfcomputers`?/USE `'"${DB_NAME}"'`/Ig' \
    -e 's/USE[[:space:]]+`?brabo_tabacos`?/USE `'"${DB_NAME}"'`/Ig' \
    -e 's/USE[[:space:]]+`[^`]+`/USE `'"${DB_NAME}"'`/Ig' \
    "$file" | mysql_root "$DB_NAME" 2>"$errf"; then
    cat "$errf" >&2 || true
  fi
  if grep -Eqi 'ERROR 1419|log_bin_trust_function_creators' "$errf" 2>/dev/null; then
    die "Import falló con ERROR 1419 (triggers/binlog). Como root MySQL: SET GLOBAL log_bin_trust_function_creators = 1; luego: RECREATE_DB=true sudo -E bash scripts/bootstrap-prod.sh"
  fi
  if grep -Eq '^ERROR ' "$errf" 2>/dev/null; then
    warn "Hubo errores SQL durante el import — revisá $errf"
    cat "$errf" >&2 || true
    if [[ "$(db_table_count)" -lt 5 ]]; then
      die "BD quedó casi vacía tras import. Revisá errores y reintentá con RECREATE_DB=true."
    fi
  fi
}

setup_database() {
  log "3/8 Base de datos $DB_NAME (nueva, no MF)"
  assert_safe_db

  if [[ "$RECREATE_DB" == "true" ]]; then
    log "RECREATE_DB=true → DROP DATABASE \`${DB_NAME}\` (solo Brabo; nunca MF)"
    assert_safe_db
    mysql_root -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`;"
  fi

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

  # Asegurar flag binlog antes de cualquier CREATE TRIGGER
  enable_trigger_creators || true

  local table_count
  table_count="$(db_table_count)"
  table_count="${table_count//[^0-9]/}"
  table_count="${table_count:-0}"

  if [[ -n "$DB_DUMP" ]]; then
    [[ -f "$DB_DUMP" ]] || die "DB_DUMP no existe: $DB_DUMP"
    if [[ "$table_count" -ge 5 && "$RECREATE_DB" != "true" ]]; then
      die "BD '${DB_NAME}' ya tiene ${table_count} tablas y pasaste DB_DUMP. Usá RECREATE_DB=true para reemplazar, o quitá DB_DUMP."
    fi
    log "Restaurando dump funcional → $DB_NAME (desde $DB_DUMP)"
    import_sql_file "$DB_DUMP"
  elif [[ "$table_count" -eq 0 ]]; then
    log "Importando db/schema.sql (BD vacía)"
    [[ -f db/schema.sql ]] || die "Falta db/schema.sql"
    import_sql_file db/schema.sql
  elif [[ "$table_count" -lt 5 ]]; then
    log "BD parcial (${table_count} tablas) — reimportando schema"
    [[ -f db/schema.sql ]] || die "Falta db/schema.sql"
    import_sql_file db/schema.sql
  elif [[ "$table_count" -lt "$DB_TABLES_MIN_OK" ]]; then
    die "BD '${DB_NAME}' parece incompleta (${table_count} tablas < ${DB_TABLES_MIN_OK}). Suele pasar tras ERROR 1419 a mitad del schema. Reintentá: RECREATE_DB=true sudo -E bash scripts/bootstrap-prod.sh"
  else
    log "BD ya tiene ${table_count} tablas — no reimporta schema (idempotente). RECREATE_DB=true para forzar."
  fi

  # Migraciones incrementales (best-effort)
  if [[ -d migrations ]]; then
    log "Aplicando migrations/*.sql (best-effort)"
    for f in migrations/*.sql; do
      [[ -f "$f" ]] || continue
      mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$f" \
        && log "  ok $(basename "$f")" \
        || warn "  skip/error $(basename "$f") (puede estar aplicada)"
    done
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

# Tras tsc: con rootDir=src → dist/index.js; sin rootDir a veces dist/src/index.js
resolve_entry_js() {
  cd "$APP_DIR"
  if [[ -f dist/index.js ]]; then
    ENTRY_JS="dist/index.js"
  elif [[ -f dist/src/index.js ]]; then
    ENTRY_JS="dist/src/index.js"
  else
    ENTRY_JS=""
  fi
}

build_app() {
  log "5/8 npm ci + build"
  cd "$APP_DIR"
  # Si el shell trae NODE_ENV=production, npm ci omite typescript/rimraf (devDependencies)
  # y el build no genera dist/ → PM2: Cannot find module .../dist/index.js
  log "Instalando deps (incluye devDependencies para tsc)"
  if [[ -f package-lock.json ]]; then
    npm ci --include=dev
  else
    npm install --include=dev
  fi
  command -v npx >/dev/null || die "npx no disponible"
  if ! npx --no-install tsc --version >/dev/null 2>&1 && ! [[ -x node_modules/.bin/tsc ]]; then
    die "TypeScript no quedó instalado tras npm ci --include=dev. Abortando antes de PM2."
  fi
  npm run build
  resolve_entry_js
  if [[ -z "$ENTRY_JS" ]]; then
    warn "Contenido de dist/ tras build:"
    find dist -type f -name '*.js' 2>/dev/null | head -40 || true
    die "Build OK aparente pero no hay dist/index.js ni dist/src/index.js. No se arranca PM2."
  fi
  log "Entry JS: $APP_DIR/$ENTRY_JS"
  # Alinear package.json start/main sin editar a mano en VPS
  if [[ "$ENTRY_JS" != "dist/index.js" ]]; then
    warn "Entry no estándar ($ENTRY_JS) — ecosystem usará esa ruta"
  fi
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
  resolve_entry_js
  [[ -n "$ENTRY_JS" ]] || die "write_ecosystem: falta entry JS (corriste build_app?)"
  [[ -f "$APP_DIR/$ENTRY_JS" ]] || die "write_ecosystem: no existe $APP_DIR/$ENTRY_JS"
  cat > "$APP_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [{
    name: '${APP_NAME}',
    script: '${ENTRY_JS}',
    cwd: '${APP_DIR}',
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production' },
    max_memory_restart: '512M',
    time: true,
  }],
};
EOF
  log "ecosystem.config.cjs → script=${ENTRY_JS}"
}

start_pm2() {
  log "7/8 PM2 start/restart (root / PM2_HOME=/root/.pm2)"
  cd "$APP_DIR"
  export HOME=/root
  export PM2_HOME=/root/.pm2
  mkdir -p /root/.pm2
  resolve_entry_js
  [[ -n "$ENTRY_JS" && -f "$ENTRY_JS" ]] || die "Antes de PM2 debe existir el entry (dist/index.js). Rebuild falló o incompleto."
  write_ecosystem
  mkdir -p logs
  # Si quedó registrado en el PM2 de fenecstudio, no lo tocamos acá; arrancamos en root.
  pm2_root delete "$APP_NAME" 2>/dev/null || true
  pm2_root start ecosystem.config.cjs
  sleep 2
  if pm2_root jlist 2>/dev/null | grep -q "\"name\":\"${APP_NAME}\"" && pm2_root jlist 2>/dev/null | grep -q '"status":"errored"'; then
    pm2_root logs "$APP_NAME" --lines 30 --nostream || true
    die "PM2 (root) quedó errored. Revisá que exista $APP_DIR/$ENTRY_JS"
  fi
  pm2_root save
  pm2_root startup systemd -u root --hp /root >/dev/null 2>&1 || true
  log "Verificar: sudo pm2 list   (no uses pm2 list como fenecstudio)"
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
      echo "PM2: sudo pm2 list   (root; no fenecstudio)"
      return 0
    fi
    sleep 2
  done
  warn "Healthcheck falló. Logs: sudo pm2 logs $APP_NAME --lines 50"
  env HOME=/root PM2_HOME=/root/.pm2 pm2 logs "$APP_NAME" --lines 40 --nostream || true
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
