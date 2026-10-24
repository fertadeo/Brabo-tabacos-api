# Dashboard — insights agregados (MF API)

**Audiencia:** equipo backend / MF API  
**Estado frontend:** `mfcomputers-nextjs` consume `GET /api/dashboard/insights` cuando existe; si no, calcula un subconjunto paginando ventas/pedidos/reparaciones del mes (más lento y sin líneas si el listado no trae `items`).  
**Motivo:** el dashboard **no debe** llamar a `GET /api/products?limit=10000` solo para KPIs ni recorrer miles de productos en el navegador.

---

## 1. Objetivo

Un único endpoint que devuelva, para un **período** (por defecto: mes calendario actual en zona `America/Argentina/Buenos_Aires` o la que use el ERP):

1. **Destacados del mes** (insights comerciales).
2. **Alertas operativas** (accionables hoy).
3. **Pipeline de reparaciones** (conteos y montos agregados).

El frontend muestra esto en el dashboard y deja de depender de listados masivos de productos.

---

## 2. Endpoint propuesto

### `GET /api/dashboard/insights`

**Autenticación:** igual que `GET /api/dashboard/stats` (JWT; roles recomendados: `admin`, `gerencia`, `finanzas`, `ventas`, `manager`).

**Query opcionales:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `date_from` | `YYYY-MM-DD` | Primer día del mes actual | Inicio inclusive |
| `date_to` | `YYYY-MM-DD` | Último día del mes actual | Fin inclusive |
| `timezone` | string | `America/Argentina/Buenos_Aires` | Para cortes de “hoy” y del mes |

**Respuesta HTTP 200:**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "period": {
      "date_from": "2026-06-01",
      "date_to": "2026-06-30"
    },
    "highlights": {
      "top_product_by_unit_price": {
        "product_id": 42,
        "product_name": "Notebook Gamer XYZ",
        "unit_price": 1850000,
        "source": "pos",
        "reference_type": "sale",
        "reference_id": 1203,
        "reference_label": "V-2026-01203"
      },
      "top_repair_order": {
        "id": 88,
        "repair_number": "R-2026-00088",
        "client_id": 15,
        "client_name": "Empresa ABC S.A.",
        "total_amount": 420000,
        "status": "en_proceso_reparacion",
        "reception_date": "2026-06-05"
      },
      "top_client": {
        "client_id": 15,
        "client_name": "Empresa ABC S.A.",
        "total_amount": 2500000,
        "from_pos": 800000,
        "from_orders": 1200000,
        "from_repairs": 500000
      }
    },
    "alerts": [
      {
        "id": "repairs_overdue_delivery",
        "severity": "warning",
        "title": "Reparaciones con retiro vencido",
        "count": 3,
        "href": "/reparaciones?filter=overdue"
      },
      {
        "id": "products_low_stock",
        "severity": "warning",
        "title": "Productos bajo stock mínimo",
        "count": 12,
        "href": "/productos?stock=low"
      },
      {
        "id": "orders_pending_preparation",
        "severity": "info",
        "title": "Pedidos pendientes de preparación",
        "count": 5,
        "href": "/pedidos?status=pendiente_preparacion"
      },
      {
        "id": "pos_pending_arca_sync",
        "severity": "info",
        "title": "Ventas POS pendientes de sincronizar con ARCA",
        "count": 2,
        "href": "/ventas?sync=pending"
      }
    ],
    "repair_pipeline": {
      "by_status": {
        "consulta_recibida": 2,
        "presupuestado": 4,
        "aceptado": 1,
        "en_proceso_reparacion": 6,
        "listo_entrega": 2
      },
      "open_count": 15,
      "month_average_ticket": 85000,
      "amount_in_workshop": 1200000
    }
  },
  "timestamp": "2026-06-02T15:00:00.000Z"
}
```

**Errores:** `401` sin token; `403` sin rol; `500` con `message` claro.

---

## 3. Reglas de negocio (highlights)

### 3.1 `top_product_by_unit_price`

- Buscar en **líneas vendidas** del período:
  - `sale_items` (ventas POS), join `sales` por `sale_date` en rango.
  - `order_items` (pedidos WooCommerce / canal web), join `orders` por `order_date` en rango; **excluir** pedidos `cancelado` / `cancelled`.
- **No** incluir ítems de `repair_order_items` (el usuario pidió “artículo vendido”, no repuesto de taller).
- Métrica: **máximo `unit_price`** de una línea individual (no precio de catálogo ni promedio).
- Desempate: mayor `unit_price`; si empatan, la línea más reciente.
- Campos mínimos: `product_name` (o `description` en ítems manuales), `unit_price`, `source` (`pos` | `woocommerce`), referencia legible (`sale_number` / `order_number`).

### 3.2 `top_repair_order`

- Órdenes de reparación con `reception_date` (o `created_at`, **documentar cuál usa el backend**) dentro del período.
- Excluir `cancelado`.
- Métrica: mayor `total_amount` (presupuesto/orden completa, no solo mano de obra).
- Incluir `client_name` (join `clients` o denormalizado).

### 3.3 `top_client`

- Por `client_id`, sumar montos del período:
  - **POS:** `sales.total_amount` donde `sale_date` en rango y venta no anulada.
  - **Pedidos:** `orders.total_amount` en rango, excluir cancelados.
  - **Reparaciones:** `repair_orders.total_amount` en rango (misma fecha que 3.2), excluir `cancelado`.
- `total_amount` = suma de las tres fuentes.
- Devolver desglose `from_pos`, `from_orders`, `from_repairs`.
- Cliente sin `client_id` en venta mostrador: opcional agrupar como `client_id: null`, `client_name: "Consumidor final"` o ignorar según política actual del POS.

---

## 4. Alertas (`alerts[]`)

Cada alerta: `id` estable, `severity` (`info` | `warning` | `danger`), `title`, `count`, `href` (ruta relativa del front).

| `id` | Criterio sugerido |
|------|------------------|
| `repairs_overdue_delivery` | `delivery_date_estimated` &lt; hoy AND `status` NOT IN (`entregado`, `cancelado`) |
| `products_low_stock` | productos activos con `stock > 0` y `stock <= min_stock` (misma lógica que `GET /api/products/stats`) |
| `orders_pending_preparation` | pedidos `pendiente_preparacion` (o equivalente Woo) |
| `pos_pending_arca_sync` | ventas con `sync_status = 'pending'` o `arca_status = 'pending'` según convención actual |

Opcional futuro: `woocommerce_sync_errors`, `purchases_pending`, `budgets_awaiting_approval`.

---

## 5. Pipeline de reparaciones (`repair_pipeline`)

| Campo | Descripción |
|-------|-------------|
| `by_status` | Conteo de órdenes **abiertas** (no `entregado`, no `cancelado`) por `status` |
| `open_count` | Suma de `by_status` |
| `month_average_ticket` | Promedio de `total_amount` de órdenes con fecha en período (excl. cancelado) |
| `amount_in_workshop` | Suma de `total_amount` de órdenes abiertas (dinero “en taller”) |

Puede reutilizar lógica de `GET /api/repair-orders/stats` ampliada con estos campos.

---

## 6. Implementación SQL (orientativa)

### 6.1 Top línea por precio unitario (ejemplo POS)

```sql
SELECT si.product_id, COALESCE(si.product_name, si.description) AS product_name,
       si.unit_price, 'pos' AS source, s.id AS reference_id, s.sale_number AS reference_label
