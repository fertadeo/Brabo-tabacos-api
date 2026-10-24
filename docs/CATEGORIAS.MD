# 📂 Documentación de Categorías de Productos

## 🎯 Resumen

Este módulo permite gestionar las categorías de productos del sistema ERP, con sincronización bidireccional entre WooCommerce y la API a través de n8n.

---

## 📋 Estructura de Base de Datos

### Tabla `categories`

```sql
CREATE TABLE IF NOT EXISTS `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `description` text,
  `is_active` tinyint(1) DEFAULT '1',
  `woocommerce_id` int DEFAULT NULL COMMENT 'ID de la categoría en WooCommerce',
  `woocommerce_slug` varchar(100) DEFAULT NULL COMMENT 'Slug de la categoría en WooCommerce',
  `parent_id` int DEFAULT NULL COMMENT 'Para categorías jerárquicas',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_woocommerce_id` (`woocommerce_id`),
  KEY `idx_woocommerce_slug` (`woocommerce_slug`),
  KEY `idx_parent_id` (`parent_id`),
  CONSTRAINT `fk_category_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### Migración SQL

Si la tabla ya existe, ejecuta este SQL para agregar los campos de WooCommerce:

```sql
ALTER TABLE `categories` 
ADD COLUMN `woocommerce_id` INT NULL COMMENT 'ID de la categoría en WooCommerce',
ADD COLUMN `woocommerce_slug` VARCHAR(100) NULL COMMENT 'Slug de la categoría en WooCommerce',
ADD COLUMN `parent_id` INT NULL COMMENT 'Para categorías jerárquicas',
ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
ADD UNIQUE KEY `unique_woocommerce_id` (`woocommerce_id`),
ADD KEY `idx_woocommerce_slug` (`woocommerce_slug`),
ADD KEY `idx_parent_id` (`parent_id`),
ADD CONSTRAINT `fk_category_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL;
```

---

## 🔐 Autenticación

Todos los endpoints requieren autenticación mediante API Key en el header:

```
X-API-Key: tu_api_key_aqui
```

Ver documentación de [API Keys](./API_KEYS_DOC.md) para más información.

---

## 📡 Endpoints Disponibles

### 1. Listar todas las categorías

**GET** `/api/categories`

Obtiene todas las categorías activas del sistema.

**Headers:**
```
X-API-Key: tu_api_key
```

**Response 200:**
```json
{
  "success": true,
  "message": "Categorías obtenidas exitosamente",
  "data": {
    "categories": [
      {
        "id": 1,
        "name": "Electrónicos",
        "description": "Productos electrónicos",
        "is_active": true,
        "woocommerce_id": 15,
        "woocommerce_slug": "electronicos",
        "parent_id": null,
        "created_at": "2024-01-15T10:00:00.000Z",
        "updated_at": "2024-01-15T10:00:00.000Z"
      }
    ]
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

### 2. Obtener categoría por ID

**GET** `/api/categories/:id`

Obtiene una categoría específica por su ID.

**Headers:**
```
X-API-Key: tu_api_key
```

**Parameters:**
- `id` (path): ID de la categoría (número)

**Response 200:**
```json
{
  "success": true,
  "message": "Categoría obtenida exitosamente",
  "data": {
    "category": {
      "id": 1,
      "name": "Electrónicos",
      "description": "Productos electrónicos",
      "is_active": true,
      "woocommerce_id": 15,
      "woocommerce_slug": "electronicos",
      "parent_id": null,
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z"
    }
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

**Response 404:**
```json
{
  "success": false,
  "message": "Categoría no encontrada",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

### 3. Crear nueva categoría

**POST** `/api/categories`

Crea una nueva categoría en el sistema.

**Headers:**
```
X-API-Key: tu_api_key
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Electrónicos",
  "description": "Productos electrónicos",
  "woocommerce_id": 15,
  "woocommerce_slug": "electronicos",
  "parent_id": null
}
```

**Campos:**
- `name` (string, requerido): Nombre de la categoría
- `description` (string, opcional): Descripción de la categoría
- `woocommerce_id` (number, opcional): ID de la categoría en WooCommerce
- `woocommerce_slug` (string, opcional): Slug de la categoría en WooCommerce
- `parent_id` (number, opcional): ID de la categoría padre (para jerarquías)

**Response 201:**
```json
{
  "success": true,
  "message": "Categoría creada exitosamente",
  "data": {
    "category": {
      "id": 1,
      "name": "Electrónicos",
      "description": "Productos electrónicos",
      "is_active": true,
      "woocommerce_id": 15,
      "woocommerce_slug": "electronicos",
      "parent_id": null,
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z"
    }
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

**Response 409 (Conflict):**
```json
{
  "success": false,
  "message": "Error creando categoría",
  "error": "Ya existe una categoría con ese nombre",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

### 4. Actualizar categoría

**PUT** `/api/categories/:id`

Actualiza una categoría existente.

**Headers:**
```
X-API-Key: tu_api_key
Content-Type: application/json
```

**Parameters:**
- `id` (path): ID de la categoría a actualizar

**Body:**
```json
{
  "name": "Electrónicos Actualizado",
  "description": "Nueva descripción",
  "woocommerce_id": 15,
  "woocommerce_slug": "electronicos-actualizado",
  "parent_id": null,
  "is_active": true
}
```

**Campos (todos opcionales):**
- `name` (string): Nuevo nombre de la categoría
- `description` (string): Nueva descripción
- `woocommerce_id` (number): ID de WooCommerce
- `woocommerce_slug` (string): Slug de WooCommerce
- `parent_id` (number): ID de categoría padre
- `is_active` (boolean): Estado activo/inactivo

**Response 200:**
```json
{
  "success": true,
  "message": "Categoría actualizada exitosamente",
  "data": {
    "category": {
      "id": 1,
      "name": "Electrónicos Actualizado",
      "description": "Nueva descripción",
      "is_active": true,
      "woocommerce_id": 15,
      "woocommerce_slug": "electronicos-actualizado",
      "parent_id": null,
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T11:00:00.000Z"
    }
  },
  "timestamp": "2024-01-15T11:00:00.000Z"
}
```

**Response 404:**
```json
{
  "success": false,
  "message": "Error actualizando categoría",
  "error": "Categoría no encontrada",
  "timestamp": "2024-01-15T11:00:00.000Z"
}
```

---

### 5. Sincronizar categorías desde WooCommerce

**POST** `/api/categories/sync/woocommerce`

**POST** `/api/woocommerce/categories/sync`

Sincroniza categorías desde WooCommerce. Si la categoría ya existe (por `woocommerce_id` o por nombre), se actualiza. Si no existe, se crea.

**Headers:**
```
X-API-Key: tu_api_key
Content-Type: application/json
```

**Body:**
```json
{
  "categories": [
    {
      "id": 15,
      "name": "Electrónicos",
      "slug": "electronicos",
      "parent": 0
    },
    {
      "id": 16,
      "name": "Computadoras",
      "slug": "computadoras",
      "parent": 15
    }
  ]
}
```

**Campos:**
- `categories` (array, requerido): Array de categorías de WooCommerce
  - `id` (number, requerido): ID de la categoría en WooCommerce
  - `name` (string, requerido): Nombre de la categoría
  - `slug` (string, requerido): Slug de la categoría
  - `parent` (number, opcional): ID de la categoría padre en WooCommerce (0 si no tiene padre)

**Response 200:**
```json
{
  "success": true,
  "message": "Sincronización completada. 1 creadas, 1 actualizadas.",
  "data": {
    "created": 1,
    "updated": 1,
    "errors": []
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

**Response con errores:**
```json
{
  "success": true,
  "message": "Sincronización completada. 1 creadas, 0 actualizadas.",
  "data": {
    "created": 1,
    "updated": 0,
    "errors": [
      {
        "woocommerce_id": 17,
        "name": "Categoría con error",
        "error": "Mensaje de error específico"
      }
    ]
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

### 6. Webhook directo de WooCommerce (RECOMENDADO)

**POST** `/api/integration/webhook/woocommerce/category`

Endpoint para recibir webhooks **directamente** de WooCommerce cuando se crea o actualiza una categoría.

**Headers:**
```
X-API-Key: tu_api_key (opcional)
X-Webhook-Secret: tu_webhook_secret (alternativa)
Content-Type: application/json
```

**Autenticación:**
Este endpoint usa `authenticateWebhook` que acepta:
- `X-API-Key`: API Key válida
- `X-Webhook-Secret`: Secret configurado en `WEBHOOK_SECRET` env variable

**Body (enviado por WooCommerce):**
```json
{
  "id": 15,
  "name": "Electrónicos",
  "slug": "electronicos",
  "parent": 0,
  "description": "",
  "display": "default",
  "image": null,
  "menu_order": 0,
  "count": 42
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Categoría sincronizada exitosamente desde WooCommerce",
  "data": {
    "woocommerce_id": 15,
    "category_name": "Electrónicos",
    "sync_result": {
      "created": 0,
      "updated": 1,
      "errors": []
    }
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

**Nota:** Este endpoint procesa automáticamente el payload de WooCommerce y sincroniza la categoría (crea o actualiza según corresponda).

---

### 7. Webhook genérico para cambios (opcional)

**POST** `/api/categories/webhook`

Endpoint genérico para recibir notificaciones de cambios en categorías (puede ser usado por otros sistemas o n8n si es necesario).

**Headers:**
```
X-API-Key: tu_api_key
Content-Type: application/json
```

**Body:**
```json
{
  "action": "created",
  "category": {
    "id": 1,
    "name": "Electrónicos",
    "woocommerce_id": 15
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Webhook recibido correctamente",
  "data": {
    "action": "created",
    "category": {
      "id": 1,
      "name": "Electrónicos",
      "woocommerce_id": 15
    }
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

## 🔄 Sincronización Bidireccional con WooCommerce

### Workflow 1: WooCommerce → API (Webhook Directo - RECOMENDADO)

Cuando se crea o actualiza una categoría en WooCommerce, el webhook se envía **directamente** al ERP sin intermediarios.

**Flujo:**
1. WooCommerce detecta creación/actualización de categoría
2. WooCommerce envía webhook directamente a `POST /api/integration/webhook/woocommerce/category`
3. El ERP sincroniza automáticamente la categoría

**Configuración en WooCommerce:**

1. Ve a **WooCommerce → Settings → Advanced → Webhooks**
2. Haz clic en **Add webhook**
3. Configura:
   - **Name**: `ERP Category Sync`
   - **Status**: `Active`
   - **Topic**: Selecciona uno o más:
     - `Product category created`
     - `Product category updated`
     - `Product category deleted` (opcional)
   - **Delivery URL**: `https://tu-api.com/api/integration/webhook/woocommerce/category`
   - **Secret**: Configura una clave secreta y agrégalo a tu `.env` como `WEBHOOK_SECRET`

**Ejemplo de payload que WooCommerce envía:**
```json
{
  "id": 15,
  "name": "Electrónicos",
  "slug": "electronicos",
  "parent": 0,
  "description": "",
  "display": "default",
  "image": null,
  "menu_order": 0,
  "count": 42
}
```

El endpoint procesa automáticamente este payload y sincroniza la categoría en el ERP.

---

### Workflow 2: API → WooCommerce

Cuando se crea o actualiza una categoría en el ERP:

**Flujo:**
1. Se detecta cambio en categoría del ERP
2. Si tiene `woocommerce_id`, actualizar en WooCommerce
3. Si no tiene `woocommerce_id`, crear en WooCommerce
4. Actualizar `woocommerce_id` en el ERP

**Crear en WooCommerce:**
```json
{
  "name": "Nueva Categoría",
  "slug": "nueva-categoria",
  "parent": 0
}
```

**Actualizar en WooCommerce:**
```json
{
  "id": 15,
  "name": "Categoría Actualizada",
  "slug": "categoria-actualizada"
}
```

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Crear categoría manualmente

```bash
curl -X POST https://tu-api.com/api/categories \
  -H "X-API-Key: tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Accesorios",
    "description": "Accesorios para computadoras"
  }'
```

### Ejemplo 2: Sincronizar desde WooCommerce

```bash
curl -X POST https://tu-api.com/api/woocommerce/categories/sync \
  -H "X-API-Key: tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "categories": [
      {
        "id": 15,
        "name": "Electrónicos",
        "slug": "electronicos",
        "parent": 0
      }
    ]
  }'
```

### Ejemplo 3: Actualizar categoría

```bash
curl -X PUT https://tu-api.com/api/categories/1 \
  -H "X-API-Key: tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Electrónicos Actualizado",
    "woocommerce_slug": "electronicos-actualizado"
  }'
```

### Ejemplo 4: Obtener todas las categorías

```bash
curl -X GET https://tu-api.com/api/categories \
  -H "X-API-Key: tu_api_key"
```

---

## ⚙️ Configuración del Webhook Directo

### Paso 1: Configurar Variable de Entorno

En tu archivo `.env`:

```env
WEBHOOK_SECRET=tu_secret_seguro_aqui_muy_largo_y_aleatorio
```

### Paso 2: Configurar Webhook en WooCommerce

1. Ve a **WooCommerce Admin → Settings → Advanced → Webhooks**
2. Haz clic en **Add webhook**
3. Configuración:
   - **Name**: `ERP Category Sync`
   - **Status**: `Active`
   - **Topic**: Selecciona:
     - `Product category created`
     - `Product category updated`
     - (Opcional) `Product category deleted`
   - **Delivery URL**: 
     ```
     https://tu-dominio-api.com/api/integration/webhook/woocommerce/category
     ```
   - **Secret**: Usa el mismo valor que configuraste en `WEBHOOK_SECRET`
   - **API Version**: `WP REST API Integration v3`

4. Haz clic en **Save webhook**

### Paso 3: Verificar que Funciona

1. Crea o actualiza una categoría en WooCommerce
2. El webhook se enviará automáticamente
3. Revisa los logs de tu API para confirmar la recepción

---

## ⚙️ Configuración Alternativa con n8n (Opcional)

Si prefieres usar n8n como intermediario (no recomendado pero posible):

### Variables de Entorno

Configura estas variables en n8n:

```
N8N_API_KEY=tu_api_key_aqui
API_BASE_URL=https://tu-api.com/api
WC_STORE_URL=https://tu-tienda.com
WC_CONSUMER_KEY=tu_consumer_key
WC_CONSUMER_SECRET=tu_consumer_secret
```

### Workflow: Sincronización WooCommerce → n8n → API

**Nodos necesarios:**

1. **Webhook Trigger (WooCommerce)**
   - Configurar en WooCommerce → Settings → Advanced → Webhooks
   - Topics: `Product category created`, `Product category updated`

2. **Function Node (Transformar datos)**
```javascript
const wcCategory = $json;

return {
  categories: [{
    id: wcCategory.id,
    name: wcCategory.name,
    slug: wcCategory.slug,
    parent: wcCategory.parent || 0
  }]
};
```

3. **HTTP Request (Sincronizar con API)**
   - Method: `POST`
   - URL: `{{$env.API_BASE_URL}}/woocommerce/categories/sync`
   - Headers:
     - `X-API-Key`: `{{$env.N8N_API_KEY}}`
     - `Content-Type`: `application/json`
   - Body: `{{$json}}`

**Nota:** Esta opción agrega complejidad innecesaria. Se recomienda usar webhook directo.

---

## 🔍 Lógica de Sincronización

### Al sincronizar desde WooCommerce:

1. **Buscar por `woocommerce_id`**: Si existe, actualizar
2. **Si no existe**: Buscar por nombre
   - Si existe por nombre pero no tiene `woocommerce_id`: Actualizar y agregar `woocommerce_id`
   - Si no existe: Crear nueva categoría

### Al crear/actualizar en el ERP:

1. Si la categoría tiene `woocommerce_id`: Actualizar en WooCommerce
2. Si no tiene `woocommerce_id`: Crear en WooCommerce y actualizar el `woocommerce_id` en el ERP

---

## ⚠️ Errores Comunes

### Error 409: "Ya existe una categoría con ese nombre"

Solución: Verificar que no haya otra categoría con el mismo nombre o usar `woocommerce_id` para identificarla de forma única.

### Error 404: "Categoría no encontrada"

Solución: Verificar que el ID de la categoría sea correcto.

### Error de sincronización duplicada

Solución: Usar `woocommerce_id` para evitar duplicados. La sincronización automática maneja esto automáticamente.

---

## 📚 Archivos Relacionados

- `src/entities/Category.ts` - Entidad de categoría
- `src/repositories/CategoryRepository.ts` - Repositorio de categorías
- `src/services/CategoryService.ts` - Servicio de categorías
- `src/controllers/categoryController.ts` - Controlador de categorías
- `src/routes/categories.ts` - Rutas de categorías
- `src/routes/woocommerce.ts` - Rutas de sincronización con WooCommerce

---

## 🔗 Referencias

- [Documentación de API Keys](./API_KEYS_DOC.md)
- [Documentación de Productos](./PRODUCTS_DOC.md)
- [Documentación de Integración N8N](./N8N_Integracion.md)

---

## 🚀 Configuración Rápida

### Resumen de Pasos para Webhook Directo:

1. ✅ **Agregar `WEBHOOK_SECRET` a `.env`**
   ```env
   WEBHOOK_SECRET=tu_secret_super_seguro
   ```

2. ✅ **Reiniciar el servidor** para cargar la variable de entorno

3. ✅ **Configurar webhook en WooCommerce:**
   - URL: `https://tu-api.com/api/integration/webhook/woocommerce/category`
   - Secret: El mismo que `WEBHOOK_SECRET`
   - Topics: `Product category created`, `Product category updated`

4. ✅ **Probar creando una categoría en WooCommerce**

¡Listo! Las categorías se sincronizarán automáticamente cuando se creen o actualicen en WooCommerce.

---

## 📝 Notas

- Las categorías pueden tener jerarquías usando el campo `parent_id`
- El campo `woocommerce_id` debe ser único
- Las categorías inactivas (`is_active = false`) no se listan en `GET /api/categories`
- La sincronización bidireccional requiere configuración correcta de webhooks en WooCommerce y n8n