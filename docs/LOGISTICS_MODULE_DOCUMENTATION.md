# 📦 MÓDULO DE LOGÍSTICA - NORTE ERP

## 🎯 **RESUMEN EJECUTIVO**

El **Módulo de Logística** es el corazón del sistema de remitos y trazabilidad del ERP Norte Abanicos. Este módulo gestiona todo el flujo logístico desde la generación del remito hasta la entrega final, proporcionando trazabilidad completa y control de stock en tiempo real.

---

## 🏗️ **ARQUITECTURA DEL MÓDULO**

### **Componentes Principales**
```
┌─────────────────────────────────────────────────┐
│              MÓDULO DE LOGÍSTICA                │
├─────────────────────────────────────────────────┤
│  📋 Remitos         │  🔍 Trazabilidad         │
│  📦 Stock Movements │  🚚 Transporte           │
│  📊 Estadísticas    │  ⚙️ Configuración        │
└─────────────────────────────────────────────────┘
```

### **Flujo de Datos**
```
Pedido → Remito → Trazabilidad → Stock Movement → Entrega
   ↓         ↓           ↓              ↓           ↓
  API    Database    Tracking      Inventory    Delivery
```

---

## 📊 **ESQUEMA DE BASE DE DATOS**

### **Tablas Principales**

#### **1. remitos**
```sql
- id (PK)
- remito_number (UNIQUE)
- order_id (FK → orders)
- client_id (FK → clients)
- remito_type (entrega_cliente, traslado_interno, devolucion, consignacion)
- status (generado, preparando, listo_despacho, en_transito, entregado, devuelto, cancelado)
- generation_date, preparation_date, dispatch_date, delivery_date
- delivery_address, delivery_city, delivery_contact, delivery_phone
- transport_company, tracking_number, transport_cost
- total_products, total_quantity, total_value
- preparation_notes, delivery_notes, signature_data, delivery_photo
- created_by, delivered_by, is_active
```

#### **2. remito_items**
```sql
- id (PK)
- remito_id (FK → remitos)
- product_id (FK → products)
- quantity, unit_price, total_price
- status (preparado, parcial, completo, devuelto)
- prepared_quantity, delivered_quantity, returned_quantity
- batch_number, serial_numbers (JSON), expiration_date
- notes
```

#### **3. trazabilidad**
```sql
- id (PK)
- remito_id (FK → remitos)
- product_id (FK → products)
- stage (fabricacion, control_calidad, almacenamiento, preparacion, despacho, transito, entrega, devuelto)
- location, location_details, responsible_person, responsible_user_id
- stage_start, stage_end, duration_minutes
- temperature, humidity, quality_check, quality_notes
- vehicle_plate, driver_name, driver_phone
- notes, photos (JSON), documents (JSON)
- is_automatic
```

#### **4. stock_movements**
```sql
- id (PK)
- product_id (FK → products)
- movement_type (salida_remito, entrada_devolucion, traslado_interno, ajuste_inventario)
- remito_id (FK → remitos)
- reference_number, reference_type
- quantity, unit_cost, total_cost
- from_location, to_location
- batch_number, notes
- created_by
```

#### **5. delivery_zones**
```sql
- id (PK)
- name, description, city, province
- postal_codes (JSON)
- delivery_time_days, delivery_cost, free_delivery_minimum
- is_active
```

#### **6. transport_companies**
```sql
- id (PK)
- name, contact_person, email, phone, address
- services (JSON), coverage_zones (JSON), rates (JSON)
- is_active
```

---

## 🔌 **ENDPOINTS API**

### **📋 Gestión de Remitos**

#### **Crear Remito**
```http
POST /api/logistics/remitos
Authorization: Bearer <token>
Content-Type: application/json

{
  "order_id": 123,
  "client_id": 456,
  "remito_type": "entrega_cliente",
  "delivery_address": "Av. Corrientes 1234",
  "delivery_city": "CABA",
  "delivery_contact": "Juan Pérez",
  "delivery_phone": "11-1234-5678",
  "transport_company": "OCA",
  "transport_cost": 500.00,
  "preparation_notes": "Manejar con cuidado",
  "items": [
    {
      "product_id": 789,
      "quantity": 5,
      "unit_price": 1500.00,
      "batch_number": "LOT-2024-001",
      "notes": "Producto frágil"
    }
  ]
}
```

