# 🧾 Módulo de Egresos - Documentación
 
 ## 📚 Índice
 - **Descripción General**
 - **Fuentes de Datos**
 - **Endpoints Disponibles**
 - **Filtros y Paginación**
 - **Ejemplos de Uso (curl)**
 - **Relación con Caja**
 - **Notas y Extensiones**
 
 ---
 
## 📝 Descripción General
El módulo de Egresos centraliza y exhibe las salidas de dinero de la empresa. Actualmente se alimenta de:

- **Compras a proveedores** (módulo `purchases`) - **INTEGRADO CON CAJA DEL DÍA**
- Gastos operativos individuales (tabla `expenses`).
- Pagos/egresos financieros (tabla `payments` con `type='outflow'`).

El frontend consume principalmente el listado de gastos (`/api/cash/expenses`) y los movimientos recientes (`/api/cash/movements`) donde aparecen egresos provenientes de compras.

### 🔗 **Integración con Caja del Día**
Las compras se integran automáticamente con el módulo de caja del día para el cálculo de egresos:
- Solo las compras con `status = 'received'` se consideran como egresos efectivos
- Las compras pendientes o canceladas NO se incluyen en los cálculos de caja
- Los endpoints `/api/cash/*` incluyen automáticamente los egresos de compras recibidas
 
 ---
 
 ## 🗃️ Fuentes de Datos
 
- `purchases` (ver `src/database/schema.sql`):
  - Campos relevantes: `total_amount`, `purchase_date`, `status`.
  - Se consideran egresos las compras con `status = 'received'` (no `cancelled`).
  - **INTEGRADO CON CAJA DEL DÍA**: Los egresos de compras se incluyen automáticamente en los cálculos de `/api/cash/*`
 
 - `expenses` (ver `src/database/migration_cash_expenses.sql`):
   - Egresos operativos cargados manualmente.
   - Campos: `concept`, `category ('servicios','sueldos','impuestos','logistica','insumos','otros')`, `method ('efectivo','tarjeta','transferencia')`, `amount`, `expense_date`, `status ('registrado','anulado')`.
 
 - `payments` (ver `src/database/migration_payments.sql`):
   - Egresos financieros generales con mayor flexibilidad.
   - Usar `type = 'outflow'` para egresos.
   - Permite asociar el egreso a `purchase | expense | payroll | other` mediante `related_type/related_id` y detallar destinatario mediante `payee_type/payee_id/payee_name`.
 
 ---
 
 ## 🔌 Endpoints Disponibles
 
 - `GET /api/cash/expenses`
   - Lista egresos operativos desde `expenses` con filtros y paginación.
   - Implementación: `src/controllers/cashController.ts` → `listExpenses()`.
 
 - `POST /api/cash/expenses`
   - Crea un gasto operativo individual en `expenses`.
   - Implementación: `src/controllers/cashController.ts` → `createExpense()`.
 
 - `GET /api/cash/movements`
   - Lista movimientos recientes combinando ingresos (`orders`) y egresos (`purchases`). Los egresos corresponden a compras no canceladas.
   - Implementación: `src/controllers/cashController.ts` → `getRecentMovements()`.
 
 - `GET /api/payments` (CRUD completo en `/api/payments`)
   - Permite gestionar egresos financieros más amplios (sueldos, proveedores, etc.) usando `type='outflow'`.
   - Implementación: `src/controllers/paymentsController.ts`.
 
 ---
 
 ## 🔎 Filtros y Paginación
 
 - `GET /api/cash/expenses`
   - `from, to`: rango de fechas (`DATE(expense_date) BETWEEN ? AND ?`).
   - `category`: filtra por categoría.
   - `status`: por defecto `registrado`.
   - `page, limit`: paginación (default `1`, `20`).
 
 - `GET /api/payments`
   - `type`: usar `outflow` para egresos.
   - `from, to`: rango de fechas (`DATE(payment_date) ...`).
   - `method`: `efectivo|tarjeta|transferencia`.
   - `payee_type`: `supplier|employee|other|client`.
   - `related_type`: `purchase|expense|payroll|order`.
   - `min, max`: monto mínimo/máximo.
   - `page, limit`: paginación.
 
 ---
 
 ## 💡 Ejemplos de Uso (curl)
 
 - **Listar gastos operativos del mes**
 ```bash
 curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8083/api/cash/expenses?from=2025-10-01&to=2025-10-31&status=registrado&page=1&limit=20"
 ```
 
 - **Crear gasto operativo**
 ```bash
 curl -X POST http://localhost:8083/api/cash/expenses \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
   "concept": "Factura de luz",
   "category": "servicios",
   "method": "transferencia",
   "amount": 32000,
   "expense_date": "2025-10-20 09:00:00",
   "notes": "Edenor"
 }'
 ```
 
 - **Listar egresos financieros (payments)**
 ```bash
 curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8083/api/payments?type=outflow&from=2025-10-01&to=2025-10-31&method=transferencia"
 ```
 
 - **Crear egreso de sueldos (payments)**
 ```bash
 curl -X POST http://localhost:8083/api/payments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
   "type": "outflow",
   "method": "transferencia",
   "amount": 320000,
   "status": "posted",
   "payee_type": "employee",
   "payee_id": 7,
   "payee_name": "Empleado Pérez",
   "related_type": "payroll",
   "related_id": 202510,
   "notes": "Liquidación Octubre"
 }'
 ```
 
 - **Crear egreso a proveedor por compra (payments)**
 ```bash
 curl -X POST http://localhost:8083/api/payments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
   "type": "outflow",
   "method": "transferencia",
   "amount": 125000,
   "status": "posted",
   "payee_type": "supplier",
   "payee_id": 2,
   "payee_name": "Proveedor Demo 2",
   "related_type": "purchase",
   "related_id": 42,
   "notes": "Pago OC PUR-9002"
 }'
 ```
 
 ---
 
## 🔗 Relación con Caja

### **Integración Automática con Caja del Día:**
- `GET /api/cash/day` - Incluye egresos de compras recibidas del día
- `GET /api/cash/period` - Incluye egresos de compras recibidas del período  
- `GET /api/cash/monthly` - Incluye egresos de compras recibidas del mes
- `GET /api/cash/movements` - Lista compras como egresos en movimientos recientes

### **Criterios de Inclusión:**
- Solo compras con `status = 'received'` se incluyen en cálculos de caja
- Compras `pending` o `cancelled` NO se consideran como egresos efectivos
- El monto `total_amount` se suma automáticamente a los egresos totales

### **Otros Endpoints de Egresos:**
- `GET /api/cash/expenses` gestiona egresos operativos individuales en `expenses`.
- El módulo de pagos (`/api/payments`) permite registrar egresos financieros más amplios (`type='outflow'`), útiles para reportes y conciliaciones.
- La distribución de métodos de pago en Caja (`/api/cash/payment-methods`) utiliza solo `payments` con `type='income'` (cobros), no egresos.
 
 ---
 
 ## 🧩 Notas y Extensiones
 
 - Alinear colación/charset a `utf8mb4_unicode_ci` para evitar errores en uniones y literales.
 - Si se requiere que `movements` también incluya egresos de `expenses` o `payments`, se puede extender el `UNION` en `getRecentMovements()` agregando selects adicionales, manteniendo tipos/colaciones consistentes.
 - Para auditoría avanzada, considerar `status` y `created_by` en `expenses` y `payments`.