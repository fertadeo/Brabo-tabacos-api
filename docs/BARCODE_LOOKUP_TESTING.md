# Guía de Pruebas - Barcode Lookup API

## ✅ Checklist Pre-Prueba

- [x] Dependencias instaladas (`axios`, `cheerio`)
- [x] Tabla `barcode_lookup_cache` creada
- [x] Índice en `products.barcode` creado (opcional pero recomendado)
- [ ] Código compilado (`npm run build` o `npm run dev`)

## 🚀 Pasos para Probar

### 1. Compilar el código (si usas producción)

```bash
npm run build
```

O simplemente ejecuta en modo desarrollo:
```bash
npm run dev
```

### 2. Ejecutar migración del índice (si aún no lo hiciste)

```bash
mysql -u root -p mfcomputers < docs/migrations/2026-02-19_add_barcode_index_to_products.sql
```

### 3. Obtener Token JWT

Primero necesitas autenticarte para obtener un token:

```bash
POST http://localhost:8083/api/auth/login
Content-Type: application/json

{
  "username": "tu_usuario",
  "password": "tu_password"
}
```

Guarda el `token` de la respuesta.

### 4. Probar Endpoints

#### 🔍 Buscar por Código de Barras

```bash
GET http://localhost:8083/api/products/barcode/1234567890123
Authorization: Bearer <tu_token>
```

**Ejemplo con curl:**
```bash
curl -X GET "http://localhost:8083/api/products/barcode/1234567890123" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -H "Content-Type: application/json"
```

**Códigos de prueba comunes:**
- `0794000000000` - Producto de prueba UPCItemDB
- `075678164125` - Otro código de prueba
- `1234567890123` - Código genérico (puede no encontrar resultados)

**Respuesta esperada (si encuentra datos):**
```json
{
  "success": true,
  "message": "Datos encontrados exitosamente",
  "data": {
    "title": "Nombre del Producto",
    "description": "Descripción del producto",
    "brand": "Marca",
    "images": ["url1", "url2"],
    "source": "upcitemdb",
    "suggested_price": 1500.00,
    "category_suggestion": "Categoría",
    "exists_as_product": false,
    "preview_message": "Hemos encontrado: Nombre del Producto",
    "available_actions": {
      "accept": true,
      "modify": true,
      "ignore": true
    },
    "provider_response_time": 1200
  },
  "timestamp": "2026-02-19T10:30:05Z"
}
```

**Respuesta si no encuentra:**
```json
{
  "success": false,
  "message": "No se encontraron datos para este código de barras",
  "timestamp": "2026-02-19T10:30:05Z"
}
```

#### ✅ Aceptar Datos y Crear Producto

```bash
POST http://localhost:8083/api/products/barcode/1234567890123/accept
Authorization: Bearer <tu_token>
Content-Type: application/json

{
  "category_id": 5,
  "price": 1500.00,
  "stock": 10,
  "code": "PROD-001"
}
```

**Ejemplo con curl:**
```bash
curl -X POST "http://localhost:8083/api/products/barcode/1234567890123/accept" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": 5,
    "price": 1500.00,
    "stock": 10,
    "code": "PROD-001"
  }'
```

#### ✏️ Modificar y Crear Producto

```bash
POST http://localhost:8083/api/products/barcode/1234567890123/create
Authorization: Bearer <tu_token>
Content-Type: application/json

{
  "code": "PROD-001",
  "name": "Nombre Modificado del Producto",
  "description": "Descripción editada",
  "price": 1500.00,
  "stock": 10,
  "category_id": 5,
  "barcode": "1234567890123",
  "images": ["url1", "url2"]
}
```

#### 🚫 Ignorar Datos

```bash
POST http://localhost:8083/api/products/barcode/1234567890123/ignore
Authorization: Bearer <tu_token>
```

## 🧪 Casos de Prueba

### Caso 1: Producto ya existe en la base de datos
1. Crear un producto manualmente con barcode `1234567890123`
2. Buscar: `GET /api/products/barcode/1234567890123`
3. **Esperado:** `exists_as_product: true`, `product_id` presente

### Caso 2: Búsqueda en cache
1. Buscar un código por primera vez (se guarda en cache)
2. Buscar el mismo código nuevamente
3. **Esperado:** Respuesta rápida desde cache, `cached_at` presente

### Caso 3: Búsqueda en providers externos
1. Buscar un código que no existe en products ni cache
2. **Esperado:** Consulta a UPCItemDB, respuesta con datos si encuentra

### Caso 4: Código inválido
1. Buscar: `GET /api/products/barcode/abc123`
2. **Esperado:** Error 400, mensaje "Formato de código de barras inválido"

### Caso 5: Aceptar datos
1. Buscar un código y obtener datos
2. Aceptar: `POST /api/products/barcode/XXX/accept`
3. **Esperado:** Producto creado exitosamente

### Caso 6: Ignorar datos
1. Buscar un código y obtener datos
2. Ignorar: `POST /api/products/barcode/XXX/ignore`
3. **Esperado:** Confirmación de éxito
4. Buscar nuevamente el mismo código
5. **Esperado:** Datos aún disponibles (el flag ignored es para tracking)

## 🔍 Verificar en Base de Datos

### Ver cache creado:
```sql
SELECT * FROM barcode_lookup_cache ORDER BY created_at DESC LIMIT 10;
```

### Ver productos creados:
```sql
SELECT id, code, name, barcode FROM products WHERE barcode IS NOT NULL ORDER BY created_at DESC LIMIT 10;
```

### Ver estadísticas de uso:
```sql
SELECT 
  source,
  COUNT(*) as total,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits
FROM barcode_lookup_cache
GROUP BY source;
```

## ⚠️ Troubleshooting

### Error: "Formato de código de barras inválido"
- Verifica que el código tenga entre 8-14 dígitos numéricos
- No debe contener letras ni caracteres especiales (excepto guiones/espacios que se limpian)

### Error: "No se encontraron datos"
- Es normal si el código no está en ninguna base de datos
- Prueba con códigos conocidos de productos reales
- Verifica que UPCItemDB esté accesible (puede tener rate limits)

### Error: "El código del producto ya existe"
- El código interno (`code`) ya existe en la tabla products
- Usa un código diferente o verifica productos existentes

### Los providers no responden
- Verifica conexión a internet
- UPCItemDB tiene límites en versión trial (~100 requests/día)
- Revisa logs del servidor para ver errores específicos

## 📊 Monitoreo

Revisa los logs del servidor para ver:
- Qué provider encontró el producto
- Tiempo de respuesta
- Errores de providers (se manejan silenciosamente)

Los logs mostrarán mensajes como:
```
[ProductService] INFO: Producto resuelto por upcitemdb en 1200ms
[ProductService] WARN: Error en discogsProvider para barcode XXX: ...
```
