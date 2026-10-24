# Consulta de ventas y estadísticas en el dashboard

Este documento describe cómo ver **todas las ventas** (POS + WooCommerce/pedidos) y cómo el **dashboard** obtiene las estadísticas de ventas.

---

## Dos orígenes de ventas en el sistema

En el ERP hay dos fuentes de “ventas” que conviene distinguir:

| Origen | Tabla | Descripción | Endpoints |
|--------|--------|-------------|-----------|
| **Ventas POS** | `sales` | Ventas realizadas en el local (punto de venta físico). Se crean con `POST /api/sales`. | `GET /api/sales`, `GET /api/sales/stats`, `GET /api/sales/:id` |
| **Pedidos** | `orders` | Pedidos del canal WooCommerce, mayorista o locales (no cobrados en caja POS). Incluyen pedidos online y pedidos internos. | `GET /api/orders`, `GET /api/orders/stats`, `GET /api/orders/:id` |

- **Ventas del día** en el dashboard = suma de **pedidos del día** (no cancelados) + **ventas POS del día**.
- Para “ver todas las ventas” hay que usar ambos módulos según lo que se quiera listar.

---

## Cómo ver todas las ventas realizadas

### 1. Ventas del POS (local)

- **Listado con filtros:**  
  `GET /api/sales?page=1&limit=20`

  Parámetros opcionales:
  - `client_id` – filtrar por cliente
  - `payment_method` – `efectivo`, `tarjeta`, `transferencia`, `mixto`
  - `sync_status` – `pending`, `synced`, `error`
  - `date_from`, `date_to` – fechas en ISO (ej. `2026-03-01`, `2026-03-03`)
  - `page`, `limit` – paginación

- **Una venta por ID:**  
  `GET /api/sales/:id`

- **Estadísticas solo del POS:**  
  `GET /api/sales/stats`

  Incluye: total ventas, monto total, promedio, ventas hoy, ventas del mes, por método de pago, pendientes de sincronización con WooCommerce.

**Autenticación:** Las rutas de ventas aceptan JWT (Bearer) o `x-api-key`. El listado y las stats no requieren rol especial; crear venta y sync sí pueden estar restringidos por rol en el frontend.

### 2. Pedidos (WooCommerce y otros canales)

- **Listado:**  
  `GET /api/orders?page=1&limit=20`

  Parámetros opcionales: `status`, `client_id`, `date_from`, `date_to`, `remito_status`, etc.

- **Estadísticas de pedidos:**  
  `GET /api/orders/stats`

Aquí entran los pedidos provenientes de WooCommerce y los pedidos locales que no son ventas de caja POS.

### 3. Resumen unificado en el frontend

Para una pantalla de “todas las ventas”:

- **Ventas POS:** llamar a `GET /api/sales` (y opcionalmente `GET /api/sales/stats`).
- **Pedidos:** llamar a `GET /api/orders` (y opcionalmente `GET /api/orders/stats`).

Se pueden mostrar en dos pestañas/bloques (“Ventas POS” y “Pedidos”) o en una sola lista combinada (por fecha), usando `sale_date` para ventas y `order_date` (o `created_at`) para pedidos.

---

## Dashboard: estadísticas de ventas

El dashboard obtiene sus números con:

- **`GET /api/dashboard/stats`**  
  Requiere rol **gerencia** o **finanzas**.

### Campos relacionados con ventas

| Campo | Descripción |
|-------|-------------|
| `dailySales` | **Ventas del día totales:** pedidos del día (no cancelados) + ventas POS del día. Es el valor que debe usarse para “Ventas del Día” en el dashboard. |
| `dailySalesFromOrders` | Solo ventas del día provenientes de **pedidos** (tabla `orders`, incl. WooCommerce). |
| `dailySalesFromPos` | Solo ventas del día del **POS** (tabla `sales`). |
| `activeOrders` | Cantidad de pedidos en estado activo (pendientes/en proceso). |

### Ejemplo de respuesta (fragmento)

```json
{
  "success": true,
  "data": {
    "dailySales": 150000,
    "dailySalesFromOrders": 80000,
    "dailySalesFromPos": 70000,
    "activeOrders": 3,
    "activeClients": 8,
    "criticalProducts": 22,
    "stockMinority": 45,
    "stockMajority": 120,
    "customOrders": 0
  }
}
```

### Uso en el frontend

- **Ventas del Día:** usar `data.dailySales` (ya incluye POS + pedidos).
- Si se quiere desglosar en la UI:
  - “Ventas del día (pedidos):” `data.dailySalesFromOrders`
  - “Ventas del día (POS):” `data.dailySalesFromPos`

Los campos `dailySalesFromOrders` y `dailySalesFromPos` son opcionales; si el backend no los envía, el frontend puede seguir usando solo `dailySales`.

---

## Actividades recientes

- **`GET /api/dashboard/activities`**  
  Devuelve actividades recientes (por defecto pedidos y órdenes de producción). No incluye ventas POS.

Para mostrar también ventas POS recientes, el frontend puede:

- Llamar a `GET /api/sales?limit=10` ordenado por fecha y mostrar esas ventas en un bloque “Ventas POS recientes”, o
- Combinar en una sola lista con las actividades del dashboard, usando `sale_date` y `sale_number` para las ventas.

---

## Resumen rápido

| Qué quieres | Endpoint(s) |
|-------------|-------------|
| Listar ventas del POS | `GET /api/sales` |
| Estadísticas solo del POS | `GET /api/sales/stats` |
| Listar pedidos (WooCommerce, etc.) | `GET /api/orders` |
| Estadísticas del dashboard (ventas del día unificadas) | `GET /api/dashboard/stats` → `dailySales`, `dailySalesFromOrders`, `dailySalesFromPos` |
| Ver una venta POS con detalle | `GET /api/sales/:id` |
| Ver un pedido con detalle | `GET /api/orders/:id` |

Con esto se pueden implementar tanto la “consulta de todas las ventas” (POS + WooCommerce vía pedidos) como las estadísticas del dashboard usando una única llamada a `/api/dashboard/stats` para Ventas del Día.
