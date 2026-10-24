# Módulo de Compras - Norte ERP API

## Descripción General

El módulo de compras permite gestionar las compras de productos a proveedores, incluyendo la gestión de proveedores, órdenes de compra y sus items. Incluye funcionalidades completas de CRUD, validaciones, autenticación JWT y autorización por roles.

## Estructura del Módulo

### Archivos Creados/Modificados

1. **Entidades y Tipos:**
   - `src/entities/Purchase.ts` - Interfaces para compras y items
   - `src/types/index.ts` - Tipos actualizados con enums y interfaces de compras

2. **Controladores:**
   - `src/controllers/purchaseController.ts` - Controlador principal con todos los endpoints

3. **Servicios:**
   - `src/services/PurchaseService.ts` - Lógica de negocio para compras

4. **Repositorios:**
   - `src/repositories/PurchaseRepository.ts` - Acceso a datos y consultas SQL

5. **Middleware:**
   - `src/middleware/purchaseValidation.ts` - Validaciones para compras y proveedores

6. **Rutas:**
   - `src/routes/purchases.ts` - Definición de rutas con autenticación JWT
   - `src/routes/index.ts` - Rutas principales actualizadas

## Autenticación y Autorización

Todas las rutas requieren **Bearer Token** en el header:
```
Authorization: Bearer <jwt_token>
```

### Roles Autorizados:
- **gerencia**: Acceso completo a todas las funcionalidades
- **finanzas**: Acceso completo a todas las funcionalidades
- **logistica**: Acceso de solo lectura a compras y proveedores

## Endpoints Disponibles

### 1. Gestión de Compras

#### GET /api/purchases
Obtener todas las compras con paginación y filtros.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10)
- `search` (opcional): Buscar por número de compra, nombre de proveedor o notas
- `status` (opcional): Filtrar por estado (pending, received, cancelled)
- `supplier_id` (opcional): Filtrar por ID de proveedor
- `date_from` (opcional): Fecha desde (YYYY-MM-DD)
- `date_to` (opcional): Fecha hasta (YYYY-MM-DD)
- `all` (opcional): true para obtener todas las compras sin paginación

**Ejemplo de petición:**
```bash
curl -X GET "http://localhost:3000/api/purchases?page=1&limit=10&status=pending" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Purchases retrieved successfully",
  "data": {
    "purchases": [
      {
        "id": 1,
        "purchase_number": "COMP0001",
        "supplier_id": 1,
        "supplier_name": "Proveedor ABC",
        "status": "pending",
        "total_amount": 1500.00,
        "purchase_date": "2024-01-15T10:30:00.000Z",
        "received_date": null,
        "notes": "Compra de materiales",
        "created_at": "2024-01-15T10:30:00.000Z",
        "updated_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### GET /api/purchases/:id
Obtener una compra específica por ID.

**Ejemplo de petición:**
```bash
curl -X GET "http://localhost:3000/api/purchases/1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### POST /api/purchases
Crear una nueva compra.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "supplier_id": 1,
  "status": "pending",
  "total_amount": 1500.00,
  "purchase_date": "2024-01-15T10:30:00.000Z",
  "notes": "Compra de materiales para producción"
}
```

**Ejemplo de petición:**
```bash
curl -X POST "http://localhost:3000/api/purchases" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": 1,
    "status": "pending",
    "total_amount": 1500.00,
    "notes": "Compra de materiales para producción"
  }'
```

#### PUT /api/purchases/:id
Actualizar una compra existente.

**Ejemplo de petición:**
```bash
curl -X PUT "http://localhost:3000/api/purchases/1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "received",
    "received_date": "2024-01-16T14:30:00.000Z",
    "notes": "Compra recibida y verificada"
  }'
```

#### DELETE /api/purchases/:id
Eliminar una compra.

**Ejemplo de petición:**
```bash
curl -X DELETE "http://localhost:3000/api/purchases/1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. Gestión de Items de Compra

#### GET /api/purchases/:id/items
Obtener todos los items de una compra.

