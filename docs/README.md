# MfComputers ERP API

API backend para el sistema ERP de MF Computers desarrollado con Node.js y TypeScript.

## Características

- **Framework**: Express.js con TypeScript
- **Base de datos**: MySQL con conexión por pool
- **Puerto**: 8083
- **Autenticación**: JWT
- **Validación**: Joi + Express Validator
- **Seguridad**: Helmet + CORS

## Módulos del ERP

- 📊 **Dashboard** - Estadísticas y resumen general
- 📦 **Stock** - Gestión de inventario y productos
- 👥 **Clientes** - Administración de clientes
- 💰 **Caja** - Control de caja y finanzas
- 🏭 **Producción** - Órdenes de producción
- 👨‍💼 **Personal** - Gestión de empleados
- 🛒 **Compras** - Gestión de compras y proveedores
- 📋 **Pedidos** - Administración de pedidos
- 💼 **Presupuestos** - Creación y gestión de presupuestos
- 🏪 **Tienda** - Gestión de tienda
- 🧾 **Facturación** - Sistema de facturación

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

3. Configurar base de datos MySQL:
```bash
# Ejecutar el script SQL en src/database/schema.sql
mysql -u root -p < src/database/schema.sql
```

4. Compilar TypeScript:
```bash
npm run build
```

5. Iniciar servidor:
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## Endpoints

- `GET /health` - Health check del servidor
- `GET /api` - Información de la API
- `GET /api/dashboard/stats` - Estadísticas del dashboard
- `GET /api/dashboard/activities` - Actividades recientes
- `POST /api/sales/:id/facturar` - Emisión manual de comprobante ARCA para una venta existente

## Estructura del proyecto

```
src/
├── config/          # Configuraciones (database, etc.)
├── controllers/     # Controladores de rutas
├── middleware/      # Middleware personalizado
├── routes/          # Definición de rutas
├── types/          # Tipos TypeScript
├── database/       # Scripts SQL
└── index.ts        # Punto de entrada
```

## Variables de entorno

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=mfcomputers

# Server
PORT=8083
NODE_ENV=development

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=http://localhost:3000

# Facturador ARCA (integración servidor a servidor)
FACTURADOR_BASE_URL=https://api-facturador.fenecstudio.com
FACTURADOR_API_KEY=mck_xxxxxxxxxxxxx
FACTURADOR_TIMEOUT_MS=15000
FACTURADOR_CUIT_EMISOR=20123456789
FACTURADOR_PUNTO_VENTA=1
# Opcional (solo dev/transición): permite cabecera x-facturador-api-key para ciertos roles JWT
# FACTURADOR_ALLOW_CLIENT_API_KEY=false
```

Contrato detallado con frontend: [docs/facturacion.md](facturacion.md).  
Notas de crédito (frontend): [docs/nota-credito-frontend.md](nota-credito-frontend.md).

## Facturación ARCA manual

Endpoint: `POST /api/sales/:id/facturar`

Headers:
- `Authorization: Bearer <jwt>` o `x-api-key: <api_key_local>`
- Opcional: `x-facturador-api-key` — solo si `FACTURADOR_ALLOW_CLIENT_API_KEY=true` y el usuario JWT tiene rol admin, gerencia o finanzas (ver [docs/facturacion.md](facturacion.md))

Body (ejemplo mínimo):

```json
{
  "tipo": 11,
  "condicionIvaReceptor": 5,
  "concepto": 1
}
```

Notas:
- `cuitEmisor` y `puntoVenta` pueden enviarse en body o resolverse desde `FACTURADOR_CUIT_EMISOR` y `FACTURADOR_PUNTO_VENTA`.
- Si la venta ya está facturada, la API bloquea una nueva emisión salvo que se envíe `"force": true`.
- El resultado se persiste en `sales` (estado ARCA, CAE, errores y payload/respuesta JSON).