#### **Obtener Remito por ID**
```http
GET /api/logistics/remitos/123
Authorization: Bearer <token>
```

#### **Obtener Remito por Número**
```http
GET /api/logistics/remitos/number/REM24001
Authorization: Bearer <token>
```

#### **Listar Remitos con Filtros**
```http
GET /api/logistics/remitos?status=en_transito&client_id=456&page=1&limit=10
Authorization: Bearer <token>
```

#### **Actualizar Remito**
```http
PUT /api/logistics/remitos/123
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "en_transito",
  "tracking_number": "OCA123456789",
  "transport_company": "OCA"
}
```

#### **Eliminar Remito**
```http
DELETE /api/logistics/remitos/123
Authorization: Bearer <token>
```

### **🔍 Trazabilidad**

#### **Crear Entrada de Trazabilidad**
```http
POST /api/logistics/trazabilidad
Authorization: Bearer <token>
Content-Type: application/json

{
  "remito_id": 123,
  "product_id": 789,
  "stage": "despacho",
  "location": "Depósito Central",
  "location_details": "Sector A, Estante 5",
  "responsible_person": "María García",
  "responsible_user_id": 10,
  "vehicle_plate": "ABC123",
  "driver_name": "Carlos López",
  "driver_phone": "11-9876-5432",
  "notes": "Producto embalado correctamente",
  "photos": ["https://storage.com/photo1.jpg"],
  "documents": ["https://storage.com/doc1.pdf"]
}
```

#### **Obtener Trazabilidad de Remito**
```http
GET /api/logistics/remitos/123/trazabilidad
Authorization: Bearer <token>
```

### **📊 Estadísticas**

#### **Obtener Estadísticas del Módulo**
```http
GET /api/logistics/stats
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "total_remitos": 1250,
    "pending_delivery": 45,
    "in_transit": 12,
    "delivered_today": 8,
    "delayed_deliveries": 3,
    "total_value": 125000.50,
    "average_delivery_time": 48.5
  }
}
```

### **⚙️ Configuración**

#### **Obtener Zonas de Entrega**
```http
GET /api/logistics/zones
Authorization: Bearer <token>
```

#### **Obtener Empresas de Transporte**
```http
GET /api/logistics/transport-companies
Authorization: Bearer <token>
```

#### **Obtener Configuración**
```http
GET /api/logistics/config
Authorization: Bearer <token>
```

---

## 🔄 **OPERACIONES ESPECÍFICAS**

### **Preparar Remito**
```http
PUT /api/logistics/remitos/123/prepare
Authorization: Bearer <token>
```

### **Despachar Remito**
```http
PUT /api/logistics/remitos/123/dispatch
Authorization: Bearer <token>
Content-Type: application/json

{
  "tracking_number": "OCA123456789",
  "transport_company": "OCA"
}
```

### **Entregar Remito**
```http
PUT /api/logistics/remitos/123/deliver
Authorization: Bearer <token>
Content-Type: application/json

{
  "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "delivery_photo": "https://storage.com/delivery123.jpg",
  "delivery_notes": "Cliente satisfecho con la entrega"
}
```

### **Seguimiento Público**
```http
GET /api/logistics/public/tracking/REM24001
# Sin autenticación - para clientes
```

---

## 🤖 **INTEGRACIÓN CON N8N**

### **Endpoints Específicos para N8N**

#### **Generar Remito desde Pedido**
```http
POST /api/logistics/n8n/generate-from-order
x-api-key: norte-erp-api-key-2024
Content-Type: application/json

{
  "orderId": 123
}
```

#### **Actualizar Estado desde N8N**
```http
PUT /api/logistics/n8n/update-status
x-api-key: norte-erp-api-key-2024
Content-Type: application/json

{
  "remitoId": 123,
  "status": "entregado",
  "trackingData": {
    "delivery_time": "2024-01-15T14:30:00Z",
    "delivery_location": "CABA",
    "signature_received": true
  }
}
```

