# 📦 **MÓDULO DE PEDIDOS (ORDERS) - DOCUMENTACIÓN COMPLETA**

## 🎯 **DESCRIPCIÓN**

El módulo de Pedidos es el núcleo del sistema de ventas del ERP Norte Abanicos. Gestiona todo el ciclo de vida de un pedido desde su creación hasta su entrega, con integración completa al módulo de Logística (Remitos).

---

## 🔑 **ENDPOINTS DISPONIBLES**

### **Autenticación**
Todos los endpoints requieren autenticación con API Key en el header:
```
x-api-key: norte-erp-api-key-2024
```

---

## 📋 **CRUD DE PEDIDOS**

### **1. Crear Pedido**
```http
POST /api/orders
Content-Type: application/json
x-api-key: norte-erp-api-key-2024
```

**Request Body:**
```json
{
  "client_id": 1,
  "status": "pendiente_preparacion",
  "delivery_date": "2024-11-15T10:00:00Z",
  "delivery_address": "Av. Corrientes 1234",
  "delivery_city": "CABA",
  "delivery_contact": "Juan Pérez",
  "delivery_phone": "11-1234-5678",
  "transport_company": "OCA",
  "transport_cost": 500.00,
  "notes": "Entregar en horario de oficina",
  "items": [
    {
      "product_id": 1,
      "quantity": 5,
      "unit_price": 1500.00,
      "batch_number": "LOT-2024-001",
      "notes": "Producto con garantía extendida"
    },
    {
      "product_id": 2,
      "quantity": 3,
      "unit_price": 2500.00
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Pedido creado exitosamente",
  "data": {
    "id": 123,
    "order_number": "ORD2400001",
    "client_id": 1,
    "status": "pendiente_preparacion",
    "total_amount": 15000.00,
    "order_date": "2024-10-12T14:30:00Z",
    "delivery_date": "2024-11-15T10:00:00Z",
    "delivery_address": "Av. Corrientes 1234",
    "delivery_city": "CABA",
    "delivery_contact": "Juan Pérez",
    "delivery_phone": "11-1234-5678",
    "transport_company": "OCA",
    "transport_cost": 500.00,
    "notes": "Entregar en horario de oficina",
    "remito_status": "sin_remito",
    "stock_reserved": false,
    "is_active": true,
    "created_at": "2024-10-12T14:30:00Z",
    "updated_at": "2024-10-12T14:30:00Z"
  },
  "timestamp": "2024-10-12T14:30:00Z"
}
```

---

### **2. Obtener Pedido por ID**
```http
GET /api/orders/123
x-api-key: norte-erp-api-key-2024
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pedido obtenido exitosamente",
  "data": {
    "id": 123,
    "order_number": "ORD2400001",
    "client_id": 1,
    "client_name": "Cortinas Sur S.A.",
    "client_code": "CLI-001",
    "client_email": "ventas@cortinassur.com",
    "client_phone": "11-5555-1234",
    "status": "listo_despacho",
    "total_amount": 15000.00,
    "order_date": "2024-10-12T14:30:00Z",
    "delivery_date": "2024-11-15T10:00:00Z",
    "remito_status": "sin_remito",
    "stock_reserved": true,
    "remito_id": null,
    "remito_number": null,
    "items": [
      {
        "id": 1,
        "order_id": 123,
        "product_id": 1,
        "product_name": "Roller Sunscreen 1,80m",
        "product_code": "ROLL-SUN-180",
        "quantity": 5,
        "unit_price": 1500.00,
        "total_price": 7500.00,
        "batch_number": "LOT-2024-001",
        "stock_reserved": true,
        "created_at": "2024-10-12T14:30:00Z"
      }
    ],
    "is_active": true,
    "created_at": "2024-10-12T14:30:00Z",
    "updated_at": "2024-10-12T15:00:00Z"
  },
  "timestamp": "2024-10-12T15:05:00Z"
}
```

---

### **3. Obtener Pedido por Número**
```http
GET /api/orders/number/ORD2400001
x-api-key: norte-erp-api-key-2024
```

**Response:** Igual que GET por ID

---

### **4. Obtener Todos los Pedidos (con filtros)**
```http
GET /api/orders?status=listo_despacho&client_id=1&page=1&limit=20
x-api-key: norte-erp-api-key-2024
```

