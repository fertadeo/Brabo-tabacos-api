# Módulo de presupuestos comerciales (`/api/budgets`)

Presupuestos de catálogo (tabla `budgets` + líneas `budget_items`). **No descuentan stock** hasta convertirse en venta. Son independientes del flujo interno de “presupuesto enviado” de **órdenes de reparación** (`POST /api/repair-orders/:id/send-budget`), pero pueden **vincularse** a una orden cuando el negocio quiera documentar el mismo caso en ambos módulos.

## Migraciones SQL

1. Crear tablas base: `docs/migrations/2026-05-14_create_budgets_tables.sql`  
2. Tener tabla `repair_orders` (p. ej. `docs/migrations/2026-03-11_create_repair_orders_tables.sql`).  
3. Enlace opcional con FK: `docs/migrations/2026-05-14_link_budgets_repair_orders.sql`  
   - Añade `budgets.repair_order_id` + índice + FK a `repair_orders(id)` (`ON DELETE SET NULL`).  
   - Si la columna ya existe (p. ej. por `db-test.sql` sin FK), ejecutar solo la parte `ADD CONSTRAINT` / índice según corresponda.

Sin la columna `repair_order_id`, la API fallará en consultas que hacen `JOIN` con `repair_orders`.

---

## Enlace con órdenes de reparación

| Campo | Tabla | Descripción |
|--------|--------|-------------|
| `repair_order_id` | `budgets` | Opcional. ID de `repair_orders`. |

**Regla de negocio:** si `repair_order_id` no es nulo, el **`client_id` del presupuesto debe ser el mismo** que el `client_id` de la orden. La API valida esto en **POST** y **PUT** (borrador).

- **Desvincular (borrador):** `PUT` con `"repair_order_id": null`.  
- **Estado enviado (`sent`):** no se puede cambiar `repair_order_id` (solo `notes` y `valid_until`).  
- **Varios presupuestos** pueden apuntar a la misma orden (p. ej. revisiones); no hay unicidad 1:1 forzada en BD.

### Respuesta en presupuesto (`GET /api/budgets/:id` y listados)

Además de `repair_order_id`, cuando hay vínculo se devuelven (desde `repair_orders`):

- `repair_order_number` — `repair_number` de la orden  
- `repair_order_status` — estado de la orden (`consulta_recibida`, `presupuestado`, etc.)  
- `repair_order_equipment_description` — texto del equipo (contexto para UI)

### Listado de presupuestos por orden

`GET /api/budgets?repair_order_id=<id>`

### Orden de reparación → presupuestos comerciales vinculados

`GET /api/repair-orders/:id` incluye el arreglo **`linked_commercial_budgets`**:

```json
"linked_commercial_budgets": [
  {
    "id": 12,
    "budget_number": "BUD-202605-0003",
    "status": "draft",
    "total_amount": 45000
  }
]
```

Orden: más recientes primero (`created_at DESC`).

---

## Autenticación y roles

- Header: `Authorization: Bearer <JWT>`.  
- Ver listados/detalle: roles amplios (`admin`, `gerencia`, `ventas`, `finanzas`, `logistica`, `manager`, `employee`, `viewer`).  
- Crear/editar/transiciones/convertir: `admin`, `gerencia`, `ventas`.  
- Eliminar (solo borrador): `admin`, `gerencia`.

---

## Endpoints (resumen)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/budgets` | Lista; query: `client_id`, `repair_order_id`, `status`, `date_from`, `date_to`, `page`, `limit` |
| GET | `/api/budgets/stats` | Contadores por estado |
| GET | `/api/budgets/:id` | Detalle + `items` + datos de orden vinculada si aplica |
| POST | `/api/budgets` | Crear borrador; body opcional `repair_order_id` |
| PUT | `/api/budgets/:id` | Actualizar borrador (`repair_order_id` o `null`); o solo `notes`/`valid_until` si `sent` |
| DELETE | `/api/budgets/:id` | Solo borrador |
| POST | `/api/budgets/:id/send` | `draft` → `sent` |
| POST | `/api/budgets/:id/approve` | `sent` → `approved` |
| POST | `/api/budgets/:id/reject` | `draft`/`sent` → `rejected` |
| POST | `/api/budgets/:id/expire` | `draft`/`sent` → `expired` |
| POST | `/api/budgets/:id/convert-to-sale` | Solo `approved`; crea venta POS (misma semántica que `POST /api/sales`) |