#### **Obtener Datos para Sincronización**
```http
GET /api/logistics/n8n/sync-data?status=en_transito&limit=50
x-api-key: norte-erp-api-key-2024
```

---

## 🔄 **FLUJO DE TRABAJO IMPLEMENTADO (MODELO HÍBRIDO CONTROLADO)**

### **🚀 Flujo Recomendado por el Cliente**
```
Ingreso Pedido → "Pendiente de preparación" → "Listo para despacho" → Remito Automático → "Entregado" → Facturación
```

### **1. Ingreso del Pedido**
```
Cualquier Canal (Web/Vendedor/Manual) → Estado: "Pendiente de preparación"
```

### **2. Validación para Generar Remito**
```
Pedido → Estado: "Listo para despacho" + Stock Reservado → Trigger N8N
```

### **3. Generación Automática de Remito**
```
N8N Workflow → POST /api/logistics/n8n/generate-from-order
              ↓
Validaciones:
• Pedido existe y está en estado válido
• No existe remito previo para este pedido  
• Stock reservado disponible
• Cliente activo
              ↓
Remito Creado Automáticamente
              ↓
Notificación a Logística
```

### **4. Preparación en Depósito**
```
Operador → PUT /api/logistics/remitos/123/prepare
         ↓
Estado: preparando
         ↓
POST /api/logistics/trazabilidad (stage: preparacion)
         ↓
Stock Movement: Salida de Inventario
```

### **5. Despacho**
```
Operador → PUT /api/logistics/remitos/123/dispatch
         ↓
Estado: en_transito
         ↓
Tracking Number Asignado
         ↓
POST /api/logistics/trazabilidad (stage: despacho)
         ↓
Notificación WhatsApp al Cliente
```

### **6. Seguimiento en Tránsito**
```
N8N Workflow (cada 30 min) → PUT /api/logistics/n8n/update-status
                            ↓
POST /api/logistics/trazabilidad (stage: transito)
                            ↓
Actualización Dashboard en Tiempo Real
```

### **7. Entrega**
```
Transportista → PUT /api/logistics/remitos/123/deliver
              ↓
Estado: entregado
              ↓
POST /api/logistics/trazabilidad (stage: entrega)
              ↓
N8N Workflow → Facturación Automática
              ↓
Email con Factura al Cliente
```

### **🎯 Beneficios del Flujo Implementado**

#### **✅ Evita Remitos Falsos o Duplicados**
- Solo genera remitos cuando el pedido está **realmente listo**
- Valida stock reservado antes de crear el remito
- Previene duplicados automáticamente

#### **✅ Mantiene Stock Real y Trazabilidad Limpia**
- Stock se actualiza automáticamente al generar remito
- Trazabilidad completa de movimientos
- Control de inventario en tiempo real

#### **✅ Refleja la Realidad Operativa**
- No todo pedido implica entrega inmediata
- Estados claros: pendiente → listo → remito → entregado
- Flujo natural del negocio

#### **✅ Facilita los Reportes**
- Sabes exactamente cuántos pedidos están en proceso, listos o entregados
- Métricas precisas de eficiencia logística
- Dashboard actualizado automáticamente

---

## 📊 **TRIGGERS Y AUTOMATIZACIÓN**

### **Triggers de Base de Datos**

#### **Actualización Automática de Stock**
```sql
-- Se ejecuta automáticamente al crear items de remito
TRIGGER tr_remito_stock_update
AFTER INSERT ON remito_items
FOR EACH ROW
BEGIN
    UPDATE products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
    INSERT INTO stock_movements (...) VALUES (...);
END
```

#### **Actualización de Totales del Remito**
```sql
-- Se ejecuta automáticamente al modificar items
TRIGGER tr_remito_totals_update
AFTER INSERT ON remito_items
FOR EACH ROW
BEGIN
    UPDATE remitos SET 
        total_products = (SELECT COUNT(*) FROM remito_items WHERE remito_id = NEW.remito_id),
        total_quantity = (SELECT SUM(quantity) FROM remito_items WHERE remito_id = NEW.remito_id),
        total_value = (SELECT SUM(total_price) FROM remito_items WHERE remito_id = NEW.remito_id)
    WHERE id = NEW.remito_id;
END
```