FROM sale_items si
INNER JOIN sales s ON s.id = si.sale_id
WHERE s.sale_date >= :date_from AND s.sale_date <= :date_to
ORDER BY si.unit_price DESC
LIMIT 1;
```

Repetir unión con `order_items` / `orders` y quedarse con el máximo global entre ambas consultas (o `UNION ALL` + `ORDER BY unit_price DESC LIMIT 1`).

### 6.2 Top cliente

```sql
SELECT client_id, SUM(amount) AS total_amount
FROM (
  SELECT client_id, total_amount AS amount FROM sales WHERE ...
  UNION ALL
  SELECT client_id, total_amount FROM orders WHERE ... AND status NOT IN ('cancelado','cancelled')
  UNION ALL
  SELECT client_id, CAST(total_amount AS DECIMAL) FROM repair_orders WHERE ... AND status != 'cancelado'
) t
WHERE client_id IS NOT NULL
GROUP BY client_id
ORDER BY total_amount DESC
LIMIT 1;
```

Luego un segundo query o CTEs para `from_pos`, `from_orders`, `from_repairs` del ganador.

### 6.3 Índices recomendados

- `sales(sale_date)`, `sales(client_id)`
- `orders(order_date)`, `orders(status)`, `orders(client_id)`
- `repair_orders(reception_date)`, `repair_orders(status)`, `repair_orders(client_id)`
- `sale_items(sale_id)`, `order_items(order_id)`

---

## 7. Relación con endpoints existentes

| Endpoint actual | Uso después de insights |
|-----------------|-------------------------|
| `GET /api/dashboard/stats` | KPIs del día (ventas hoy, pedidos activos, etc.) — **mantener** |
| `GET /api/products/stats` | Inventario agregado (valor, bajo stock) — **mantener**; el dashboard ya no lista 10k productos |
| `GET /api/sales`, `GET /api/orders` | Solo pantallas de detalle/listado, no dashboard |
| `GET /api/repair-orders/stats` | Puede alimentar `repair_pipeline` internamente |

---

## 8. Contrato camelCase (opcional)

Si el API ya normaliza respuestas a camelCase para el front Next.js, aceptar ambos o solo camelCase:

- `top_product_by_unit_price` → `topProductByUnitPrice`
- `top_repair_order` → `topRepairOrder`
- `top_client` → `topClient`
- `repair_pipeline` → `repairPipeline`

El cliente en `lib/dashboard-insights.ts` normaliza snake_case y camelCase.

---

## 9. Criterios de aceptación

1. Con 0 ventas en el mes, `top_product_by_unit_price` es `null` (no error).
2. Con ventas POS y pedidos Woo, el top unitario considera **ambos** canales.
3. `top_client` incluye reparaciones del mes además de POS y pedidos.
4. Tiempo de respuesta objetivo: **&lt; 500 ms** con índices (sin paginar 10k filas al cliente).
5. Mismo resultado que el cálculo manual de QA para un mes de prueba acordado.
6. Documentar en OpenAPI/Swagger si existe.

---

## 10. Checklist backend

- [x] Crear ruta `GET /api/dashboard/insights`
- [x] Validar `date_from` / `date_to`
- [x] Implementar `highlights` (3 bloques)
- [x] Implementar `alerts` (conteos)
- [x] Implementar `repair_pipeline`
- [ ] Tests de integración con dataset fijo
- [ ] Avisar al front cuando esté en staging/producción (el front prioriza este endpoint automáticamente)

---

## 11. Referencia frontend

- Tipos: `DashboardInsightsPayload` en `lib/api.ts`
- Cliente: `fetchDashboardInsights()` en `lib/dashboard-insights.ts`
- UI: `app/dashboard/page.tsx` — sección “Destacados del mes”, “Atención hoy”, “Taller de reparaciones”
