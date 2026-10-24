# Brabo Tabacos — API

Instancia fork desde `mfcomputers-API` (GOLD retail). **No** multi-tenant Aurix / Fenec Admin.

## Stack

Node.js + Express + TypeScript + MySQL. Puerto default `8086`.

## Levantar local

```bash
cp .env.example .env
# crear BD vacía
mysql -e "CREATE DATABASE IF NOT EXISTS brabo_tabacos CHARACTER SET utf8mb4;"
mysql brabo_tabacos < db/schema.sql
# migraciones incrementales (si aplica)
# for f in migrations/*.sql; do mysql brabo_tabacos < "$f"; done

npm install
npm run init:admin   # o npm run seed:brabo
npm run dev
```

API: `http://127.0.0.1:8086/api/`

### Credenciales mock (local)

- user: `admin` / email `admin@brabotabacos.local`
- pass: `CambiarYa123!` (cambiar en cuanto haya entorno real)

### Feature flags

- `FEATURE_REPARACIONES=false` — no monta `/api/repair-orders`

## Front pareja

https://github.com/fertadeo/Brabo-tabacos-nextjs  
`NEXT_PUBLIC_API_URL=http://localhost:8086/api/`

## Origen Gold

https://github.com/fertadeo/mfcomputers-API — no pushear cambios de cliente a ese main.

## Pendiente

- Reglas de negocio finas (IVA tabaco, precios)
- Logos / dominio / VPS / secretos prod
- Registrar instancia en Fenec Admin después
