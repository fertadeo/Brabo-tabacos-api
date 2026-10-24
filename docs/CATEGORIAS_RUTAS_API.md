# 📚 Rutas API para Gestión de Categorías

## 🔐 Autenticación

Todas las rutas requieren autenticación mediante API Key en el header:

```
X-API-Key: tu-api-key
```

---

## 📋 Rutas Disponibles

### 1. Crear Categoría y Enviar a WooCommerce

**Endpoint:** `POST /api/categories`

**Descripción:** Crea una nueva categoría en el ERP y automáticamente la sincroniza con WooCommerce (si WooCommerce está configurado).

**Request Body:**
```json
{
  "name": "Laptops Gaming",
  "description": "Categoría de laptops para gaming",
  "parent_id": null
}
```

**Campos:**
- `name` (requerido): Nombre de la categoría
- `description` (opcional): Descripción de la categoría
- `parent_id` (opcional): ID de la categoría padre (null si es categoría raíz)
- `woocommerce_id` (opcional): Solo si la categoría viene de WooCommerce
- `woocommerce_slug` (opcional): Solo si la categoría viene de WooCommerce

**Ejemplo con cURL:**
```bash
curl -X POST https://api.sistema.mfcomputers.com.ar/api/categories \
  -H "X-API-Key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laptops Gaming",
    "description": "Categoría de laptops para gaming",
    "parent_id": null
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Categoría creada exitosamente y sincronizada a WooCommerce (ID: 15)",
  "data": {
    "category": {
      "id": 1,
      "name": "Laptops Gaming",
      "description": "Categoría de laptops para gaming",
      "is_active": true,
      "woocommerce_id": 15,
      "woocommerce_slug": "laptops-gaming",
      "parent_id": null,
      "created_at": "2024-01-20T10:00:00.000Z",
      "updated_at": "2024-01-20T10:00:00.000Z"
    }
  },
  "timestamp": "2024-01-20T10:00:00.000Z"
}
```

**Notas:**
- Si WooCommerce está configurado, la categoría se crea automáticamente en WooCommerce
- El `woocommerce_id` y `woocommerce_slug` se asignan automáticamente
- Si no se proporciona `parent_id`, se asume que es una categoría raíz

---

### 2. Editar Categoría y Sincronizar con WooCommerce

**Endpoint:** `PUT /api/categories/:id`

**Descripción:** Actualiza una categoría existente en el ERP y automáticamente sincroniza los cambios con WooCommerce (si la categoría tiene `woocommerce_id`).

**Request Body:**
```json
{
  "name": "Laptops Gaming Pro",
  "description": "Categoría actualizada de laptops para gaming profesional",
  "parent_id": null
}
```

**Campos (todos opcionales):**
- `name`: Nuevo nombre de la categoría
- `description`: Nueva descripción
- `parent_id`: ID de la nueva categoría padre (null para categoría raíz)
- `is_active`: true/false para activar/desactivar
- `woocommerce_id`: Solo modificar si es necesario
- `woocommerce_slug`: Solo modificar si es necesario

**Ejemplo con cURL:**
```bash
curl -X PUT https://api.sistema.mfcomputers.com.ar/api/categories/1 \
  -H "X-API-Key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laptops Gaming Pro",
    "description": "Categoría actualizada de laptops para gaming profesional"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Categoría actualizada exitosamente y sincronizada a WooCommerce",
  "data": {
    "category": {
      "id": 1,
      "name": "Laptops Gaming Pro",
      "description": "Categoría actualizada de laptops para gaming profesional",
      "is_active": true,
      "woocommerce_id": 15,
      "woocommerce_slug": "laptops-gaming-pro",
      "parent_id": null,
      "created_at": "2024-01-20T10:00:00.000Z",
      "updated_at": "2024-01-20T11:00:00.000Z"
    }
  },
  "timestamp": "2024-01-20T11:00:00.000Z"
}
```

**Notas:**
- Solo se sincroniza con WooCommerce si la categoría tiene `woocommerce_id`
- Si cambias `parent_id`, el sistema resuelve automáticamente el `woocommerce_id` del padre
- Si estableces `is_active: false`, la categoría se elimina de WooCommerce automáticamente

---

### 3. Eliminar Categoría (Soft Delete)

**Endpoint:** `DELETE /api/categories/:id`

**Descripción:** Elimina una categoría de WooCommerce (si tiene `woocommerce_id`) y la marca como inactiva (`is_active = 0`) en el ERP.

