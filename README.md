# Brabo Tabacos — API

Instancia fork desde `mfcomputers-API` (GOLD retail). **No** multi-tenant Aurix / Fenec Admin.

## Stack

Node.js + Express + TypeScript + MySQL/MariaDB. Puerto default `8086`.

## Producción Ubuntu (un solo comando)

En el VPS (Ubuntu 20.04+), con sudo:

```bash
# Clonar (o usar el repo ya presente)
sudo mkdir -p /var/www && sudo git clone https://github.com/fertadeo/Brabo-tabacos-api.git /var/www/brabo-tabacos-api
cd /var/www/brabo-tabacos-api

# Todas las vars en la MISMA invocación (sudo no hereda exports previos sin -E,
# y RECREATE_DB=true en una línea sola no llega al script):
sudo -E env \
  DB_PASSWORD='TU_PASSWORD_FUERTE' \
  JWT_SECRET='TU_JWT_LARGO' \
  CORS_ORIGIN='https://TU-FRONT' \
  DOMAIN='api.tu-dominio.com' \
  RECREATE_DB=true \
  bash scripts/bootstrap-prod.sh
```

`tsconfig` → `outDir=dist` + `rootDir=src` ⇒ entry **`dist/index.js`** (PM2/`npm start`). El bootstrap hace `npm ci --include=dev` para que `tsc` exista aunque el shell tenga `NODE_ENV=production`.

El script es **idempotente**: deps (Node 20, MariaDB, PM2, nginx opcional), clona/actualiza repo, crea BD **`brabo_tabacos`** nueva, importa `db/schema.sql` + seed (o `DB_DUMP`), escribe `.env`, `npm ci` + build, PM2, healthcheck `GET /health`.

### Variables útiles

| Variable | Default | Nota |
| --- | --- | --- |
| `APP_DIR` | `/var/www/brabo-tabacos-api` | |
| `GIT_URL` | este repo | |
| `GIT_BRANCH` | `main` | |
| `PORT` | `8086` | |
| `DOMAIN` | vacío | si se setea, configura nginx :80 |
| `DB_NAME` | `brabo_tabacos` | rechaza nombres tipo `mfcomputers` |
| `DB_USER` / `DB_PASSWORD` | `brabo` / (generado) | |
| `DB_DUMP` | vacío | restore de copia funcional limpia |
| `CORS_ORIGIN` | localhost | URL del front |
| `INSTALL_NGINX` | `true` | |
| `FORCE_ENV` | `false` | `true` regenera `.env` |
| `SKIP_DB_SEED` | `false` | |
| `RECREATE_DB` | `false` | `true` hace `DROP DATABASE` Brabo y reimporta (útil tras fallo parcial) |

Copia funcional: pasá `DB_DUMP=/path/dump.sql` (export desde Gold/MF **limpio**, sin secretos de pago). Si no hay dump → schema + `npm run seed:brabo`.

### ERROR 1419 (triggers + binlog)

Si el import falla con `ERROR 1419 ... log_bin_trust_function_creators`, el script intenta `SET GLOBAL log_bin_trust_function_creators = 1` como root. Si la BD quedó a medias:

```bash
# opcional manual:
sudo mysql -e "SET GLOBAL log_bin_trust_function_creators = 1;"
# RECREATE_DB tiene que viajar con sudo -E (misma línea / env):
sudo -E env RECREATE_DB=true DB_PASSWORD='...' JWT_SECRET='...' CORS_ORIGIN='...' \
  bash scripts/bootstrap-prod.sh
```

### PM2: Cannot find module `dist/index.js`

Causa típica: `npm ci` sin devDeps (TypeScript) → no hay `dist/`. El bootstrap actual falla antes de PM2 si falta el entry. Fix manual:

```bash
cd /var/www/brabo-tabacos-api
sudo git pull
sudo npm ci --include=dev && sudo npm run build
test -f dist/index.js && sudo pm2 restart brabo-tabacos-api
```

## Levantar local

```bash
cp .env.example .env
mysql -e "CREATE DATABASE IF NOT EXISTS brabo_tabacos CHARACTER SET utf8mb4;"
mysql brabo_tabacos < db/schema.sql
npm install && npm run seed:brabo && npm run dev
```

API: `http://127.0.0.1:8086/api/`

Credenciales mock: `admin` / `CambiarYa123!` — cambiar en prod.

- `FEATURE_REPARACIONES=false` — no monta `/api/repair-orders`

## Front pareja

https://github.com/fertadeo/Brabo-tabacos-nextjs

## Origen Gold

https://github.com/fertadeo/mfcomputers-API — no pushear custom Brabo ahí.

## Pendiente

- Host/SSH del VPS (Fernando) para ejecutar el bootstrap remoto
- TLS (certbot), logos, reglas IVA tabaco
- Registrar instancia en Fenec Admin después
