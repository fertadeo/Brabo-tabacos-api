# 🚀 ROADMAP MVP - NORTE ERP + N8N INTEGRATION

## 📋 RESUMEN EJECUTIVO

Este roadmap define la implementación de N8N como plataforma de integración para el ERP Norte Abanicos, enfocándose en tres pilares principales:

1. **Integración WooCommerce Dual** (Mayorista + Minorista)
2. **Sistema de Remitos y Trazabilidad** (Fabricación → Depósito → Envío)
3. **Gestión de Cuentas Corrientes** Automatizada

---

## 🎯 OBJETIVOS DEL PROYECTO

### **Objetivos Primarios**
- ✅ Automatizar sincronización entre ERP y WooCommerce
- ✅ Implementar trazabilidad completa del producto
- ✅ Generar cuentas corrientes automáticamente
- ✅ Reducir errores manuales en 90%
- ✅ Acelerar procesos de venta en 70%

### **Objetivos Secundarios**
- 🔄 Escalabilidad para futuros ERPs
- 📊 Dashboard de integraciones en tiempo real
- 🔒 Seguridad y auditoría completa
- 📱 Notificaciones automáticas

---

## 🏗️ ARQUITECTURA ACTUAL ANALIZADA

### **Base de Datos Existente**
```sql
-- Entidades principales identificadas:
- users (autenticación)
- clients (con client_type: mayorista/minorista)
- products (catálogo completo)
- orders + order_items (pedidos)
- production_orders (órdenes de producción)
- purchases + purchase_items (compras)
- budgets + budget_items (presupuestos)
- suppliers (proveedores)
- personnel (empleados)
```

### **API Endpoints Disponibles**
```typescript
// Endpoints actuales documentados:
- GET /api/woocommerce/products
- POST /api/woocommerce/products/sync
- PUT /api/woocommerce/products/:sku/stock
- POST /api/integration/webhook/woocommerce
- GET /api/integration/stock/summary
```

---

## 🔄 FASE 1: INTEGRACIÓN WOOCOMMERCE DUAL

### **1.1 Sincronización Mayorista**

#### **Workflow N8N: "ERP → WooCommerce Mayorista"**
```
Trigger: Cron (cada 30 minutos)
├── HTTP Request: GET /api/woocommerce/products
├── Filter: Solo productos activos con stock > 0
├── Transform: Aplicar descuentos mayoristas (20-30%)
├── WooCommerce: Update/Create products
└── HTTP Request: POST /api/integration/log (registro)
```

#### **Workflow N8N: "WooCommerce Mayorista → ERP"**
```
Trigger: Webhook (nueva orden)
├── WooCommerce: Get order details
├── HTTP Request: POST /api/orders (crear pedido)
├── HTTP Request: PUT /api/products/stock (actualizar stock)
├── Slack: Notificar nueva orden mayorista
└── Email: Enviar confirmación al cliente
```

### **1.2 Sincronización Minorista**

#### **Workflow N8N: "ERP → WooCommerce Minorista"**
```
Trigger: Cron (cada 15 minutos)
├── HTTP Request: GET /api/woocommerce/products
├── Filter: Productos con precios minoristas
├── Transform: Aplicar márgenes minoristas
├── WooCommerce: Update/Create products
└── HTTP Request: POST /api/integration/log
```

#### **Workflow N8N: "WooCommerce Minorista → ERP"**
```
Trigger: Webhook (orden completada)
├── WooCommerce: Get completed order
├── HTTP Request: POST /api/orders
├── HTTP Request: PUT /api/products/stock
├── WhatsApp: Notificar cliente minorista
└── Generate: Remito automático
```

### **1.3 Sincronización Bidireccional de Stock**

#### **Workflow N8N: "Stock Sync Master"**
```
Trigger: Cron (cada 5 minutos)
├── HTTP Request: GET /api/integration/stock/summary
├── Split: Dividir por tienda
├── WooCommerce Mayorista: Update stock
├── WooCommerce Minorista: Update stock
├── HTTP Request: POST /api/integration/sync-report
└── Slack: Reporte de sincronización
```

---

## 📦 FASE 2: SISTEMA DE REMITOS Y TRAZABILIDAD

### **2.1 Nuevas Tablas de Base de Datos**

#### **Tabla: remitos**
```sql
CREATE TABLE remitos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    remito_number VARCHAR(20) UNIQUE NOT NULL,
    order_id INT NOT NULL,
    client_id INT NOT NULL,
    status ENUM('generado', 'en_fabricacion', 'en_deposito', 'despachado', 'entregado') DEFAULT 'generado',
    fabrication_start DATE,
    fabrication_end DATE,
    warehouse_entry DATE,
    dispatch_date DATE,
    delivery_date DATE,
    tracking_number VARCHAR(50),
    transport_company VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);
```

