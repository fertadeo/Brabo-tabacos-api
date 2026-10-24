# 📦 Configuración de Recepción de Pedidos desde WooCommerce

## 🎯 Resumen de Cambios

Se ha preparado la API y base de datos para recibir pedidos desde WooCommerce a través de n8n.

---

## 📋 Cambios Realizados

### 1. Base de Datos

#### Migración SQL: `migration_orders_woocommerce_id.sql`

**Archivo:** `src/database/migration_orders_woocommerce_id.sql`

**Query para ejecutar:**

```sql
-- Agregar columna woocommerce_order_id si no existe
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'orders' 
     AND COLUMN_NAME = 'woocommerce_order_id') = 0,
    'ALTER TABLE orders ADD COLUMN woocommerce_order_id INT NULL AFTER order_number',
    'SELECT "Columna woocommerce_order_id ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar índice único para woocommerce_order_id (permite NULL pero evita duplicados)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'orders' 
     AND INDEX_NAME = 'idx_woocommerce_order_id') = 0,
    'CREATE UNIQUE INDEX idx_woocommerce_order_id ON orders(woocommerce_order_id)',
    'SELECT "Índice idx_woocommerce_order_id ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar comentario a la columna
ALTER TABLE orders MODIFY COLUMN woocommerce_order_id INT NULL COMMENT 'ID del pedido en WooCommerce (para evitar duplicados)';
```

**O ejecutar el archivo completo:**

```bash
mysql -u root -p norte_erp < src/database/migration_orders_woocommerce_id.sql
```

---

### 2. Código Actualizado

#### Archivos Modificados:

1. **`src/entities/Order.ts`**
   - Agregado campo `woocommerce_order_id?: number | null` a la interfaz `Order`
   - Agregados campos `order_number?: string` y `woocommerce_order_id?: number` a `CreateOrderData`

2. **`src/repositories/OrderRepository.ts`**
   - Modificado `createOrder()` para aceptar `order_number` personalizado y `woocommerce_order_id`
   - Agregado método `getOrderByWooCommerceId()` para buscar pedidos por ID de WooCommerce

3. **`src/services/OrderService.ts`**
   - Agregado método `getOrderByWooCommerceId()` que retorna `ApiResponse`

4. **`src/controllers/integrationController.ts`**
   - Modificado `receiveWholesaleOrder()` para:
     - Extraer `woocommerce_order_id` del body
     - Verificar duplicados antes de crear el pedido
     - Usar `order_number` de WooCommerce con prefijo `WC-`
     - Incluir `woocommerce_order_id` en el pedido creado

---

## 🔌 Endpoint

### POST `/api/integration/orders/woocommerce-mayorista`

**Autenticación:** Requiere API Key en header `x-api-key`

**Request Body:**

```json
{
  "order_date": "2024-01-15T10:00:00Z",
  "order_number": "4742",
  "woocommerce_order_id": 4742,
  "customer": {
    "email": "cliente@example.com",
    "first_name": "Juan",
    "last_name": "Pérez",
    "phone": "11-1234-5678",
    "display_name": "Juan Pérez"
  },
  "line_items": [
    {
      "sku": "ABA-00627",
      "quantity": 11,
      "price": 16584.9981,
      "product_name": "Abanico Flodra Blue Pocket"
    }
  ],
  "shipping": {
    "address_1": "Av. Corrientes 1234",
    "city": "CABA",
    "country": "AR",
    "phone": "11-1234-5678",
    "method": "OCA",
    "total": "500.00"
  },
  "billing": {
    "address_1": "Av. Corrientes 1234",
    "city": "CABA",
    "country": "AR",
    "phone": "11-1234-5678"
  },
  "meta_data": []
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Pedido mayorista recibido y creado exitosamente",
  "data": {
    "order": {
      "id": 123,
      "order_number": "WC-4742",
      "woocommerce_order_id": 4742,
      "client_id": 5,
      "status": "pendiente_preparacion",
      ...
    },
    "warnings": []
  },
  "timestamp": "2024-01-15T10:00:00Z"
}
```

**Response (200 OK - Pedido ya existe):**

```json
{
  "success": true,
  "message": "Pedido ya existe en el sistema",
  "data": {
    "order": {...},
    "already_exists": true
  },
  "timestamp": "2024-01-15T10:00:00Z"
}
```

---

## 🔄 Actualización del Mapeo en n8n

### Nodo 6: Code - "Mapear Pedido para ERP"

**Actualizar el código para incluir `woocommerce_order_id`:**