**Ejemplo con cURL:**
```bash
curl -X DELETE https://api.sistema.mfcomputers.com.ar/api/categories/1 \
  -H "X-API-Key: tu-api-key"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Categoría eliminada exitosamente",
  "data": {
    "id": 1,
    "name": "Laptops Gaming Pro",
    "woocommerce_id": null
  },
  "timestamp": "2024-01-20T12:00:00.000Z"
}
```

**Proceso:**
1. Si la categoría tiene `woocommerce_id`, se elimina primero de WooCommerce
2. Se marca como inactiva en el ERP (`is_active = false`)
3. Se limpian los campos `woocommerce_id` y `woocommerce_slug`

**Notas:**
- Es un "soft delete" (no se elimina físicamente de la base de datos)
- Los productos que tenían esta categoría mantienen el `category_id` pero la categoría está inactiva
- Si falla la eliminación en WooCommerce, se continúa con la desactivación en el ERP

---

### 4. Desactivar Categoría (Alternativa a DELETE)

**Endpoint:** `PUT /api/categories/:id`

**Descripción:** Alternativa al DELETE que también elimina de WooCommerce y desactiva en el ERP.

**Request Body:**
```json
{
  "is_active": false
}
```

**Ejemplo con cURL:**
```bash
curl -X PUT https://api.sistema.mfcomputers.com.ar/api/categories/1 \
  -H "X-API-Key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Categoría actualizada exitosamente",
  "data": {
    "category": {
      "id": 1,
      "name": "Laptops Gaming Pro",
      "is_active": false,
      "woocommerce_id": null,
      "woocommerce_slug": null
    }
  },
  "timestamp": "2024-01-20T12:00:00.000Z"
}
```

**Notas:**
- Mismo comportamiento que DELETE pero usando PUT
- Útil si quieres desactivar sin eliminar completamente

---

## 🔄 Flujo de Sincronización

### Al Crear:
```
POST /api/categories
    ↓
Crea en ERP
    ↓
Crea en WooCommerce (si configurado)
    ↓
Actualiza ERP con woocommerce_id
    ↓
Response con categoría completa
```

### Al Editar:
```
PUT /api/categories/:id
    ↓
Actualiza en ERP
    ↓
Actualiza en WooCommerce (si tiene woocommerce_id)
    ↓
Response con categoría actualizada
```

### Al Eliminar:
```
DELETE /api/categories/:id
    ↓
Elimina de WooCommerce (si tiene woocommerce_id)
    ↓
Marca como is_active = false en ERP
    ↓
Limpia woocommerce_id y woocommerce_slug
    ↓
Response con confirmación
```

---

## ⚠️ Códigos de Error

### 400 Bad Request
- Validación fallida (campos requeridos faltantes o formato incorrecto)

### 401 Unauthorized
- API Key no proporcionada o inválida

### 404 Not Found
- Categoría no encontrada (en GET, PUT, DELETE)

### 409 Conflict
- Ya existe una categoría con ese nombre
- Ya existe una categoría con ese `woocommerce_id`

### 500 Internal Server Error
- Error del servidor
- Error de conexión con WooCommerce (si está configurado)

---

## 📝 Ejemplos Completos

### Crear Categoría con Padre

```bash
curl -X POST https://api.sistema.mfcomputers.com.ar/api/categories \
  -H "X-API-Key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laptops Dell",
    "description": "Laptops de la marca Dell",
    "parent_id": 1
  }'
```

### Editar Solo el Nombre

```bash
curl -X PUT https://api.sistema.mfcomputers.com.ar/api/categories/1 \
  -H "X-API-Key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laptops Gaming Actualizado"
  }'
```

### Cambiar Categoría Padre

```bash
curl -X PUT https://api.sistema.mfcomputers.com.ar/api/categories/2 \
  -H "X-API-Key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "parent_id": 3
  }'
```

---

## ✅ Checklist de Uso

- [ ] API Key configurada en el header `X-API-Key`
- [ ] Content-Type: `application/json` en POST/PUT
- [ ] WooCommerce configurado (variables de entorno) para sincronización
- [ ] Verificar que la categoría se creó/actualizó en WooCommerce
- [ ] Revisar logs si hay errores de sincronización

---

## 🔍 Verificación

Después de crear/editar/eliminar una categoría:

1. **Verificar en ERP:**
   ```bash
   curl -X GET https://api.sistema.mfcomputers.com.ar/api/categories/1 \
     -H "X-API-Key: tu-api-key"
   ```

2. **Verificar en WooCommerce:**
   - Ve a **Productos → Categorías** en el panel de WooCommerce
   - Busca la categoría por nombre
   - Verifica que los cambios se reflejaron

---

¡Las rutas están listas para usar! 🚀
