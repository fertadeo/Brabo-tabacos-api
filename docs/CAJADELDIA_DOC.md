# 💵 Módulo de Control de Caja - Documentación API

## 📚 Índice
1. [Descripción General](#descripción-general)
2. [Modelo de Datos/Fuentes](#modelo-de-datosfuentes)
3. [Endpoints](#endpoints)
4. [Autenticación y Autorización](#autenticación-y-autorización)
5. [Códigos de Respuesta](#códigos-de-respuesta)
6. [Ejemplos de Uso](#ejemplos-de-uso)
7. [Roadmap](#roadmap)

---

## 📝 Descripción General

El módulo de Control de Caja consolida ingresos y egresos para ofrecer un resumen del día, de un período y del mes con comparación contra el mes anterior, además de listar movimientos recientes. Toma los datos de otros módulos (ventas y compras) y los procesa para el frontend.

### Características Principales
- ✅ Agregación de ingresos a partir de pedidos (ventas)
- ✅ Agregación de egresos a partir de compras recibidas
- ✅ Agregación de egresos operativos (gastos individuales)
- ✅ Agregación de egresos financieros (pagos con type='outflow')
- ✅ Resumen diario, por período y mensual con comparación vs mes anterior
- ✅ Listado de movimientos recientes (ingresos/egresos)
- ✅ Control de acceso por roles con JWT

---

## 🗃️ Modelo de Datos/Fuentes

El módulo no define tablas nuevas; usa las existentes:

- **Ingresos (Ventas)**: tabla `orders` (ver `src/database/migration_orders.sql`)
  - Campos usados: `total_amount`, `order_date`, `status`
  - Filtro: `status NOT IN ('cancelado','cancelled')`

- **Egresos (Compras)**: tabla `purchases` (ver `src/database/schema.sql`)
  - Campos usados: `total_amount`, `purchase_date`, `status`
  - Filtro: `status = 'received'` (solo compras recibidas se consideran egresos efectivos)
  - **INTEGRACIÓN**: Las compras se incluyen automáticamente en todos los cálculos de caja

- **Egresos Operativos**: tabla `expenses` (ver `src/database/migration_cash_expenses.sql`)
  - Campos usados: `amount`, `expense_date`, `status`
  - Filtro: `status = 'registrado'`

- **Egresos Financieros**: tabla `payments` (ver `src/database/migration_payments.sql`)
  - Campos usados: `amount`, `payment_date`, `type`
  - Filtro: `type = 'outflow'`

> Nota: Cuando se incorporen tablas de cobros/pagos, se podrán desglosar métodos de pago (efectivo, tarjeta, transferencia) y KPIs de mix de pagos.

---

## 🔌 Endpoints

Base URL: `/api/cash`

### 1) Resumen del Día

**GET** `/api/cash/day?date=YYYY-MM-DD`

Devuelve ingresos, egresos y balance para el día especificado (por defecto, hoy).

#### Query Parameters
| Parámetro | Tipo   | Requerido | Descripción                 |
|-----------|--------|-----------|-----------------------------|
| date      | string | No        | Fecha del día (YYYY-MM-DD) |

#### Roles Autorizados
- `gerencia`
- `manager`
- `finanzas`
- `admin`

#### Respuesta Exitosa (200 OK)
```json
{
  "success": true,
  "message": "Day cash summary",
  "data": {
    "date": "2025-01-22",
    "incomes": 32780,
    "expenses": 12450,
    "balance": 20330
  },
  "timestamp": "2025-01-22T12:34:56.000Z"
}
```

---

### 2) Resumen por Período

**GET** `/api/cash/period?from=YYYY-MM-DD&to=YYYY-MM-DD`

Suma ingresos y egresos entre ambas fechas (inclusive).

#### Query Parameters
| Parámetro | Tipo   | Requerido | Descripción                  |
|-----------|--------|-----------|------------------------------|
| from      | string | ✅ Sí     | Fecha inicio (YYYY-MM-DD)    |
| to        | string | ✅ Sí     | Fecha fin (YYYY-MM-DD)       |

#### Roles Autorizados
- `gerencia`
- `manager`
- `finanzas`
- `admin`

#### Respuesta Exitosa (200 OK)
```json
{
  "success": true,
  "message": "Period cash summary",
  "data": {
    "from": "2025-01-01",
    "to": "2025-01-31",
    "incomes": 1247580,
    "expenses": 456230,
    "balance": 791350
  },
  "timestamp": "2025-01-22T12:34:56.000Z"
}
```

---

### 3) Resumen Mensual (comparado con mes anterior)

**GET** `/api/cash/monthly?year=YYYY&month=MM`

Devuelve totales del mes indicado y del mes anterior, con deltas.

#### Query Parameters
| Parámetro | Tipo   | Requerido | Descripción                    |
|-----------|--------|-----------|--------------------------------|
| year      | number | No        | Año (default: actual)          |
| month     | number | No        | Mes 1-12 (default: actual)     |

#### Roles Autorizados
- `gerencia`
- `manager`
- `finanzas`
- `admin`

#### Respuesta Exitosa (200 OK)
```json
{
  "success": true,
  "message": "Monthly cash summary",
  "data": {
    "period": { "year": 2025, "month": 1 },
    "current": { "incomes": 1247580, "expenses": 456230, "balance": 791350 },
    "previous": { "incomes": 1000000, "expenses": 420000, "balance": 580000 },
    "delta": { "incomes": 247580, "expenses": 36230, "balance": 211350 }
  },
  "timestamp": "2025-01-22T12:34:56.000Z"
}
```

---

### 4) Movimientos Recientes

**GET** `/api/cash/movements?limit=20&from=YYYY-MM-DD&to=YYYY-MM-DD`

Lista movimientos de ingresos (ventas) y egresos (compras recibidas, gastos operativos, pagos financieros) ordenados por fecha desc.

#### Query Parameters
| Parámetro | Tipo   | Requerido | Descripción                                                   | Default |
|-----------|--------|-----------|---------------------------------------------------------------|---------|
| limit     | number | No        | Cantidad de movimientos                                       | 20      |
| from      | string | No        | Desde fecha (YYYY-MM-DD). Si se omite, últimos 30 días       | -       |
| to        | string | No        | Hasta fecha (YYYY-MM-DD)                                     | -       |

#### Roles Autorizados
- `gerencia`
- `manager`
- `finanzas`
- `admin`

#### Respuesta Exitosa (200 OK)
```json
{
  "success": true,
  "message": "Recent movements",
  "data": [
    { "id": 1, "type": "Ingreso", "concept": "Venta - ORD25001", "amount": 45230, "date": "2025-01-22 09:45:00", "method": "N/A" },
    { "id": 9, "type": "Egreso",  "concept": "Compra - COMP0003", "amount": 32400, "date": "2025-01-22 08:00:00", "method": "N/A" },
    { "id": 5, "type": "Egreso",  "concept": "Gasto Operativo - Luz", "amount": 15000, "date": "2025-01-21 14:30:00", "method": "Transferencia" },
    { "id": 3, "type": "Egreso",  "concept": "Pago Sueldos", "amount": 250000, "date": "2025-01-20 10:00:00", "method": "Transferencia" }
  ],
  "timestamp": "2025-01-22T12:34:56.000Z"
}
```

---

## 🔐 Autenticación y Autorización

### Autenticación
Todos los endpoints requieren JWT en el header:

```
Authorization: Bearer <token>
```

### Roles y Permisos (resumen)

| Endpoint                 | Gerencia | Manager | Finanzas | Admin |
|--------------------------|----------|---------|----------|-------|
| GET /api/cash/day        | ✅       | ✅      | ✅       | ✅    |
| GET /api/cash/period     | ✅       | ✅      | ✅       | ✅    |
| GET /api/cash/monthly    | ✅       | ✅      | ✅       | ✅    |
| GET /api/cash/movements  | ✅       | ✅      | ✅       | ✅    |

---

## 📊 Códigos de Respuesta

| Código | Descripción                                   |
|--------|-----------------------------------------------|
| 200    | OK - Operación exitosa                        |
| 400    | Bad Request - Parámetros faltantes/incorrectos|
| 401    | Unauthorized - Token inválido o expirado      |
| 403    | Forbidden - Sin permisos suficientes           |
| 500    | Internal Server Error - Error del servidor    |

---

## 💡 Ejemplos de Uso

```bash
# Resumen del día
curl -H "Authorization: Bearer $TOKEN" "http://localhost:8083/api/cash/day?date=2025-01-22"

# Resumen por período
curl -H "Authorization: Bearer $TOKEN" "http://localhost:8083/api/cash/period?from=2025-01-01&to=2025-01-31"

# Resumen mensual y comparación
curl -H "Authorization: Bearer $TOKEN" "http://localhost:8083/api/cash/monthly?year=2025&month=1"

# Movimientos recientes (últimos 30 días por defecto)
curl -H "Authorization: Bearer $TOKEN" "http://localhost:8083/api/cash/movements?limit=20"
```

---

## 🔗 Integración con Módulo de Compras

### **Egresos de Compras en Caja del Día**

El módulo de caja del día incluye automáticamente los egresos provenientes del módulo de compras:

#### **Criterios de Inclusión:**
- ✅ **Compras Recibidas**: Solo compras con `status = 'received'` se consideran egresos efectivos
- ❌ **Compras Pendientes**: Compras con `status = 'pending'` NO se incluyen en cálculos de caja
- ❌ **Compras Canceladas**: Compras con `status = 'cancelled'` NO se incluyen en cálculos de caja

#### **Endpoints que Incluyen Compras:**
- `GET /api/cash/day` - Suma egresos de compras recibidas del día
- `GET /api/cash/period` - Suma egresos de compras recibidas del período
- `GET /api/cash/monthly` - Suma egresos de compras recibidas del mes
- `GET /api/cash/movements` - Lista compras como movimientos de egreso

#### **Ejemplo de Cálculo:**
```bash
# Resumen del día incluye compras recibidas
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/cash/day?date=2024-01-15"

# Respuesta incluye egresos de compras:
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "incomes": 50000,    // Ventas del día
    "expenses": 25000,   // Compras recibidas + gastos operativos + pagos
    "balance": 25000
  }
}
```

#### **Flujo de Integración:**
1. **Compra Creada** → `status = 'pending'` → **NO se incluye en caja**
2. **Compra Recibida** → `status = 'received'` → **SÍ se incluye en caja como egreso**
3. **Compra Cancelada** → `status = 'cancelled'` → **NO se incluye en caja**

### **Sincronización Automática:**
- Los cálculos de caja se actualizan automáticamente cuando cambia el estado de una compra
- No se requiere intervención manual para reflejar los cambios
- Los reportes siempre muestran el estado actual de las compras

## 🗺️ Roadmap

- **Métodos de pago**: incorporar tabla de cobros/pagos para desglosar ingresos por efectivo/tarjeta/transferencia y mostrar "Métodos de Pago".
- **Gastos operativos**: extender egresos a servicios, sueldos, etc., si se agrega módulo de gastos.
- **Exportaciones**: endpoints para CSV/Excel en `/period` y `/movements`.

---

**Implementación en código**