**Ejemplo de petición:**
```bash
curl -X GET "http://localhost:3000/api/purchases/1/items" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Purchase items retrieved successfully",
  "data": [
    {
      "id": 1,
      "purchase_id": 1,
      "product_id": 5,
      "product_name": "Motor Eléctrico 220V",
      "product_code": "MOT001",
      "quantity": 10,
      "unit_price": 150.00,
      "total_price": 1500.00,
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### POST /api/purchases/:id/items
Agregar un item a una compra.

**Body:**
```json
{
  "product_id": 5,
  "quantity": 10,
  "unit_price": 150.00,
  "total_price": 1500.00
}
```

**Ejemplo de petición:**
```bash
curl -X POST "http://localhost:3000/api/purchases/1/items" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 5,
    "quantity": 10,
    "unit_price": 150.00,
    "total_price": 1500.00
  }'
```

#### PUT /api/purchases/:id/items/:itemId
Actualizar un item de compra.

**Ejemplo de petición:**
```bash
curl -X PUT "http://localhost:3000/api/purchases/1/items/1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 15,
    "unit_price": 140.00,
    "total_price": 2100.00
  }'
```

#### DELETE /api/purchases/:id/items/:itemId
Eliminar un item de compra.

**Ejemplo de petición:**
```bash
curl -X DELETE "http://localhost:3000/api/purchases/1/items/1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Gestión de Proveedores

#### GET /api/purchases/suppliers
Obtener todos los proveedores con paginación y filtros.

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10)
- `search` (opcional): Buscar por nombre, código o contacto
- `city` (opcional): Filtrar por ciudad
- `is_active` (opcional): Filtrar por estado activo (true/false)
- `all` (opcional): true para obtener todos los proveedores sin paginación

**Ejemplo de petición:**
```bash
curl -X GET "http://localhost:3000/api/purchases/suppliers?search=ABC&is_active=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### GET /api/purchases/suppliers/:id
Obtener un proveedor específico por ID.

**Ejemplo de petición:**
```bash
curl -X GET "http://localhost:3000/api/purchases/suppliers/1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### POST /api/purchases/suppliers
Crear un nuevo proveedor.

**Body:**
```json
{
  "code": "PROV001",
  "name": "Proveedor ABC S.A.",
  "contact_name": "Juan Pérez",
  "email": "juan@proveedorabc.com",
  "phone": "+54 11 1234-5678",
  "address": "Av. Corrientes 1234",
  "city": "Buenos Aires",
  "country": "Argentina"
}
```

**Ejemplo de petición:**
```bash
curl -X POST "http://localhost:3000/api/purchases/suppliers" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PROV001",
    "name": "Proveedor ABC S.A.",
    "contact_name": "Juan Pérez",
    "email": "juan@proveedorabc.com",
    "phone": "+54 11 1234-5678",
    "address": "Av. Corrientes 1234",
    "city": "Buenos Aires",
    "country": "Argentina"
  }'
```

#### PUT /api/purchases/suppliers/:id
Actualizar un proveedor existente.

**Ejemplo de petición:**
```bash
curl -X PUT "http://localhost:3000/api/purchases/suppliers/1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+54 11 9876-5432",
    "email": "nuevo@proveedorabc.com"
  }'
```

#### DELETE /api/purchases/suppliers/:id
Eliminar un proveedor (soft delete si tiene compras asociadas).

**Ejemplo de petición:**
```bash
curl -X DELETE "http://localhost:3000/api/purchases/suppliers/1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 4. Estadísticas

#### GET /api/purchases/stats
Obtener estadísticas de compras.

**Ejemplo de petición:**
```bash
curl -X GET "http://localhost:3000/api/purchases/stats" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Purchase statistics retrieved successfully",
  "data": {
    "total_purchases": 150,
    "pending_purchases": 25,
    "received_purchases": 120,
    "cancelled_purchases": 5,
    "total_amount": 450000.00,
    "average_amount": 3000.00
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### GET /api/purchases/suppliers/stats
Obtener estadísticas de proveedores.

**Ejemplo de petición:**
```bash
curl -X GET "http://localhost:3000/api/purchases/suppliers/stats" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Validaciones

### Compras
- `supplier_id`: Debe ser un número entero positivo
- `status`: Debe ser uno de: pending, received, cancelled
- `total_amount`: Debe ser un número positivo
- `purchase_date`: Debe ser una fecha válida en formato ISO 8601
- `received_date`: Debe ser una fecha válida en formato ISO 8601
- `notes`: Máximo 1000 caracteres

### Items de Compra
- `product_id`: Debe ser un número entero positivo
- `quantity`: Debe ser un número entero positivo
- `unit_price`: Debe ser un número positivo
- `total_price`: Debe ser un número positivo

### Proveedores
- `code`: Entre 1 y 20 caracteres
- `name`: Entre 1 y 100 caracteres
- `contact_name`: Máximo 100 caracteres
- `email`: Debe ser un email válido
- `phone`: Máximo 20 caracteres
- `address`: Máximo 500 caracteres
- `city`: Máximo 50 caracteres
- `country`: Máximo 50 caracteres

## Códigos de Respuesta HTTP

- **200**: Operación exitosa
- **201**: Recurso creado exitosamente
- **400**: Error de validación o datos inválidos
- **401**: No autorizado (token JWT inválido o faltante)
- **403**: Acceso denegado (rol insuficiente)
- **404**: Recurso no encontrado
- **409**: Conflicto (código de proveedor duplicado)
- **500**: Error interno del servidor

## Ejemplos de Flujo Completo

### 1. Crear Proveedor y Compra

```bash
# 1. Crear proveedor
curl -X POST "http://localhost:3000/api/purchases/suppliers" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PROV001",
    "name": "Proveedor ABC S.A.",
    "contact_name": "Juan Pérez",
    "email": "juan@proveedorabc.com",
    "phone": "+54 11 1234-5678",
    "city": "Buenos Aires"
  }'