```javascript
// Mapear pedido de WooCommerce al formato del ERP
const order = $input.item.json;

// Extraer datos del cliente
const customer = {
  email: order.billing?.email || '',
  first_name: order.billing?.first_name || '',
  last_name: order.billing?.last_name || '',
  phone: order.billing?.phone || '',
  display_name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim()
};

// Preparar items de la orden
const line_items = (order.line_items || []).map(item => ({
  sku: item.sku || null,
  quantity: item.quantity || 1,
  unit_price: parseFloat(item.price || 0),
  product_name: item.name || ''
}));

// Preparar objeto completo
return {
  json: {
    order_date: order.date_created,
    order_number: order.number || order.id.toString(),
    woocommerce_order_id: order.id, // ⭐ NUEVO: ID de WooCommerce para evitar duplicados
    customer: customer,
    line_items: line_items,
    shipping: {
      address_1: order.shipping?.address_1 || order.billing?.address_1 || '',
      city: order.shipping?.city || order.billing?.city || '',
      country: order.shipping?.country || order.billing?.country || 'AR',
      phone: order.shipping?.phone || order.billing?.phone || customer.phone,
      method: order.shipping_lines?.[0]?.method_title || '',
      total: order.shipping_total || '0'
    },
    billing: {
      address_1: order.billing?.address_1 || '',
      city: order.billing?.city || '',
      country: order.billing?.country || 'AR',
      phone: order.billing?.phone || customer.phone
    },
    total: order.total || '0',
    meta_data: order.meta_data || []
  }
};
```

---

## ✅ Características Implementadas

1. ✅ **Prevención de Duplicados**
   - Verifica si el pedido ya existe por `woocommerce_order_id` o `order_number`
   - Retorna el pedido existente si ya fue importado

2. ✅ **Almacenamiento de ID de WooCommerce**
   - Campo `woocommerce_order_id` en la tabla `orders`
   - Índice único para evitar duplicados

3. ✅ **Número de Pedido Personalizado**
   - Usa el `order_number` de WooCommerce con prefijo `WC-`
   - Si no se proporciona, genera uno automático

4. ✅ **Creación Automática de Clientes**
   - Busca cliente por email
   - Si no existe, lo crea automáticamente como mayorista

5. ✅ **Validación de Productos**
   - Busca productos por SKU
   - Ignora productos no encontrados (con warning)
   - Solo crea pedido si hay al menos un producto válido

---

## 🚀 Pasos para Implementar

### 1. Ejecutar Migración SQL

```bash
mysql -u root -p norte_erp < src/database/migration_orders_woocommerce_id.sql
```

**O ejecutar manualmente:**

```sql
-- Ver archivo: src/database/migration_orders_woocommerce_id.sql
```

### 2. Reiniciar la Aplicación

```bash
pm2 restart norte-erp-api
# o
pm2 reload norte-erp-api
```

### 3. Actualizar Mapeo en n8n

Actualizar el nodo "Mapear Pedido para ERP" con el código actualizado que incluye `woocommerce_order_id`.

### 4. Probar el Endpoint

```bash
curl -X POST https://api.sistema.norteabanicos.com/api/integration/orders/woocommerce-mayorista \
  -H "x-api-key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "order_date": "2024-01-15T10:00:00Z",
    "order_number": "4742",
    "woocommerce_order_id": 4742,
    "customer": {
      "email": "test@example.com",
      "first_name": "Test",
      "last_name": "User"
    },
    "line_items": [
      {
        "sku": "ABA-00627",
        "quantity": 1,
        "price": 16584.9981
      }
    ]
  }'
```

---

## 📝 Notas Importantes

1. **Duplicados:** El sistema ahora verifica automáticamente si un pedido ya fue importado y retorna el existente en lugar de crear uno nuevo.

2. **Prefijo WC-:** Los pedidos de WooCommerce se identifican con el prefijo `WC-` en el `order_number` (ej: `WC-4742`).

3. **Productos Faltantes:** Si un producto no se encuentra por SKU, se omite pero se incluye un warning en la respuesta.

4. **Cliente Automático:** Si el cliente no existe, se crea automáticamente con tipo `mayorista` y canal `woocommerce_mayorista`.

---

## 🔍 Verificación

### Verificar que la columna existe:

```sql
DESCRIBE orders;
-- Debe mostrar woocommerce_order_id
```

### Verificar que el índice existe:

```sql
SHOW INDEXES FROM orders WHERE Key_name = 'idx_woocommerce_order_id';
```

### Verificar pedidos importados:

```sql
SELECT id, order_number, woocommerce_order_id, client_id, status, created_at 
FROM orders 
WHERE woocommerce_order_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## ✅ Checklist de Implementación

- [ ] Ejecutar migración SQL
- [ ] Reiniciar aplicación
- [ ] Actualizar mapeo en n8n (agregar `woocommerce_order_id`)
- [ ] Probar endpoint con un pedido de prueba
- [ ] Verificar que no se crean duplicados
- [ ] Verificar que los clientes se crean automáticamente
- [ ] Verificar que los productos se mapean correctamente

---

**¡Listo para recibir pedidos desde WooCommerce! 🎉**