**Query Parameters:**
- `status`: Estado del pedido (pendiente_preparacion, listo_despacho, pagado, aprobado, en_proceso, completado, cancelado)
- `client_id`: ID del cliente
- `remito_status`: Estado del remito (sin_remito, remito_generado, remito_despachado, remito_entregado)
- `date_from`: Fecha desde (ISO 8601)
- `date_to`: Fecha hasta (ISO 8601)
- `stock_reserved`: true/false
- `has_remito`: true/false
- `page`: Número de página (default: 1)
- `limit`: Límite por página (default: 10, max: 100)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pedidos obtenidos exitosamente",
  "data": {
    "orders": [
      {
        "id": 123,
        "order_number": "ORD2400001",
        "client_name": "Cortinas Sur S.A.",
        "status": "listo_despacho",
        "total_amount": 15000.00,
        "remito_status": "sin_remito",
        "items": [...]
      }
    ],
    "total": 45
  },
  "timestamp": "2024-10-12T15:10:00Z"
}
```

---

### **5. Actualizar Pedido**
```http
PUT /api/orders/123
Content-Type: application/json
x-api-key: norte-erp-api-key-2024
```

**Request Body:**
```json
{
  "status": "listo_despacho",
  "delivery_date": "2024-11-16T10:00:00Z",
  "notes": "Cliente solicitó cambio de fecha"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pedido actualizado exitosamente",
  "data": {
    "id": 123,
    "order_number": "ORD2400001",
    "status": "listo_despacho",
    "delivery_date": "2024-11-16T10:00:00Z",
    ...
  },
  "timestamp": "2024-10-12T15:15:00Z"
}
```

---

### **6. Eliminar Pedido (Soft Delete)**
```http
DELETE /api/orders/123
x-api-key: norte-erp-api-key-2024
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pedido eliminado exitosamente",
  "timestamp": "2024-10-12T15:20:00Z"
}
```

**Nota:** Solo se pueden eliminar pedidos en estado `pendiente_preparacion`.

---

## 📊 **ESTADÍSTICAS Y REPORTES**

### **7. Obtener Estadísticas**
```http
GET /api/orders/stats
x-api-key: norte-erp-api-key-2024
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Estadísticas obtenidas exitosamente",
  "data": {
    "total_orders": 150,
    "pending_preparation": 25,
    "ready_for_dispatch": 18,
    "in_process": 12,
    "completed": 85,
    "cancelled": 10,
    "total_value": 4500000.00,
    "average_order_value": 30000.00,
    "orders_without_remito": 18,
    "orders_with_stock_reserved": 35
  },
  "timestamp": "2024-10-12T15:25:00Z"
}
```

---

### **8. Obtener Configuración del Módulo**
```http
GET /api/orders/config
x-api-key: norte-erp-api-key-2024
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Configuración obtenida exitosamente",
  "data": {
    "auto_generate_order_number": true,
    "require_stock_before_approval": true,
    "auto_reserve_stock_on_approval": true,
    "auto_generate_remito_on_ready": true,
    "default_transport_company": "OCA",
    "days_to_complete_order": 7,
    "notify_client_on_status_change": true,
    "notify_logistics_on_ready": true
  },
  "timestamp": "2024-10-12T15:30:00Z"
}
```

---

## 🚀 **OPERACIONES ESPECIALES**

### **9. Obtener Pedidos Listos para Remito**
```http
GET /api/orders/ready-for-remito
x-api-key: norte-erp-api-key-2024
```

**Descripción:** Obtiene todos los pedidos que cumplen con las condiciones para generar remito automáticamente:
- Estado: `listo_despacho`, `pagado`, o `aprobado`
- Estado de remito: `sin_remito`
- Stock reservado: `true`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pedidos listos para remito obtenidos exitosamente",
  "data": [
    {
      "id": 123,
      "order_number": "ORD2400001",
      "client_name": "Cortinas Sur S.A.",
      "status": "listo_despacho",
      "remito_status": "sin_remito",
      "stock_reserved": true,
      "items": [...]
    }
  ],
  "timestamp": "2024-10-12T15:35:00Z"
}
```

---

### **10. Reservar Stock para Pedido**
```http
POST /api/orders/123/reserve-stock
x-api-key: norte-erp-api-key-2024
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Stock reservado exitosamente",
  "data": {
    "orderId": 123
  },
  "timestamp": "2024-10-12T15:40:00Z"
}
```

---

### **11. Actualizar Estado de Remito**
```http
PUT /api/orders/123/remito-status
Content-Type: application/json
x-api-key: norte-erp-api-key-2024
```

**Request Body:**
```json
{
  "remitoStatus": "remito_generado"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Estado de remito actualizado exitosamente",
  "data": {
    "orderId": 123,
    "remitoStatus": "remito_generado"
  },
  "timestamp": "2024-10-12T15:45:00Z"
}
```

---

## 🔄 **ESTADOS DEL PEDIDO**

