# API de ventas (POS) – Frontend

Endpoint para **crear una venta** desde el punto de venta (POS) en el frontend.

Al crear una venta, el sistema automáticamente:

- **Stock en el ERP:** descuenta las cantidades vendidas del stock de cada producto (`products.stock`).
- **WooCommerce (si está configurado):** crea un pedido en WooCommerce y actualiza el stock de los productos en la tienda (descuento por ítem), para mantener ERP y tienda sincronizados.

## Crear venta

- **URL:** `POST /api/sales`  
  (base: por ejemplo `http://localhost:8086/api/sales` o la URL de tu API en producción)

- **Autenticación (una de las dos):**
  - **JWT (recomendado para el POS):** header `Authorization: Bearer <token>`
  - **API Key:** header `x-api-key: <tu-api-key>`

- **Content-Type:** `application/json`

### Cuerpo del request (ejemplo)

```json
{
  "items": [
    { "product_id": 123, "quantity": 1, "unit_price": 29000 },
    { "description": "Mano de obra router", "quantity": 1, "unit_price": 15000 }
  ],
  "payment_method": "efectivo",
  "client_id": 1,
  "notes": ""
}
```

| Campo            | Tipo   | Requerido | Descripción |
|-----------------|--------|-----------|-------------|
| `items`         | array  | Sí        | Al menos un ítem. **Catálogo:** `product_id`, `quantity`, `unit_price`. **Manual:** `description` (1–500 chars), `quantity`, `unit_price`. XOR: no mezclar `product_id` y `description` en el mismo ítem. |
| `payment_method`| string | Sí        | Uno de: `efectivo`, `tarjeta`, `transferencia`, `mixto`. |
| `client_id`     | int    | No        | Si no se envía, se usa "Consumidor Final". |
| `payment_details` | object | Si método es `mixto` | `{ "efectivo": number, "tarjeta": number, "transferencia": number }` cuya suma = total. |
| `notes`         | string | No        | Máx. 1000 caracteres. |
| `sync_to_woocommerce` | boolean | No | Por defecto `true`. |
| `allow_inactive` | boolean | No | Si `true`, permite vender productos marcados como inactivos (útil para último stock en POS). |

**Formato del body:** La API acepta tanto **snake_case** (`product_id`, `unit_price`, `payment_method`, `client_id`, `payment_details`) como **camelCase** (`productId`, `unitPrice`, `paymentMethod`, `clientId`, `paymentDetails`). Los valores de `payment_method` se normalizan a minúsculas (`"Efectivo"` → `"efectivo"`).

### Respuesta exitosa (201)

```json
{
  "success": true,
  "message": "Venta creada exitosamente",
  "data": { ... },
  "timestamp": "..."
}
```

### Si recibes 404

- Comprueba que la URL sea exactamente **`POST /api/sales`** (con el prefijo `/api` y el path `/sales`).
- Comprueba que la base URL del frontend (variable de entorno o config) apunte al mismo host/puerto donde corre esta API.

### Tabla `sales` no existe (error en servidor)

Si en los logs aparece `Table 'mfcomputers.sales' doesn't exist`, hay que crear las tablas del módulo de ventas. Ejecuta en tu base de datos el script:

- **`docs/migrations/2026-03-03_create_sales_tables.sql`**

Ejemplo (MySQL/MariaDB):

```bash
mysql -u usuario -p mfcomputers < docs/migrations/2026-03-03_create_sales_tables.sql
```

O desde tu cliente SQL: copia y ejecuta el contenido de ese archivo.

### Si recibes 400 (Bad Request)

- La respuesta incluye `message` y, si es por validación, un array `data` con los errores (campo y mensaje). Revisa en la pestaña **Network** del navegador el cuerpo de la respuesta (Response).
- Comprueba que **items** sea un array con al menos un elemento; cada ítem debe tener **product_id** (catálogo) **o** **description** (manual), más **quantity** y **unit_price** (o camelCase equivalente).
- **payment_method** debe ser exactamente uno de: `efectivo`, `tarjeta`, `transferencia`, `mixto` (minúsculas; si envías "Efectivo", la API lo normaliza).
- Si el método es **mixto**, incluye **payment_details** con `efectivo`, `tarjeta` y/o `transferencia` y que la suma coincida con el total de la venta.
- Si el error dice que **el producto está inactivo**: activa el producto en el listado de productos del ERP o envía en el body **`allow_inactive: true`** para permitir venderlo desde el POS.

### Si recibes 401

- Asegúrate de enviar **Authorization: Bearer &lt;token&gt;** con el JWT del usuario logueado, o el header **x-api-key** si usas API Key.
