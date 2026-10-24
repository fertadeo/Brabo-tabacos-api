# Setup de Funcionalidad de Barcode Lookup

## Dependencias Requeridas

Esta funcionalidad requiere las siguientes dependencias npm:

```bash
npm install axios
```

Opcional (para scraping futuro):
```bash
npm install cheerio
npm install --save-dev @types/cheerio
```

## Migración de Base de Datos

Ejecutar la migración SQL:

```bash
mysql -u root -p mfcomputers < docs/migrations/2026-02-19_create_barcode_lookup_cache.sql
```

O ejecutar manualmente el contenido del archivo en tu cliente MySQL.

## Variables de Entorno Opcionales

Para habilitar el provider de Discogs (música), agregar al `.env`:

```
DISCOGS_API_KEY=tu_api_key
DISCOGS_API_SECRET=tu_api_secret
```

Obtener credenciales en: https://www.discogs.com/settings/developers

## Endpoints Disponibles

### 1. Buscar por código de barras
```
GET /api/products/barcode/:code
Authorization: Bearer <token>
Roles: gerencia, ventas, logistica, finanzas
```

### 2. Aceptar datos y crear producto
```
POST /api/products/barcode/:code/accept
Authorization: Bearer <token>
Roles: gerencia
Body (opcional):
{
  "category_id": 5,
  "price": 1500.00,
  "stock": 0,
  "code": "PROD-001"
}
```

### 3. Modificar datos y crear producto
```
POST /api/products/barcode/:code/create
Authorization: Bearer <token>
Roles: gerencia
Body (requerido):
{
  "code": "PROD-001",
  "name": "Nombre del producto",
  "price": 1500.00,
  "description": "Descripción...",
  "category_id": 5,
  "stock": 0,
  "barcode": "1234567890123",
  "images": ["url1", "url2"]
}
```

### 4. Ignorar datos encontrados
```
POST /api/products/barcode/:code/ignore
Authorization: Bearer <token>
Roles: gerencia, ventas, logistica, finanzas
```

## Estructura de Archivos Creados

```
src/
├── services/
│   ├── product-resolver/
│   │   ├── index.ts                    # Resolver principal
│   │   ├── types.ts                     # Tipos e interfaces
│   │   └── providers/
│   │       ├── upc.provider.ts         # Provider UPCItemDB
│   │       ├── discogs.provider.ts     # Provider Discogs (música)
│   │       └── tienda.provider.ts       # Provider genérico (placeholder)
│   └── BarcodeLookupService.ts         # Servicio principal
├── repositories/
│   └── BarcodeLookupCacheRepository.ts # Repositorio de cache
└── controllers/
    └── productController.ts            # Métodos agregados

docs/
└── migrations/
    └── 2026-02-19_create_barcode_lookup_cache.sql
```

## Flujo de Uso

1. **Buscar código de barras:**
   - Cliente llama a `GET /api/products/barcode/:code`
   - Sistema busca en: products → cache → providers externos
   - Retorna datos con `available_actions`

2. **Usuario elige acción:**
   - **Aceptar:** `POST /api/products/barcode/:code/accept`
   - **Modificar:** `POST /api/products/barcode/:code/create` (con datos editados)
   - **Ignorar:** `POST /api/products/barcode/:code/ignore`

## Providers Implementados

### UPCItemDB
- ✅ Implementado
- Sin API key requerida (trial)
- Límite: ~100 requests/día en trial
- URL: https://www.upcitemdb.com/api

### Discogs
- ✅ Implementado (requiere API key)
- Especializado en música
- Requiere variables de entorno

### Tienda (Genérico)
- ⚠️ Placeholder
- Listo para implementar scraping de tiendas específicas
- NO usar para Google/Amazon

## Notas Importantes

- Los providers se ejecutan en paralelo usando `Promise.allSettled()`
- El primer resultado válido se retorna
- Los resultados se guardan en cache automáticamente
- No se realizan llamadas repetidas para el mismo código
- Validación de formato de código de barras antes de consultar providers