# 2. Crear compra
curl -X POST "http://localhost:3000/api/purchases" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": 1,
    "status": "pending",
    "notes": "Compra de materiales para producción"
  }'

# 3. Agregar items a la compra
curl -X POST "http://localhost:3000/api/purchases/1/items" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 5,
    "quantity": 10,
    "unit_price": 150.00,
    "total_price": 1500.00
  }'

# 4. Marcar compra como recibida
curl -X PUT "http://localhost:3000/api/purchases/1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "received",
    "received_date": "2024-01-16T14:30:00.000Z"
  }'
```

### 2. Consultar Estadísticas

```bash
# Estadísticas de compras
curl -X GET "http://localhost:3000/api/purchases/stats" \
  -H "Authorization: Bearer <token>"

# Estadísticas de proveedores
curl -X GET "http://localhost:3000/api/purchases/suppliers/stats" \
  -H "Authorization: Bearer <token>"
```

## Notas Importantes

1. **Autenticación JWT**: Todas las peticiones requieren un token JWT válido en el header Authorization.

2. **Autorización por Roles**: Los endpoints están protegidos por roles específicos (gerencia, finanzas, logistica).

3. **Generación Automática**: Los números de compra se generan automáticamente con formato COMP0001, COMP0002, etc.

4. **Soft Delete**: Los proveedores con compras asociadas se desactivan (soft delete) en lugar de eliminarse completamente.

5. **Actualización Automática**: El total de la compra se actualiza automáticamente cuando se modifican los items.

6. **Validaciones**: Todas las entradas son validadas tanto en el middleware como en el servicio.

7. **Manejo de Errores**: Todos los errores se manejan de forma consistente con códigos HTTP apropiados y mensajes descriptivos.

## Integración con Módulo de Caja del Día

### 🔗 **Egresos de Compras en Caja**

Las compras se integran automáticamente con el módulo de caja del día (`/api/cash`) para el cálculo de egresos:

#### **Criterios de Inclusión:**
- Solo las compras con `status = 'received'` se consideran como egresos efectivos
- Las compras con `status = 'pending'` o `status = 'cancelled'` NO se incluyen en los cálculos de caja
- El monto considerado es el `total_amount` de la compra

#### **Endpoints de Caja que Incluyen Compras:**
- `GET /api/cash/day` - Incluye egresos de compras del día
- `GET /api/cash/period` - Incluye egresos de compras del período
- `GET /api/cash/monthly` - Incluye egresos de compras del mes
- `GET /api/cash/movements` - Lista movimientos de compras como egresos

#### **Ejemplo de Integración:**
```bash
# Obtener resumen del día (incluye egresos de compras recibidas)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/cash/day?date=2024-01-15"

# Respuesta incluye egresos de compras:
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "incomes": 50000,    // Ventas del día
    "expenses": 15000,   // Compras recibidas + otros egresos
    "balance": 35000
  }
}
```

#### **Movimientos Recientes:**
```bash
# Ver movimientos recientes (incluye compras como egresos)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/cash/movements?limit=10"

