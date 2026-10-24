# WooCommerce: reservas, dimensiones y peso (productos por encargo)

## Caso práctico

- Producto **publicado y disponible** en la tienda pero con **stock 0** (venta por encargo).
- En WooCommerce: "Permitir reservas" → "Permitir, pero se avisará al cliente".
- Además: **dimensiones y peso** del producto para calcular/gestionar envíos.

**Estado:** Implementado en API y sincronización con WooCommerce.

---

## 1. Reservas (stock 0 / producto por encargo)

- **ERP:** El producto tiene el campo `allow_backorders` (boolean). Si es `true`, al sincronizar con WooCommerce se envía `backorders: 'notify'` y el producto puede venderse con stock 0 (reserva).
- **WooCommerce:** Equivale a "Permitir reservas" → "Permitir, pero se avisará al cliente".
- Los pedidos que llegan desde WooCommerce con productos en stock 0 se crean en el ERP sin validación de stock.

## 2. Dimensiones y peso

- **ERP:** Campos `weight` (kg), `length`, `width`, `height` (cm). Opcionales; se envían a WooCommerce en la sincronización para envíos.
- **WooCommerce:** Usa `weight` y `dimensions: { length, width, height }` para cálculo de envíos.

---

## 3. Guía para el equipo de frontend

### Base URL y autenticación

- **Base URL productos:** `GET/POST/PUT /api/products` (según tu entorno, ej. `https://api.sistema.mfcomputers.com.ar/api/products`).
- **Autenticación:** JWT en header `Authorization: Bearer <token>`.
- **Roles:** Crear/editar productos (incl. peso, dimensiones, reservas): **gerencia**. Lectura: gerencia, ventas, logística, finanzas.

### Campos nuevos en el recurso Product

Todos los endpoints que devuelven un producto (GET por id, GET listado, POST crear, PUT actualizar) incluyen estos campos cuando existen:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `weight` | `number \| null` | Peso en **kg** (envíos). |
| `length` | `number \| null` | Longitud en **cm**. |
| `width` | `number \| null` | Ancho en **cm**. |
| `height` | `number \| null` | Alto en **cm**. |
| `allow_backorders` | `boolean` | Si es `true`, producto por encargo (reservas con stock 0). En WooCommerce se sincroniza como "Permitir reservas". Por defecto `false`. |

- Si la columna en BD es `NULL` o no existe, la API devuelve `null` para peso/dimensiones y `false` para `allow_backorders` si no se ha guardado.

### GET /api/products (listado)

- **Query:** `page`, `limit`, `category_id`, `search`, `active_only`, `all`.
- **Respuesta:** `data.products[]` con los campos anteriores en cada ítem.

### GET /api/products/:id (detalle)

- **Respuesta:** Un objeto producto con `weight`, `length`, `width`, `height`, `allow_backorders` además del resto de campos.

### POST /api/products (crear producto)

- **Body (JSON):** mismos campos que antes más los opcionales siguientes.

| Campo | Tipo | Obligatorio | Validación |
|-------|------|-------------|------------|
| `weight` | number o null | No | ≥ 0 (kg) |
| `length` | number o null | No | ≥ 0 (cm) |
| `width` | number o null | No | ≥ 0 (cm) |
| `height` | number o null | No | ≥ 0 (cm) |
| `allow_backorders` | boolean | No | true = venta por encargo |

**Ejemplo mínimo (producto por encargo con peso y dimensiones):**

```json
{
  "code": "ENCARGO-001",
  "name": "Notebook por encargo",
  "price": 450000,
  "stock": 0,
  "weight": 2.5,
  "length": 35,
  "width": 24,
  "height": 2,
  "allow_backorders": true,
  "sync_to_woocommerce": true
}
```

**Ejemplo con más campos:**

```json
{
  "code": "MON-22",
  "name": "Monitor 22\"",
  "description": "Monitor full HD.",
  "category_id": 3,
  "price": 85000,
  "stock": 5,
  "min_stock": 1,
  "max_stock": 50,
  "weight": 4.2,
  "length": 52,
  "width": 42,
  "height": 28,
  "allow_backorders": false,
  "barcode": "7891234567890",
  "sync_to_woocommerce": false
}
```

- Si envías `sync_to_woocommerce: true`, tras crear el producto se sincroniza a WooCommerce (con peso, dimensiones y `backorders` según `allow_backorders`).

### PUT /api/products/:id (actualizar producto)

- **Body (JSON):** todos los campos son opcionales; solo se actualizan los enviados. Para peso, dimensiones y reservas usar los mismos nombres y tipos que en POST.

**Ejemplo: marcar como producto por encargo y agregar peso:**

```json
{
  "stock": 0,
  "allow_backorders": true,
  "weight": 1.8,
  "length": 30,
  "width": 20,
  "height": 5,
  "sync_to_woocommerce": true
}
```

- Si envías `sync_to_woocommerce: true`, se vuelve a sincronizar el producto a WooCommerce con los datos actuales (incl. peso, dimensiones y backorders).

### POST /api/products/:id/sync-to-woocommerce (sincronizar un producto)

- **Ruta:** `POST /api/products/:id/sync-to-woocommerce`
- **Body:** ninguno (opcional).
- **Uso:** Envía a WooCommerce el producto actual del ERP (incl. `weight`, `length`, `width`, `height` y `backorders` según `allow_backorders`). Útil después de editar peso/dimensiones/reservas sin haber puesto `sync_to_woocommerce: true` en el PUT.

### Respuesta estándar de la API

- **Éxito (200/201):** `{ "success": true, "message": "...", "data": { ... producto o listado ... }, "timestamp": "..." }`
- **Error (4xx/5xx):** `{ "success": false, "message": "...", "error": "...", "timestamp": "..." }`

### Resumen para UI

1. **Formulario producto (crear/editar)**  
   - Añadir campos opcionales: Peso (kg), Largo / Ancho / Alto (cm), y checkbox "Venta por encargo" (`allow_backorders`).  
   - Envío: mismo body que antes más `weight`, `length`, `width`, `height`, `allow_backorders` (y opcionalmente `sync_to_woocommerce`).

2. **Listado / detalle**  
   - Mostrar peso y dimensiones si vienen distintos de `null`.  
   - Mostrar indicador de "Por encargo" cuando `allow_backorders === true` (y típicamente `stock === 0`).

3. **Sincronización WooCommerce**  
   - Tras crear/editar, si el usuario elige "Sincronizar con WooCommerce", enviar `sync_to_woocommerce: true` en el mismo request.  
   - O usar después `POST /api/products/:id/sync-to-woocommerce` para sincronizar solo ese producto.

---

## 4. Migración de base de datos

Antes de usar estos campos en producción, ejecutar la migración:

- **Archivo:** `docs/migrations/2026-03-04_add_product_weight_dimensions_backorders.sql`
- **Contenido:** Añade a la tabla `products` las columnas `weight`, `length`, `width`, `height` y `allow_backorders`. Si alguna columna ya existe (p. ej. por `db-test`), comentar esa línea del script para evitar "Duplicate column name".

---

## 5. Resumen técnico (backend)

| Funcionalidad | Implementación |
|---------------|----------------|
| **Reservas** | Campo `allow_backorders` en producto; sync envía `backorders: 'notify'` cuando es true. |
| **Peso** | Campo `weight` (kg); leído/escrito en API y enviado a WooCommerce en sync. |
| **Dimensiones** | Campos `length`, `width`, `height` (cm); leídos/escritos en API y enviados como `dimensions` a WooCommerce en sync. |