---

## 🔒 **SEGURIDAD Y PERMISOS**

### **Autenticación Requerida**
- **JWT Token**: Para operaciones administrativas
- **API Key**: Para integraciones con N8N
- **Sin Autenticación**: Solo para seguimiento público

### **Roles y Permisos**
```typescript
enum LogisticsPermissions {
  CREATE_REMITO = 'logistics:create_remito',
  UPDATE_REMITO = 'logistics:update_remito',
  DELETE_REMITO = 'logistics:delete_remito',
  VIEW_TRACKING = 'logistics:view_tracking',
  MANAGE_CONFIG = 'logistics:manage_config'
}
```

---

## 📈 **MÉTRICAS Y KPIs**

### **Métricas Principales**
- **Tiempo de Preparación**: Desde generación hasta listo para despacho
- **Tiempo de Tránsito**: Desde despacho hasta entrega
- **Tasa de Entrega Exitosa**: Porcentaje de entregas sin problemas
- **Satisfacción del Cliente**: Basada en tiempo de entrega
- **Eficiencia de Stock**: Movimientos de inventario automáticos

### **Reportes Disponibles**
- **Dashboard Logístico**: Estado general del módulo
- **Reporte de Entregas**: Por período, cliente, zona
- **Análisis de Trazabilidad**: Tiempos por etapa
- **Control de Stock**: Movimientos por remitos

---

## 🚀 **PRÓXIMOS DESARROLLOS**

### **Fase 2 - Mejoras Planeadas**
- 📱 **App Móvil**: Para operadores de depósito
- 🗺️ **Tracking GPS**: Integración con mapas
- 🤖 **Chatbot**: Atención automática de consultas
- 📊 **BI Dashboard**: Análisis avanzado
- 🔔 **Notificaciones Push**: Alertas en tiempo real

### **Integraciones Futuras**
- 📦 **MercadoLibre**: Sincronización de envíos
- 🚚 **Empresas de Logística**: APIs directas
- 💳 **Sistemas de Pago**: Integración con cobranzas
- 📧 **Email Marketing**: Seguimiento post-venta

---

## 🛠️ **INSTALACIÓN Y CONFIGURACIÓN**

### **1. Ejecutar Migración de Base de Datos**
```bash
mysql -u username -p norte_erp_db < src/database/migration_logistics.sql
```

### **2. Configurar Variables de Entorno**
```env
# Logística
LOGISTICS_AUTO_GENERATE_REMITO=true
LOGISTICS_REQUIRE_SIGNATURE=true
LOGISTICS_TRACKING_ENABLED=true
LOGISTICS_AUTO_UPDATE_STOCK=true
LOGISTICS_DEFAULT_TRANSPORT_COMPANY=1
LOGISTICS_REMITO_NUMBER_PREFIX=REM
LOGISTICS_MAX_DELIVERY_DAYS=7
LOGISTICS_QUALITY_CHECK_REQUIRED=true
```

### **3. Configurar N8N Workflows**
- Importar workflows desde `/n8n-workflows/`
- Configurar webhooks y API keys
- Establecer triggers automáticos

---

## 📞 **SOPORTE Y DOCUMENTACIÓN**

### **Recursos Disponibles**
- 📚 **Documentación API**: Swagger en `/api/docs`
- 🎥 **Videos Tutoriales**: Canal de YouTube
- 💬 **Soporte Técnico**: support@norteabanicos.com
- 📖 **Manual de Usuario**: PDF disponible

### **Contacto del Equipo**
- **Desarrollador Principal**: [Tu Nombre]
- **Email**: [tu-email@norteabanicos.com]
- **Teléfono**: [Tu teléfono]

---

**🎯 El Módulo de Logística transforma la gestión de remitos de un proceso manual y propenso a errores a un sistema automatizado, trazable y eficiente que proporciona visibilidad completa del flujo logístico.**

**📅 Última actualización**: $(date)
**🔄 Versión**: 1.0.0
**👥 Desarrollado por**: Equipo Norte ERP
