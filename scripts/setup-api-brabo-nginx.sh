#!/usr/bin/env bash
# Nginx + Certbot + CORS para https://api-brabo.aurixerp.com → :8088
# Uso en el VPS:
#   cd ~/Brabo-tabacos-api   # o /var/www/brabo-tabacos-api
#   bash scripts/setup-api-brabo-nginx.sh
set -euo pipefail

DOMAIN="api-brabo.aurixerp.com"
CORS="https://brabo.aurixerp.com"
PORT="${PORT:-8088}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONF_SRC="${APP_DIR}/deploy/nginx/api-brabo.aurixerp.com.conf"
CONF_DST="/etc/nginx/sites-available/api-brabo.aurixerp.com.conf"
ENV_FILE="${APP_DIR}/.env"

die() { echo "ERROR: $*" >&2; exit 1; }
log() { echo "==> $*"; }

[[ -f "$CONF_SRC" ]] || die "No está $CONF_SRC (¿estás en el clone correcto?)"
[[ -f "$ENV_FILE" ]] || die "No está $ENV_FILE"

log "API local :${PORT}"
curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null \
  || die "PM2 no responde en 127.0.0.1:${PORT}/health. Revisá: sudo PM2_HOME=/root/.pm2 pm2 list"

log "Instalar nginx site"
sudo cp "$CONF_SRC" "$CONF_DST"
sudo ln -sfn "$CONF_DST" /etc/nginx/sites-enabled/api-brabo.aurixerp.com.conf
# El front vive en Vercel; no habilitar brabo.aurixerp.com en este VPS.
sudo nginx -t
sudo systemctl reload nginx

log "Certbot TLS (${DOMAIN})"
if ! command -v certbot >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y certbot python3-certbot-nginx
fi
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect \
  || sudo certbot --nginx -d "$DOMAIN" --agree-tos --redirect

log "CORS_ORIGIN=${CORS} en .env"
if grep -q '^CORS_ORIGIN=' "$ENV_FILE"; then
  sudo sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${CORS}|" "$ENV_FILE"
else
  echo "CORS_ORIGIN=${CORS}" | sudo tee -a "$ENV_FILE" >/dev/null
fi
# Asegurar PORT
if grep -q '^PORT=' "$ENV_FILE"; then
  sudo sed -i "s|^PORT=.*|PORT=${PORT}|" "$ENV_FILE"
else
  echo "PORT=${PORT}" | sudo tee -a "$ENV_FILE" >/dev/null
fi

log "Restart PM2 brabo-tabacos-api"
sudo PM2_HOME=/root/.pm2 pm2 restart brabo-tabacos-api --update-env
sudo PM2_HOME=/root/.pm2 pm2 save

sleep 2
log "Smoke local"
curl -sS "http://127.0.0.1:${PORT}/health" || true
echo
log "Smoke público HTTPS"
curl -sS "https://${DOMAIN}/health" || true
echo
log "Listo. Front (Vercel) debe usar NEXT_PUBLIC_API_URL=https://${DOMAIN}/api/"
