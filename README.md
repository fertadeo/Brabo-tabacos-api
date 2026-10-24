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

export DB_PASSWORD='TU_PASSWORD_FUERTE'
export JWT_SECRET='TU_JWT_LARGO'
export CORS_ORIGIN='https://TU-FRONT'
export DOMAIN='api.tu-dominio.com'          # opcional → nginx
# export DB_DUMP=/ruta/dump-brabo-limpio.sql  # opcional: copia BD funcional
# Nunca uses la BD/host de prod MF Computers

sudo -E bash scripts/bootstrap-prod.sh
```

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

Copia funcional: pasá `DB_DUMP=/path/dump.sql` (export desde Gold/MF **limpio**, sin secretos de pago). Si no hay dump → schema + `npm run seed:brabo`.

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