# Respuesta incluye compras como egresos:
{
  "success": true,
  "data": [
    {
      "type": "Egreso",
      "concept": "Compra - COMP0001",
      "amount": 1500.00,
      "date": "2024-01-15T10:30:00.000Z",
      "method": "N/A"
    }
  ]
}
```

### 📊 **Flujo de Datos:**

1. **Compra Creada** → `status = 'pending'` → **NO se incluye en caja**
2. **Compra Recibida** → `status = 'received'` → **SÍ se incluye en caja como egreso**
3. **Compra Cancelada** → `status = 'cancelled'` → **NO se incluye en caja**

### 🔄 **Sincronización Automática:**
- Los cálculos de caja se actualizan automáticamente cuando cambia el estado de una compra
- No se requiere intervención manual para reflejar los cambios en el módulo de caja
- Los reportes de caja siempre muestran el estado actual de las compras

## Base de Datos

El módulo utiliza las siguientes tablas:
- `purchases`: Compras principales
- `purchase_items`: Items de cada compra
- `suppliers`: Proveedores

Las tablas ya están definidas en el esquema de base de datos existente.

### **Integración con Caja:**
- Las compras con `status = 'received'` se incluyen automáticamente en los cálculos de egresos del módulo de caja
- El campo `total_amount` de la tabla `purchases` se suma a los egresos totales
- La fecha `purchase_date` se usa para filtrar por períodos en los reportes de caja

## Scripts de Base de Datos

### **Script Completo de Migración**
Archivo: `src/database/migration_purchases_complete.sql`

Este script incluye:
- ✅ Creación de todas las tablas necesarias
- ✅ Índices para optimización (compatible con MySQL 8.0+)
- ✅ 10 proveedores de ejemplo
- ✅ 10 compras de ejemplo con diferentes estados
- ✅ Items de compra asociados
- ✅ Verificaciones y reportes

### **Script Compatible con MySQL 5.7+**
Archivo: `src/database/migration_purchases_compatible.sql`

Este script incluye:
- ✅ Creación de todas las tablas necesarias
- ✅ Índices compatibles con versiones anteriores de MySQL
- ✅ 10 proveedores de ejemplo
- ✅ 10 compras de ejemplo con diferentes estados
- ✅ 20 productos temporales para items
- ✅ Items de compra completos
- ✅ Verificaciones y reportes

### **Script de Datos de Ejemplo**
Archivo: `src/database/seed_purchases_example.sql`

Este script incluye:
- ✅ Solo datos de ejemplo (requiere tablas existentes)
- ✅ 10 proveedores de ejemplo
- ✅ 10 compras de ejemplo
- ✅ 20 productos temporales para items
- ✅ Items de compra completos
- ✅ Reportes de verificación

### **Ejecución de Scripts**

```bash
# 1. Script compatible con MySQL 5.7+ (recomendado)
mysql -u usuario -p nombre_base_datos < src/database/migration_purchases_compatible.sql

# 2. Script para MySQL 8.0+ (si tienes problemas con el anterior)
mysql -u usuario -p nombre_base_datos < src/database/migration_purchases_complete.sql

# 3. Solo datos de ejemplo (si las tablas ya existen)
mysql -u usuario -p nombre_base_datos < src/database/seed_purchases_example.sql
```

### **Solución al Error de MySQL**

Si encuentras el error: `You have an error in your SQL syntax... near 'IF NOT EXISTS'`

**Causa:** Tu versión de MySQL no soporta `CREATE INDEX IF NOT EXISTS`

**Solución:** Usa el script compatible:
```bash
mysql -u usuario -p nombre_base_datos < src/database/migration_purchases_compatible.sql
```

### **Datos de Ejemplo Incluidos**

**Proveedores (10):**
- Proveedor ABC S.A.
- Materiales del Norte SRL
- Componentes Eléctricos S.A.
- Repuestos Industriales Ltda.
- Suministros Técnicos S.A.
- Herramientas del Sur
- Equipos Industriales SRL
- Materiales Especializados
- Componentes del Litoral
- Suministros del Interior

**Compras (10):**
- 6 compras recibidas (`status = 'received'`)
- 2 compras pendientes (`status = 'pending'`)
- 1 compra cancelada (`status = 'cancelled'`)
- Montos totales entre $8,500 y $25,000
- Fechas distribuidas en enero y febrero 2024

**Items de Compra:**
- 20 productos temporales (motores, aspas, cables, etc.)
- 2-3 items por compra
- Precios realistas para componentes de abanicos
- Cantidades variadas según el tipo de producto
