# Nginx + Certbot — Brabo en aurixerp.com

| Host | Destino |
| --- | --- |
| `https://api-brabo.aurixerp.com` | `127.0.0.1:8088` (API PM2) |
| `https://brabo.aurixerp.com` | `127.0.0.1:3088` (Next `next start`) |

## 1. DNS

Registros **A** (o CNAME) hacia la IP del VPS:

- `api-brabo.aurixerp.com`
- `brabo.aurixerp.com`

## 2. Sites HTTP + reload

```bash
cd /var/www/brabo-tabacos-api   # o ruta del clone
sudo cp deploy/nginx/api-brabo.aurixerp.com.conf /etc/nginx/sites-available/
sudo cp deploy/nginx/brabo.aurixerp.com.conf /etc/nginx/sites-available/
sudo ln -sfn /etc/nginx/sites-available/api-brabo.aurixerp.com.conf /etc/nginx/sites-enabled/
sudo ln -sfn /etc/nginx/sites-available/brabo.aurixerp.com.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 3. TLS

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api-brabo.aurixerp.com
sudo certbot --nginx -d brabo.aurixerp.com
```

## 4. Env

**API** (`/var/www/brabo-tabacos-api/.env`):

```
PORT=8088
CORS_ORIGIN=https://brabo.aurixerp.com
APP_NAME=Brabo Tabacos
```

```bash
sudo PM2_HOME=/root/.pm2 pm2 restart brabo-tabacos-api
curl -s https://api-brabo.aurixerp.com/health
```

**Front** (build / `.env.production` / Vercel o VPS):

```
NEXT_PUBLIC_API_URL=https://api-brabo.aurixerp.com/api/
NEXT_PUBLIC_APP_NAME=Brabo Tabacos
```

En VPS, proceso front típico:

```bash
cd /var/www/brabo-tabacos-nextjs   # cuando exista el clone
npm ci && npm run build
PORT=3088 pm2 start npm --name brabo-tabacos-nextjs -- start -- -H 127.0.0.1 -p 3088
# o: next start -H 127.0.0.1 -p 3088
```

Si el front aún no está en el VPS, el site `brabo.aurixerp.com` puede instalarse igual; devolverá 502 hasta que escuche `:3088`.