### **Estados Principales:**
1. **`pendiente_preparacion`**: Pedido recibido, no preparado
2. **`listo_despacho`**: Pedido listo para generar remito
3. **`pagado`**: Pedido pagado (mayoristas con cuenta corriente)
4. **`aprobado`**: Pedido aprobado administrativamente
5. **`en_proceso`**: Pedido en fabricación/preparación
6. **`completado`**: Pedido completado y entregado
7. **`cancelado`**: Pedido cancelado

### **Transiciones de Estado Válidas:**
```
pendiente_preparacion → listo_despacho, aprobado, en_proceso, cancelado
aprobado → listo_despacho, en_proceso, cancelado
en_proceso → listo_despacho, completado, cancelado
listo_despacho → completado, cancelado
completado → (final)
cancelado → (final)
```

---

## 🏷️ **ESTADOS DE REMITO**

1. **`sin_remito`**: No tiene remito generado
2. **`remito_generado`**: Tiene remito pero no despachado
3. **`remito_despachado`**: Remito en tránsito
4. **`remito_entregado`**: Remito entregado al cliente

---

## 🔗 **INTEGRACIÓN CON MÓDULO DE LOGÍSTICA**

### **Flujo de Generación Automática de Remito:**

1. **Crear Pedido** → Estado: `pendiente_preparacion`
2. **Cambiar a** `listo_despacho` → Stock se reserva automáticamente
3. **Trigger N8N** → Detecta pedido listo con stock reservado
4. **N8N llama a** `POST /api/logistics/n8n/generate-from-order`
5. **Se crea Remito** → Estado del pedido cambia a `remito_status: remito_generado`
6. **Logística despacha** → `remito_status: remito_despachado`
7. **Cliente recibe** → `remito_status: remito_entregado`, `status: completado`

---

## 📝 **ESTRUCTURA DE LA BASE DE DATOS**

### **Tabla: `orders`**
```sql
CREATE TABLE orders (
    id INT PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE,
    client_id INT,
    status ENUM(...),
    total_amount DECIMAL(12,2),
    order_date TIMESTAMP,
    delivery_date TIMESTAMP,
    delivery_address TEXT,
    delivery_city VARCHAR(100),
    delivery_contact VARCHAR(100),
    delivery_phone VARCHAR(20),
    transport_company VARCHAR(100),
    transport_cost DECIMAL(10,2),
    notes TEXT,
    remito_status ENUM(...),
    stock_reserved BOOLEAN,
    is_active BOOLEAN,
    created_by INT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### **Tabla: `order_items`**
```sql
CREATE TABLE order_items (
    id INT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    batch_number VARCHAR(50),
    notes TEXT,
    stock_reserved BOOLEAN,
    created_at TIMESTAMP
);
```

---

## 🚀 **MIGRACIÓN DE BASE DE DATOS**

Para crear las tablas necesarias, ejecuta:

```bash
mysql -u root -p norte_erp < src/database/migration_orders.sql
```

---

## 🎯 **CASOS DE USO**

### **Caso 1: Pedido Minorista Simple**
```javascript
// 1. Crear pedido
POST /api/orders
{
  "client_id": 5,
  "status": "pendiente_preparacion",
  "items": [...]
}

// 2. Aprobar y preparar
PUT /api/orders/123
{
  "status": "listo_despacho"
}
// → Stock se reserva automáticamente

// 3. N8N genera remito automáticamente
// 4. Logística despacha
// 5. Cliente recibe
```

### **Caso 2: Pedido Mayorista con Cuenta Corriente**
```javascript
// 1. Crear pedido
POST /api/orders
{
  "client_id": 10,
  "status": "aprobado",
  "items": [...]
}

// 2. Cliente paga
PUT /api/orders/124
{
  "status": "pagado"
}

// 3. Cambiar a listo para despacho
PUT /api/orders/124
{
  "status": "listo_despacho"
}

// 4. N8N genera remito
// 5. Logística procesa
```

---

## ⚙️ **CONFIGURACIÓN RECOMENDADA**

### **Variables de Entorno:**
```env
# Base de datos
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=norte_erp

# API
API_KEY=norte-erp-api-key-2024
PORT=3000

# Configuración de pedidos
AUTO_GENERATE_ORDER_NUMBER=true
AUTO_RESERVE_STOCK=true
AUTO_GENERATE_REMITO=true
```

---

## 📞 **SOPORTE Y CONTACTO**

**Desarrollado por**: Equipo Norte ERP
**Versión**: 1.0.0
**Última actualización**: 12 de octubre de 2024

---

**🎉 ¡El módulo de Pedidos está listo para usar! Ahora puedes gestionar todo el ciclo de vida de tus pedidos desde la creación hasta la entrega, con integración completa al módulo de Logística.**