### Crear / actualizar (body)

Campos habituales: `client_id`, `items[]` (`product_id`, `quantity`, `unit_price`), `valid_until`, `notes`, `allow_inactive`.

**Enlace reparación:** `repair_order_id` (número) o `repairOrderId` (camelCase). En `PUT` borrador, `repair_order_id: null` quita el vínculo.

---

## Relación conceptual con reparaciones

| Concepto | Reparaciones | Presupuestos comerciales |
|----------|----------------|---------------------------|
| Alcance | Orden en taller, ítems de materiales, mano de obra, estados de taller | Cotización catálogo / venta futura |
| “Presupuesto enviado” | Estado `presupuestado` + `budget_sent_at` | Estado `sent` en `budgets` |
| Enlace explícito | — | `budgets.repair_order_id` → `repair_orders.id` |

El enlace es **opcional** y sirve para trazabilidad y pantallas unificadas; no sustituye el flujo de estados de la orden de reparación.

---

## Guía de implementación para frontend (enlace con reparaciones)

Objetivo: permitir asociar un **presupuesto comercial** (`/api/budgets`) a una **orden de reparación** ya existente, mostrar el vínculo en ambas pantallas y respetar la regla **mismo cliente**.

### 1. Dos fuentes de verdad (cuándo usar cada una)

| Necesidad | Llamada |
|-----------|---------|
| Pantalla **detalle de orden de reparación**: listar presupuestos ERP vinculados | `GET /api/repair-orders/:id` → usar `linked_commercial_budgets` |
| Pantalla **listado de presupuestos** filtrados por orden | `GET /api/budgets?repair_order_id=<id>` |
| Pantalla **detalle de presupuesto**: ver orden asociada y contexto | `GET /api/budgets/:id` → `repair_order_id`, `repair_order_number`, `repair_order_status`, `repair_order_equipment_description` |

No hace falta duplicar lógica: si ya cargás la orden para el detalle, `linked_commercial_budgets` suele bastar para la pestaña “Presupuestos”. Si el listado global de presupuestos debe filtrar por taller, usá el query `repair_order_id`.

### 2. Flujo recomendado: crear presupuesto desde la orden

1. El usuario está en `GET /api/repair-orders/:id` (ya tenés `client_id`, `repair_number`, etc.).
2. Botón **“Nuevo presupuesto comercial”** (o similar) abre el formulario de alta de presupuesto.
3. **Prellenar y bloquear** `client_id` con el de la orden (`repair_order.client_id`). No permitas cambiarlo si `repair_order_id` va a enviarse (evita errores 400).
4. Al guardar, `POST /api/budgets` con el mismo `client_id` y:

```json
{
  "client_id": 42,
  "repair_order_id": 7,
  "items": [
    { "product_id": 100, "quantity": 1, "unit_price": 15000 }
  ]
}
```

Equivalente en camelCase: `repairOrderId: 7` (el servidor normaliza a `repair_order_id`).

5. Si la API responde **400** con mensaje sobre cliente y orden, revisá que `client_id` coincida exactamente con la orden.

### 3. Flujo: vincular o desvincular en borrador

- Solo en **`status === 'draft'`** podés cambiar `repair_order_id` junto con ítems y cabecera.
- **Vincular** una orden ya existente: `PUT /api/budgets/:id` con `repair_order_id` numérico (y `client_id` alineado con esa orden).
- **Desvincular:** `PUT /api/budgets/:id` con `"repair_order_id": null` (solo borrador).