#### **Tabla: remito_items**
```sql
CREATE TABLE remito_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    remito_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    production_status ENUM('pendiente', 'en_produccion', 'completado') DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (remito_id) REFERENCES remitos(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

#### **Tabla: trazabilidad**
```sql
CREATE TABLE trazabilidad (
    id INT AUTO_INCREMENT PRIMARY KEY,
    remito_id INT NOT NULL,
    product_id INT NOT NULL,
    stage ENUM('fabricacion', 'deposito', 'despacho', 'entrega') NOT NULL,
    location VARCHAR(100),
    responsible_person VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (remito_id) REFERENCES remitos(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### **2.2 Workflows de Trazabilidad**

#### **Workflow N8N: "Generar Remito Automático"**
```
Trigger: Webhook (orden aprobada)
├── HTTP Request: POST /api/remitos (crear remito)
├── HTTP Request: POST /api/production-orders (crear orden producción)
├── Slack: Notificar inicio de producción
├── Email: Enviar remito al cliente
└── HTTP Request: POST /api/trazabilidad (registrar etapa)
```

#### **Workflow N8N: "Actualizar Estado Producción"**
```
Trigger: Cron (cada hora)
├── HTTP Request: GET /api/production-orders/active
├── Filter: Órdenes completadas
├── HTTP Request: PUT /api/remitos/:id (actualizar estado)
├── HTTP Request: POST /api/trazabilidad (registrar completado)
├── Slack: Notificar producción completada
└── HTTP Request: POST /api/warehouse/entry (ingreso depósito)
```

#### **Workflow N8N: "Control de Depósito"**
```
Trigger: Manual (operador depósito)
├── HTTP Request: GET /api/remitos/en-deposito
├── Form: Confirmar ingreso a depósito
├── HTTP Request: PUT /api/remitos/:id (estado: en_deposito)
├── HTTP Request: POST /api/trazabilidad (registrar depósito)
├── Generate: QR Code para tracking
└── Email: Enviar código tracking al cliente
```

#### **Workflow N8N: "Despacho y Entrega"**
```
Trigger: Manual (operador logística)
├── Form: Seleccionar remito para despacho
├── HTTP Request: PUT /api/remitos/:id (estado: despachado)
├── HTTP Request: POST /api/trazabilidad (registrar despacho)
├── Generate: Etiqueta envío
├── WhatsApp: Notificar cliente con tracking
└── HTTP Request: POST /api/transport/register (registrar envío)
```

---

## 💰 FASE 3: GESTIÓN DE CUENTAS CORRIENTES

### **3.1 Nuevas Tablas de Base de Datos**

#### **Tabla: cuentas_corrientes**
```sql
CREATE TABLE cuentas_corrientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    credit_limit DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_terms INT NOT NULL DEFAULT 30, -- días
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
);
```

#### **Tabla: movimientos_cc**
```sql
CREATE TABLE movimientos_cc (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cuenta_corriente_id INT NOT NULL,
    type ENUM('debito', 'credito') NOT NULL, -- débito = debe, crédito = paga
    amount DECIMAL(10,2) NOT NULL,
    reference_type ENUM('order', 'payment', 'adjustment') NOT NULL,
    reference_id INT,
    description VARCHAR(255),
    due_date DATE,
    payment_date DATE NULL,
    status ENUM('pending', 'paid', 'overdue') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cuenta_corriente_id) REFERENCES cuentas_corrientes(id)
);
```

### **3.2 Workflows de Cuentas Corrientes**

#### **Workflow N8N: "Crear Cuenta Corriente"**
```
Trigger: Webhook (nuevo cliente mayorista)
├── HTTP Request: POST /api/cuentas-corrientes (crear cuenta)
├── HTTP Request: PUT /api/clients/:id (asignar límite crédito)
├── Email: Enviar términos y condiciones
└── Slack: Notificar nueva cuenta corriente
```

#### **Workflow N8N: "Registrar Venta en CC"**
```
Trigger: Webhook (orden completada)
├── HTTP Request: POST /api/movimientos-cc (registrar débito)
├── HTTP Request: PUT /api/cuentas-corrientes/:id (actualizar balance)
├── IF: Balance > Límite crédito
│   ├── Email: Notificar límite excedido
│   ├── Slack: Alerta administración
│   └── HTTP Request: PUT /api/orders/:id (bloquear órdenes)
└── Email: Enviar factura al cliente
```

#### **Workflow N8N: "Registrar Pago"**
```
Trigger: Webhook (pago recibido)
├── HTTP Request: POST /api/movimientos-cc (registrar crédito)
├── HTTP Request: PUT /api/cuentas-corrientes/:id (actualizar balance)
├── HTTP Request: PUT /api/orders/:id (desbloquear órdenes si corresponde)
├── Email: Confirmar pago al cliente
└── Generate: Recibo de pago
```

#### **Workflow N8N: "Control de Vencimientos"**
```
Trigger: Cron (diario a las 9:00 AM)
├── HTTP Request: GET /api/movimientos-cc/vencidos
├── Filter: Movimientos vencidos por más de 7 días
├── Email: Recordatorio de pago (cliente)
├── Slack: Reporte vencimientos (administración)
├── HTTP Request: PUT /api/orders/:id (bloquear nuevas órdenes)
└── HTTP Request: POST /api/reports/aging (generar reporte)
```

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### **4.1 Nuevos Endpoints API Requeridos**

#### **Remitos**
```typescript
// POST /api/remitos
// GET /api/remitos/:id
// PUT /api/remitos/:id
// GET /api/remitos/client/:client_id
// GET /api/remitos/status/:status

// POST /api/remitos/:id/update-status
// POST /api/trazabilidad
// GET /api/trazabilidad/remito/:remito_id
```

#### **Cuentas Corrientes**
```typescript
// POST /api/cuentas-corrientes
// GET /api/cuentas-corrientes/:client_id
// PUT /api/cuentas-corrientes/:id
// POST /api/movimientos-cc
// GET /api/movimientos-cc/client/:client_id
// GET /api/movimientos-cc/vencidos
```

### **4.2 Configuración N8N**

#### **Variables de Entorno N8N**
```env
# ERP API
ERP_API_URL=https://api.norteabanicos.com
ERP_API_KEY=norte-erp-api-key-2024

# WooCommerce Mayorista
WC_MAYORISTA_URL=https://mayorista.norteabanicos.com
WC_MAYORISTA_KEY=ck_xxx
WC_MAYORISTA_SECRET=cs_xxx

# WooCommerce Minorista
WC_MINORISTA_URL=https://tienda.norteabanicos.com
WC_MINORISTA_KEY=ck_yyy
WC_MINORISTA_SECRET=cs_yyy

# Notificaciones
SLACK_WEBHOOK=https://hooks.slack.com/xxx
WHATSAPP_TOKEN=xxx
EMAIL_SMTP=smtp.gmail.com:587
```

### **4.3 Nodos N8N Específicos**

#### **Nodos Personalizados Requeridos**
- **HTTP Request**: Para comunicación con ERP
- **WooCommerce**: Para sincronización tiendas
- **Google Sheets**: Para reportes y logs
- **Slack**: Para notificaciones internas
- **WhatsApp Business**: Para notificaciones clientes
- **Email**: Para comunicaciones formales
- **QR Code Generator**: Para códigos de tracking
- **PDF Generator**: Para remitos y facturas

---

## 📊 DASHBOARD DE MONITOREO

### **5.1 Métricas Clave**

#### **KPIs de Integración**
- Tiempo de sincronización stock
- Errores de sincronización por día
- Órdenes procesadas automáticamente
- Tiempo promedio de procesamiento

#### **KPIs de Trazabilidad**
- Tiempo promedio fabricación
- Eficiencia de depósito
- Tiempo de entrega
- Satisfacción del cliente (tracking)

#### **KPIs de Cuentas Corrientes**
- Días promedio de cobro
- Porcentaje de vencimientos
- Límite de crédito utilizado
- Flujo de caja proyectado

### **5.2 Dashboard N8N**

#### **Workflow N8N: "Dashboard Metrics"**
```
Trigger: Cron (cada hora)
├── HTTP Request: GET /api/integration/metrics
├── HTTP Request: GET /api/remitos/stats
├── HTTP Request: GET /api/cuentas-corrientes/stats
├── Google Sheets: Update metrics dashboard
├── Slack: Send hourly summary
└── HTTP Request: POST /api/alerts/check
```

---

## 🚀 CRONOGRAMA DE IMPLEMENTACIÓN

### **Semana 1-2: Preparación**
- ✅ Análisis completo del proyecto actual
- 🔄 Crear nuevas tablas de base de datos
- 🔄 Desarrollar nuevos endpoints API
- 🔄 Configurar servidor N8N

### **Semana 3-4: WooCommerce Integration**
- 🔄 Implementar workflows de sincronización
- 🔄 Configurar webhooks bidireccionales
- 🔄 Testing de sincronización stock
- 🔄 Configurar notificaciones

### **Semana 5-6: Sistema de Remitos**
- 🔄 Implementar workflows de trazabilidad
- 🔄 Desarrollar generación automática de remitos
- 🔄 Integrar con sistema de producción
- 🔄 Configurar tracking y notificaciones

### **Semana 7-8: Cuentas Corrientes**
- 🔄 Implementar gestión automática de CC
- 🔄 Configurar control de vencimientos
- 🔄 Desarrollar reportes de aging
- 🔄 Integrar con sistema de pagos

### **Semana 9-10: Testing y Optimización**
- 🔄 Testing integral de todos los workflows
- 🔄 Optimización de performance
- 🔄 Configuración de alertas y monitoreo
- 🔄 Documentación completa

---

## 💡 VENTAJAS DE N8N vs MAKE

### **N8N - Ventajas**
- ✅ **Open Source**: Sin costos de licencia
- ✅ **Self-hosted**: Control total de datos
- ✅ **Extensible**: Nodos personalizados
- ✅ **Escalable**: Para múltiples ERPs futuros
- ✅ **Integración nativa**: Con bases de datos
- ✅ **API propia**: Para integraciones avanzadas

### **Make - Limitaciones**
- ❌ **Costos**: $9-29/mes por usuario
- ❌ **Dependencia**: Servicio externo
- ❌ **Limitaciones**: En operaciones complejas
- ❌ **Escalabilidad**: Limitada para múltiples proyectos

---

## 🔒 SEGURIDAD Y COMPLIANCE

### **6.1 Medidas de Seguridad**
- 🔐 Autenticación API con JWT
- 🔐 Webhooks con secret validation
- 🔐 Encriptación de datos sensibles
- 🔐 Logs de auditoría completos
- 🔐 Backup automático de workflows

### **6.2 Cumplimiento Normativo**
- 📋 Registro de trazabilidad completo
- 📋 Comprobantes fiscales automáticos
- 📋 Reportes de AFIP
- 📋 Historial de movimientos CC

---

## 📈 ESCALABILIDAD FUTURA

### **7.1 Preparación para Múltiples ERPs**
- 🏗️ **Arquitectura modular**: Workflows reutilizables
- 🏗️ **Configuración por cliente**: Variables dinámicas
- 🏗️ **Templates**: Para nuevos proyectos
- 🏗️ **API Gateway**: Centralizado para múltiples ERPs

### **7.2 Integraciones Futuras Planificadas**
- 📦 **MercadoLibre**: Sincronización automática
- 📦 **Amazon**: Marketplace integration
- 📦 **Sistema contable**: Integración con Tango
- 📦 **CRM**: Salesforce/HubSpot integration
- 📦 **WhatsApp Business**: Chatbots automáticos

---

## 💰 ESTIMACIÓN DE COSTOS

### **Costos de Desarrollo**
- **Desarrollo API**: 40 horas × $50 = $2,000
- **Configuración N8N**: 60 horas × $50 = $3,000
- **Testing y QA**: 20 horas × $50 = $1,000
- **Documentación**: 10 horas × $50 = $500

**Total Desarrollo**: $6,500

### **Costos Operativos Mensuales**
- **Servidor N8N**: $50/mes
- **Base de datos**: $30/mes
- **Notificaciones**: $20/mes
- **Monitoreo**: $15/mes

**Total Operativo**: $115/mes

### **ROI Estimado**
- **Reducción errores**: 90% = $2,000/mes ahorro
- **Aceleración procesos**: 70% = $1,500/mes ahorro
- **Automatización**: 80% tiempo = $3,000/mes ahorro

**ROI Mensual**: $6,615 - $115 = **$6,500/mes**

---

## 🎯 PRÓXIMOS PASOS INMEDIATOS

### **Acciones Inmediatas (Esta Semana)**
1. ✅ **Aprobar roadmap** con el cliente
2. 🔄 **Configurar servidor N8N** (VPS o cloud)
3. 🔄 **Crear nuevas tablas** de base de datos
4. 🔄 **Desarrollar endpoints** de remitos y CC
5. 🔄 **Configurar webhooks** WooCommerce

### **Acciones Siguiente Semana**
1. 🔄 **Implementar workflow** básico de sincronización
2. 🔄 **Configurar notificaciones** Slack/Email
3. 🔄 **Testing** con datos reales
4. 🔄 **Documentar** procesos

---

## 📞 SOPORTE Y MANTENIMIENTO

### **8.1 Plan de Soporte**
- **Horas de desarrollo**: 10 horas/mes incluidas
- **Monitoreo**: 24/7 con alertas automáticas
- **Backup**: Diario automático de workflows
- **Updates**: Mensuales de seguridad

### **8.2 Capacitación**
- **Usuario final**: 4 horas de capacitación
- **Administrador**: 8 horas de capacitación
- **Documentación**: Manual completo
- **Videos**: Tutoriales paso a paso

---

**🚀 Este roadmap posiciona a Norte ERP como una solución integral, escalable y preparada para el futuro, con N8N como el corazón de todas las integraciones.**

**📅 Fecha de creación**: $(date)
**👨‍💻 Desarrollado por**: Asistente AI + Equipo Norte ERP
**🔄 Última actualización**: $(date)