En estado **`sent`** (y siguientes) **no** envíes `repair_order_id` ni `client_id` ni `items` en el `PUT`; solo `notes` y `valid_until` si aplica. Si el usuario intenta editar el vínculo, mostrá mensaje y deshabilitá campos.

### 4. UI sugerida

**Detalle de reparación**

- Sección **“Presupuestos comerciales”** alimentada por `linked_commercial_budgets`.
- Cada fila: `budget_number`, `status`, `total_amount`; link a la ruta de detalle de presupuesto (`/presupuestos/:id` o la que use vuestra app).
- Si el array está vacío, CTA “Crear presupuesto” con `repair_order_id` precargado en el formulario de alta.

**Detalle de presupuesto**

- Si `repair_order_id` es no nulo, mostrar chip o bloque con `repair_order_number`, estado de la orden (`repair_order_status`) y un enlace a `GET /api/repair-orders/:repair_order_id` (pantalla de orden).
- Texto corto del equipo: `repair_order_equipment_description` (tooltip si es largo).

**Formulario alta/edición**

- Selector de orden (opcional): al elegir orden, setear `repair_order_id` y forzar `client_id` al `client_id` de esa orden (cargar orden con `GET /api/repair-orders/:id` antes de confirmar).

### 5. Manejo de errores (mensajes típicos del backend)

| Situación | Respuesta esperada |
|-----------|---------------------|
| `repair_order_id` apunta a orden inexistente | 400, mensaje tipo “Orden de reparación con ID X no encontrada” |
| Orden existe pero `client_id` distinto | 400, “El cliente del presupuesto debe coincidir con el cliente de la orden de reparación vinculada” |
| Cambiar vínculo en estado `sent` | 400, texto sobre que solo se pueden actualizar `notes` y `valid_until` |

Mostrá `error` o el primer mensaje de `data` del `ApiResponse` según ya lo hagan con otros módulos.

### 6. No confundir con el flujo de taller

- **`POST /api/repair-orders/:id/send-budget`**: cambia estado de la orden a `presupuestado` y setea `budget_sent_at`. Es el flujo **interno** de taller.
- **`POST /api/budgets/:id/send`**: pasa el presupuesto **comercial** a `sent`.

Pueden convivir: una orden puede estar `presupuestado` por taller y además tener un `budget` comercial vinculado por `repair_order_id`. El producto puede decidir si exige uno, otro o ambos; la API no los fusiona automáticamente.

### 7. Checklist rápido

- [ ] Detalle orden: mostrar `linked_commercial_budgets` y navegación al presupuesto.
- [ ] Alta presupuesto desde orden: `client_id` = cliente de la orden + `repair_order_id` = id de la orden.
- [ ] Lista presupuestos en contexto orden: `GET /api/budgets?repair_order_id=…`.
- [ ] Detalle presupuesto: bloque enlace a orden si hay `repair_order_id`.
- [ ] Borrador: permitir `repair_order_id: null` para desvincular; bloquear edición de vínculo si `status !== 'draft'`.
- [ ] No enviar `repair_order_id` en `PUT` cuando el presupuesto está `sent`.

### 8. Tipos útiles (referencia TypeScript)

```ts
type BudgetStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';

interface LinkedCommercialBudgetSummary {
  id: number;
  budget_number: string;
  status: BudgetStatus;
  total_amount: number;
}

// En la respuesta de GET /api/repair-orders/:id (data)
interface RepairOrderDetail {
  // ...campos existentes de la orden
  linked_commercial_budgets?: LinkedCommercialBudgetSummary[];
}

// En GET /api/budgets/:id (data)
interface BudgetDetail {
  repair_order_id: number | null;
  repair_order_number?: string | null;
  repair_order_status?: string | null;
  repair_order_equipment_description?: string | null;
  // ...items, client_id, status, etc.
}
```
