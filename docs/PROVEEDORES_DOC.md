# 🏭 MÓDULO DE PROVEEDORES - NORTE ERP

## 🎯 **RESUMEN EJECUTIVO**

El **Módulo de Proveedores** gestiona la relación completa con proveedores, diferenciando los **productivos**, **no productivos** y **otros pasivos**, asegurando trazabilidad entre **órdenes de compra**, **facturas**, **remitos** y **pagos**. Este módulo es fundamental para el cálculo de costos de producción y el control financiero de la empresa.

### **📌 Funcionalidades Clave**

✅ **Proveedores Productivos**: Facturas con códigos de materiales, trazabilidad completa OC-Factura-Remito-Pago  
✅ **Proveedores No Productivos**: Facturas sin OC, pagos flexibles, egresos sin factura  
✅ **Otros Pasivos**: Pasivos devengados, control de vencimientos, conciliación con tesorería  
✅ **Compromiso vs Deuda**: Control diferenciado de compromisos y deudas reales  
✅ **Entregas Parciales**: Soporte para recibos parciales de materiales  
✅ **Cuenta Corriente**: Gestión completa de deuda y compromiso por proveedor

---

## 📋 **OBJETIVOS DEL MÓDULO**

1. **Gestionar Proveedores**: Clasificación y administración de proveedores según su tipo
2. **Órdenes de Compra (OC)**: Gestión de presupuestos y órdenes con control de compromiso vs deuda
3. **Facturas de Proveedores**: Registro con códigos de materiales para cálculo de costos
4. **Remitos de Entrega**: Control de recepción de materiales con entregas parciales
5. **Pagos**: Gestión de pagos vinculados o independientes de facturas
6. **Cuenta Corriente**: Control de deuda y compromiso por proveedor
7. **Trazabilidad Completa**: Vinculación OC → Factura → Remito → Pago

---

## 🏷️ **TIPOS DE PROVEEDORES**

### **🔹 Proveedores Productivos**
Proveedores que suministran **insumos o materiales** que impactan **directamente en el costo del producto**.

**Características:**
- Sus facturas afectan el cálculo de costo de producción
- Requieren códigos de materiales en las facturas
- Control estricto de trazabilidad OC-Factura-Remito-Pago

**Ejemplos:**
- Proveedores de motores eléctricos
- Proveedores de aspas
- Proveedores de componentes electrónicos
- Proveedores de materiales para fabricación

### **🔹 Proveedores No Productivos**
Proveedores de servicios o bienes indirectos (fletes, mantenimiento, asesorías, marketing, etc.) que **NO impactan directamente** en el costo del producto.

**Características:**
- Sus facturas no afectan el cálculo de costo de producción
- No requieren códigos de materiales específicos
- **Facturas sin OC**: Puede existir factura sin orden de compra previa
- **Pagos flexibles**: El pago se puede asociar o no directamente a la factura
- **Egresos sin factura**: Posibilidad de registrar compromisos o devengamientos

**Funcionalidades Requeridas:**
1. **Factura / Pago**
   - Factura puede existir sin OC previa (`purchase_id` opcional)
   - Pago se puede asociar o no directamente a la factura
   - Pago puede realizarse antes de recibir la factura

2. **Egresos sin factura**
   - Registrar compromisos o devengamientos (seguros, impuestos, alquileres)
   - Controlar que el egreso quede contabilizado como pasivo pendiente
   - Vinculación opcional con factura posterior

**Requisitos Mínimos:**
- Registro de factura y pago sin necesidad de OC
- Posibilidad de registrar egresos devengados
- Control básico de vencimientos o compromisos

**Ejemplos:**
- Servicios de limpieza
- Servicios de mantenimiento
- Fletes y logística
- Servicios de marketing
- Asesorías y consultorías

### **🔹 Otros Pasivos**
Obligaciones no derivadas de proveedores tradicionales (impuestos, seguros, alquileres, devengamientos contables).

**Características:**
- Gestión de pasivos devengados
- Clasificación por tipo (impuesto, alquiler, seguro, etc.)
- Vinculación con cuenta de tesorería para pago posterior

**Funcionalidades Requeridas:**
1. **Registro de pasivo**
   - Fecha de devengamiento y vencimiento
   - Clasificación por tipo (impuesto, alquiler, seguro, servicio, préstamo, otro)
   - Control de montos pagados y pendientes

2. **Conciliación con tesorería**
   - Posibilidad de vincular pagos realizados desde Tesorería
   - Control de pagos parciales y completos
   - Seguimiento de vencimientos

**Requisitos Mínimos:**
- Registro manual de pasivos devengados
- Vinculación con cuenta de tesorería para pago posterior
- Control de vencimientos y estado de pago

---

## 🏗️ **ARQUITECTURA DEL MÓDULO**

### **Componentes Principales**
```
┌─────────────────────────────────────────────────────┐
│           MÓDULO DE PROVEEDORES                      │
├─────────────────────────────────────────────────────┤
│  👥 Proveedores  │  📋 Órdenes de Compra (OC)       │
│  🧾 Facturas     │  📦 Remitos de Entrega           │
│  💰 Pagos        │  📊 Cuenta Corriente             │
│  🔗 Trazabilidad │  💵 Costos de Producción         │
└─────────────────────────────────────────────────────┘
```

### **Flujo Principal**
```
Proveedor → OC → [Compromiso/Deuda] → Factura → Remito → Pago → Cuenta Corriente
    ↓                                                              ↓
Tipo (Productivo/No Productivo)                          Balance Deuda/Compromiso
    ↓                                                              ↓
Códigos de Materiales                                      Impacto Costos Producción
```

---

## 📊 **ESQUEMA DE BASE DE DATOS**

### **📋 Tablas Existentes (Implementadas)**

#### **1. suppliers** - Proveedores
```sql
- id (PK)
- code (UNIQUE) - Código único del proveedor
- supplier_type ENUM('productivo', 'no_productivo', 'otro_pasivo') - Tipo de proveedor
- name - Nombre del proveedor
- legal_name VARCHAR(255) - Razón Social del Proveedor
- trade_name VARCHAR(255) - Nombre de Fantasía
- purchase_frequency VARCHAR(50) - Frecuencia de Compra (diaria, semanal, mensual, etc.)
- id_type ENUM('CUIT', 'CUIL', 'DNI', 'PASAPORTE', 'OTRO') - Tipo de identificación
- tax_id VARCHAR(20) - CUIT/Número de Identificación
- gross_income VARCHAR(50) - Ingresos Brutos
- vat_condition ENUM('Responsable Inscripto', 'Monotributista', 'Exento', 'No Responsable', 'Consumidor Final') - Condición IVA
- account_description TEXT - Descripción de Cuenta Contable
- product_service TEXT - Producto o Servicio que provee
- integral_summary_account VARCHAR(100) - Cuenta de Resumen Integral
- cost DECIMAL(12,2) - Costo asociado al proveedor
- contact_name - Nombre de contacto
- email - Email de contacto
- phone - Teléfono
- address - Dirección
- city - Ciudad
- country - País (default: 'Argentina')
- has_account BOOLEAN DEFAULT TRUE - Si tiene cuenta corriente habilitada
- payment_terms INT DEFAULT 30 - Términos de pago en días
- is_active - Estado activo/inactivo
- created_at, updated_at
```

#### **2. purchases** - Órdenes de Compra (OC)
```sql
- id (PK)
- purchase_number (UNIQUE) - Número de OC
- supplier_id (FK → suppliers)
- status ENUM('pending', 'received', 'cancelled')
- total_amount - Monto total
- purchase_date - Fecha de la OC
- received_date - Fecha de recepción
- notes - Notas
- created_at, updated_at
```

**⚠️ FALTA IMPLEMENTAR:**
- `debt_type` ENUM('compromiso', 'deuda_directa') - Tipo de deuda
- `commitment_amount` DECIMAL(10,2) - Monto en compromiso
- `debt_amount` DECIMAL(10,2) - Monto en deuda real
- `allows_partial_delivery` BOOLEAN DEFAULT TRUE - Permite entregas parciales
- `confirmed_at` TIMESTAMP - Fecha de confirmación

#### **3. purchase_items** - Items de la OC
```sql
- id (PK)
- purchase_id (FK → purchases)
- product_id (FK → products)
- quantity - Cantidad solicitada
- unit_price - Precio unitario
- total_price - Precio total
- created_at
```

**⚠️ FALTA IMPLEMENTAR:**
- `material_code` VARCHAR(50) - Código del material (clave para costos)
- `received_quantity` INT DEFAULT 0 - Cantidad recibida
- `pending_quantity` INT - Cantidad pendiente (calculado)
- `unit_cost` DECIMAL(10,2) - Costo unitario para producción

#### **4. payments** - Pagos (Existente)
```sql
- id (PK)
- type ENUM('income', 'outflow') - Tipo de pago
- method ENUM('efectivo', 'tarjeta', 'transferencia') - Método
- amount - Monto
- currency - Moneda (default: 'ARS')
- payment_date - Fecha de pago
- status ENUM('draft', 'posted', 'void') - Estado
- payee_type ENUM('supplier', 'employee', 'other', 'client') - Tipo de receptor
- payee_id - ID del receptor
- payee_name - Nombre del receptor
- related_type ENUM('order', 'purchase', 'expense', 'payroll') - Tipo relacionado
- related_id - ID relacionado
- notes - Notas
- created_by, created_at, updated_at
```

**⚠️ FALTA IMPLEMENTAR:**
- `invoice_id` INT NULL (FK → supplier_invoices) - Vinculación directa a factura
- `is_partial_payment` BOOLEAN DEFAULT FALSE - Si es pago parcial
- `remaining_amount` DECIMAL(10,2) - Monto restante de la factura

### **📋 Tablas por Implementar (Pendientes)**

#### **5. supplier_invoices** - Facturas de Proveedores
```sql
CREATE TABLE IF NOT EXISTS supplier_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL, -- Número de factura del proveedor
    supplier_id INT NOT NULL,
    purchase_id INT NULL, -- OC relacionada (opcional al inicio)
    invoice_date DATE NOT NULL,
    due_date DATE NULL, -- Fecha de vencimiento
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    
    -- Estados
    status ENUM('draft', 'received', 'partial_paid', 'paid', 'cancelled') DEFAULT 'received',
    payment_status ENUM('pending', 'partial', 'paid', 'overdue') DEFAULT 'pending',
    
    -- Vinculaciones
    delivery_note_id INT NULL, -- Remito relacionado
    
    -- Control
    notes TEXT,
    file_url VARCHAR(255), -- URL del PDF de la factura
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (purchase_id) REFERENCES purchases(id),
    FOREIGN KEY (delivery_note_id) REFERENCES supplier_delivery_notes(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

#### **6. supplier_invoice_items** - Items de Factura
```sql
CREATE TABLE IF NOT EXISTS supplier_invoice_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    material_code VARCHAR(50) NOT NULL, -- CÓDIGO DEL MATERIAL (CLAVE)
    product_id INT NULL, -- Opcional, vinculación con producto
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Para cálculo de costos
    unit_cost DECIMAL(10,2), -- Costo unitario para producción
    affects_production_cost BOOLEAN DEFAULT TRUE, -- Si afecta costo de producción
    
    -- Vinculación con OC
    purchase_item_id INT NULL, -- Item de OC relacionado
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (invoice_id) REFERENCES supplier_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id)
);
```

#### **7. supplier_delivery_notes** - Remitos de Entrega
```sql
CREATE TABLE IF NOT EXISTS supplier_delivery_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_note_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INT NOT NULL,
    purchase_id INT NOT NULL, -- OC relacionada
    invoice_id INT NULL, -- Factura relacionada (puede ser NULL si se recibe antes)
    
    -- Fechas
    delivery_date DATE NOT NULL,
    received_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Estados
    status ENUM('pending', 'partial', 'complete', 'cancelled') DEFAULT 'pending',
    matches_invoice BOOLEAN DEFAULT FALSE, -- Si coincide con factura
    
    -- Control
    notes TEXT,
    received_by INT, -- Usuario que recibió
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (purchase_id) REFERENCES purchases(id),
    FOREIGN KEY (invoice_id) REFERENCES supplier_invoices(id),
    FOREIGN KEY (received_by) REFERENCES users(id)
);
```

#### **8. supplier_delivery_note_items** - Items del Remito
```sql
CREATE TABLE IF NOT EXISTS supplier_delivery_note_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_note_id INT NOT NULL,
    material_code VARCHAR(50) NOT NULL,
    product_id INT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    
    -- Vinculaciones
    purchase_item_id INT NULL, -- Item de OC
    invoice_item_id INT NULL, -- Item de factura
    
    -- Control de calidad
    quality_check BOOLEAN DEFAULT FALSE,
    quality_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (delivery_note_id) REFERENCES supplier_delivery_notes(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id),
    FOREIGN KEY (invoice_item_id) REFERENCES supplier_invoice_items(id)
);
```

#### **9. supplier_accounts** - Cuenta Corriente de Proveedores
```sql
CREATE TABLE IF NOT EXISTS supplier_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT UNIQUE NOT NULL,
    
    -- Balances
    commitment_balance DECIMAL(12,2) DEFAULT 0.00, -- Compromisos
    debt_balance DECIMAL(12,2) DEFAULT 0.00, -- Deuda real
    total_balance DECIMAL(12,2) DEFAULT 0.00, -- Total (commitment + debt)
    
    -- Límites
    credit_limit DECIMAL(12,2) DEFAULT 0.00,
    
    -- Estado
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);
```

#### **10. supplier_account_movements** - Movimientos de Cuenta Corriente
```sql
CREATE TABLE IF NOT EXISTS supplier_account_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_account_id INT NOT NULL,
    
    -- Tipo de movimiento
    movement_type ENUM('commitment', 'debt', 'payment', 'adjustment') NOT NULL,
    type ENUM('debit', 'credit') NOT NULL, -- Débito = aumenta deuda, Crédito = pago
    
    -- Montos
    amount DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL, -- Balance después del movimiento
    
    -- Referencias
    reference_type ENUM('purchase', 'invoice', 'payment', 'delivery_note', 'adjustment') NULL,
    reference_id INT NULL,
    
    -- Control
    description VARCHAR(255),
    due_date DATE NULL, -- Fecha de vencimiento (para deudas)
    payment_date DATE NULL, -- Fecha de pago (si aplica)
    status ENUM('pending', 'paid', 'overdue', 'cancelled') DEFAULT 'pending',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (supplier_account_id) REFERENCES supplier_accounts(id)
);
```

#### **11. accrued_expenses** - Egresos sin Factura / Devengamientos
```sql
CREATE TABLE IF NOT EXISTS accrued_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    expense_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INT NULL, -- Opcional (para proveedores no productivos)
    expense_type ENUM('compromise', 'accrual') NOT NULL,
    
    -- Información del egreso
    concept VARCHAR(255) NOT NULL,
    category ENUM('seguro', 'impuesto', 'alquiler', 'servicio', 'otro') DEFAULT 'otro',
    amount DECIMAL(12,2) NOT NULL,
    
    -- Fechas
    accrual_date DATE NOT NULL, -- Fecha de devengamiento
    due_date DATE NULL, -- Fecha de vencimiento
    payment_date DATE NULL, -- Fecha de pago efectivo
    
    -- Estados
    status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
    has_invoice BOOLEAN DEFAULT FALSE,
    invoice_id INT NULL, -- Factura asociada (si existe)
    
    -- Control
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    FOREIGN KEY (invoice_id) REFERENCES supplier_invoices(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**Características:**
- Permite registrar compromisos o devengamientos sin factura previa
- Se puede vincular con factura posterior (`invoice_id`)
- Se puede vincular con proveedor opcionalmente
- Control de vencimientos y pagos

#### **12. accrued_liabilities** - Pasivos Devengados
```sql
CREATE TABLE IF NOT EXISTS accrued_liabilities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    liability_number VARCHAR(50) UNIQUE NOT NULL,
    liability_type ENUM('impuesto', 'alquiler', 'seguro', 'servicio', 'prestamo', 'otro') NOT NULL,
    
    -- Información del pasivo
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    
    -- Fechas
    accrual_date DATE NOT NULL, -- Fecha de devengamiento
    due_date DATE NOT NULL, -- Fecha de vencimiento
    payment_date DATE NULL, -- Fecha de pago
    
    -- Estados
    status ENUM('pending', 'partial_paid', 'paid', 'overdue', 'cancelled') DEFAULT 'pending',
    paid_amount DECIMAL(12,2) DEFAULT 0.00,
    remaining_amount DECIMAL(12,2) NOT NULL, -- Monto pendiente
    
    -- Vinculación con tesorería
    treasury_account_id INT NULL, -- Cuenta de tesorería relacionada
    payment_id INT NULL, -- Pago relacionado (si se pagó desde tesorería)
    
    -- Control
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**Características:**
- Registro manual de pasivos devengados
- Clasificación por tipo (impuesto, alquiler, seguro, etc.)
- Control de pagos parciales y completos
- Vinculación con tesorería para pago posterior

#### **13. accrued_liability_payments** - Vinculación Pasivos-Pagos
```sql
CREATE TABLE IF NOT EXISTS accrued_liability_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    liability_id INT NOT NULL,
    payment_id INT NOT NULL, -- Pago desde tesorería
    amount DECIMAL(12,2) NOT NULL, -- Monto del pago aplicado
    payment_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (liability_id) REFERENCES accrued_liabilities(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES payments(id)
);
```

**Características:**
- Permite vincular múltiples pagos a un pasivo (pagos parciales)
- Concilia pagos realizados desde tesorería
- Trazabilidad completa de pagos

---

**⚠️ NOTA IMPORTANTE:**
- `material_code` en `supplier_invoice_items` es ahora **OPCIONAL** para permitir facturas de proveedores no productivos sin códigos de materiales
- `purchase_id` en `supplier_invoices` es **OPCIONAL** para permitir facturas sin OC previa
- `supplier_id` en `accrued_expenses` es **OPCIONAL** para permitir egresos sin proveedor específico

---

## 🔌 **ENDPOINTS API**

### **🔐 Autenticación y Autorización**

Todas las rutas requieren **Bearer Token** en el header:
```
Authorization: Bearer <jwt_token>
```

### **Roles Autorizados:**
- **gerencia**: Acceso completo a todas las funcionalidades
- **finanzas**: Acceso completo a todas las funcionalidades
- **logistica**: Acceso de lectura a compras y remitos de proveedores
- **compras**: Acceso a crear y gestionar OC y remitos

---

## 📋 **1. GESTIÓN DE PROVEEDORES**

### **GET /api/purchases/suppliers**
Obtener todos los proveedores con paginación y filtros.

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10)
- `search` (opcional): Buscar por nombre, código o contacto
- `city` (opcional): Filtrar por ciudad
- `supplier_type` (opcional): Filtrar por tipo ('productivo', 'no_productivo', 'otro_pasivo')
- `is_active` (opcional): Filtrar por estado activo (true/false)
- `all` (opcional): true para obtener todos sin paginación

**Ejemplo de Request:**
```bash
GET /api/purchases/suppliers?page=1&limit=10&supplier_type=productivo
Authorization: Bearer <token>
```

**Ejemplo de Response (200 OK):**
```json
{
  "success": true,
  "message": "Suppliers retrieved successfully",
  "data": {
    "suppliers": [
      {
        "id": 1,
        "code": "PROV001",
        "name": "Proveedor Productivo S.A.",
        "supplier_type": "productivo",
        "legal_name": "Proveedor Productivo Sociedad Anónima",
        "trade_name": "Proveedor Productivo",
        "purchase_frequency": "mensual",
        "id_type": "CUIT",
        "tax_id": "30-12345678-9",
        "gross_income": "123456789",
        "vat_condition": "Responsable Inscripto",
        "account_description": "Proveedores - Motores",
        "product_service": "Motores eléctricos para abanicos",
        "integral_summary_account": "2.1.1.01",
        "cost": 1500.00,
        "contact_name": "Juan Pérez",
        "email": "juan@proveedor.com",
        "phone": "+54 11 1234-5678",
        "address": "Av. Corrientes 1234",
        "city": "Buenos Aires",
        "country": "Argentina",
        "has_account": true,
        "payment_terms": 30,
        "is_active": true,
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

### **GET /api/purchases/suppliers/:id**
Obtener un proveedor específico por ID.

**Ejemplo de Response (200 OK):**
```json
{
  "success": true,
  "message": "Supplier retrieved successfully",
  "data": {
    "id": 1,
    "code": "PROV001",
    "name": "Proveedor Productivo S.A.",
    "supplier_type": "productivo",
    "legal_name": "Proveedor Productivo Sociedad Anónima",
    "trade_name": "Proveedor Productivo",
    "purchase_frequency": "mensual",
    "id_type": "CUIT",
    "tax_id": "30-12345678-9",
    "gross_income": "123456789",
    "vat_condition": "Responsable Inscripto",
    "account_description": "Proveedores - Motores",
    "product_service": "Motores eléctricos para abanicos",
    "integral_summary_account": "2.1.1.01",
    "cost": 1500.00,
    "contact_name": "Juan Pérez",
    "email": "juan@proveedor.com",
    "phone": "+54 11 1234-5678",
    "address": "Av. Corrientes 1234",
    "city": "Buenos Aires",
    "country": "Argentina",
    "has_account": true,
    "payment_terms": 30,
    "account": {
      "commitment_balance": 50000.00,
      "debt_balance": 150000.00,
      "total_balance": 200000.00,
      "credit_limit": 500000.00
    },
    "is_active": true,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### **POST /api/purchases/suppliers**
Crear un nuevo proveedor.

**Request Body:**
```json
{
  "code": "PROV001",
  "name": "Proveedor Productivo S.A.",
  "supplier_type": "productivo",
  "legal_name": "Proveedor Productivo Sociedad Anónima",
  "trade_name": "Proveedor Productivo",
  "purchase_frequency": "mensual",
  "id_type": "CUIT",
  "tax_id": "30-12345678-9",
  "gross_income": "123456789",
  "vat_condition": "Responsable Inscripto",
  "account_description": "Proveedores - Motores",
  "product_service": "Motores eléctricos para abanicos",
  "integral_summary_account": "2.1.1.01",
  "cost": 1500.00,
  "contact_name": "Juan Pérez",
  "email": "juan@proveedor.com",
  "phone": "+54 11 1234-5678",
  "address": "Av. Corrientes 1234",
  "city": "Buenos Aires",
  "country": "Argentina",
  "has_account": true,
  "payment_terms": 30
}
```

**Validaciones:**
- `code`: Requerido, único, máximo 20 caracteres
- `name`: Requerido, máximo 100 caracteres
- `supplier_type`: Opcional, debe ser 'productivo', 'no_productivo' o 'otro_pasivo'
- `legal_name`: Opcional, máximo 255 caracteres (Razón Social)
- `trade_name`: Opcional, máximo 255 caracteres (Nombre de Fantasía)
- `purchase_frequency`: Opcional, máximo 50 caracteres
- `id_type`: Opcional, debe ser 'CUIT', 'CUIL', 'DNI', 'PASAPORTE' o 'OTRO'
- `tax_id`: Opcional, máximo 20 caracteres (CUIT)
- `gross_income`: Opcional, máximo 50 caracteres
- `vat_condition`: Opcional, debe ser una condición IVA válida
- `account_description`: Opcional, texto libre
- `product_service`: Opcional, texto libre
- `integral_summary_account`: Opcional, máximo 100 caracteres
- `cost`: Opcional, número positivo
- `email`: Opcional, formato de email válido
- `payment_terms`: Opcional, número entero positivo (días)

**Ejemplo de Response (201 Created):**
```json
{
  "success": true,
  "message": "Supplier created successfully",
  "data": {
    "id": 1,
    "code": "PROV001",
    "name": "Proveedor Productivo S.A.",
    "supplier_type": "productivo",
    "has_account": true,
    "payment_terms": 30,
    "created_at": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### **PUT /api/purchases/suppliers/:id**
Actualizar un proveedor existente.

**Request Body:**
```json
{
  "supplier_type": "productivo",
  "legal_name": "Nueva Razón Social S.A.",
  "trade_name": "Nuevo Nombre",
  "tax_id": "30-98765432-1",
  "vat_condition": "Responsable Inscripto",
  "email": "nuevo@proveedor.com",
  "phone": "+54 11 9876-5432",
  "payment_terms": 45
}
```

### **DELETE /api/purchases/suppliers/:id**
Eliminar un proveedor (soft delete si tiene compras asociadas).

---

## 📋 **2. ÓRDENES DE COMPRA (OC)**

### **GET /api/purchases**
Obtener todas las órdenes de compra con paginación y filtros.

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10)
- `search` (opcional): Buscar por número de OC, nombre de proveedor
- `status` (opcional): Filtrar por estado ('pending', 'received', 'cancelled')
- `debt_type` (opcional): Filtrar por tipo de deuda ('compromiso', 'deuda_directa')
- `supplier_id` (opcional): Filtrar por ID de proveedor
- `supplier_type` (opcional): Filtrar por tipo de proveedor
- `date_from` (opcional): Fecha desde (YYYY-MM-DD)
- `date_to` (opcional): Fecha hasta (YYYY-MM-DD)
- `all` (opcional): true para obtener todas sin paginación

**Ejemplo de Response (200 OK):**
```json
{
  "success": true,
  "message": "Purchases retrieved successfully",
  "data": {
    "purchases": [
      {
        "id": 1,
        "purchase_number": "OC0001",
        "supplier_id": 1,
        "supplier_name": "Proveedor Productivo S.A.",
        "supplier_type": "productivo",
        "status": "pending",
        "debt_type": "compromiso",
        "total_amount": 150000.00,
        "commitment_amount": 150000.00,
        "debt_amount": 0.00,
        "allows_partial_delivery": true,
        "purchase_date": "2024-01-15T10:30:00.000Z",
        "confirmed_at": "2024-01-15T10:35:00.000Z",
        "received_date": null,
        "notes": "Compra de materiales para producción",
        "items_count": 3,
        "created_at": "2024-01-15T10:30:00.000Z",
        "updated_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### **GET /api/purchases/:id**
Obtener una OC específica con sus items.

**Ejemplo de Response (200 OK):**
```json
{
  "success": true,
  "message": "Purchase retrieved successfully",
  "data": {
    "id": 1,
    "purchase_number": "OC0001",
    "supplier_id": 1,
    "supplier_name": "Proveedor Productivo S.A.",
    "supplier_type": "productivo",
    "status": "pending",
    "debt_type": "compromiso",
    "total_amount": 150000.00,
    "commitment_amount": 150000.00,
    "debt_amount": 0.00,
    "allows_partial_delivery": true,
    "purchase_date": "2024-01-15T10:30:00.000Z",
    "confirmed_at": "2024-01-15T10:35:00.000Z",
    "items": [
      {
        "id": 1,
        "purchase_id": 1,
        "product_id": 5,
        "product_name": "Motor Eléctrico 220V",
        "product_code": "MOT001",
        "material_code": "MAT-MOT-220V-001",
        "quantity": 100,
        "received_quantity": 0,
        "pending_quantity": 100,
        "unit_price": 1500.00,
        "total_price": 150000.00,
        "unit_cost": 1500.00
      }
    ],
    "invoices": [],
    "delivery_notes": [],
    "payments": []
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### **POST /api/purchases**
Crear una nueva orden de compra.

**Request Body:**
```json
{
  "supplier_id": 1,
  "debt_type": "compromiso",
  "allows_partial_delivery": true,
  "purchase_date": "2024-01-15T10:30:00.000Z",
  "notes": "Compra de materiales para producción",
  "items": [
    {
      "product_id": 5,
      "material_code": "MAT-MOT-220V-001",
      "quantity": 100,
      "unit_price": 1500.00,
      "unit_cost": 1500.00
    },
    {
      "product_id": 8,
      "material_code": "MAT-ASP-PLA-001",
      "quantity": 200,
      "unit_price": 250.00,
      "unit_cost": 250.00
    }
  ]
}
```

**Validaciones:**
- `supplier_id`: Requerido, debe existir
- `debt_type`: Requerido, debe ser 'compromiso' o 'deuda_directa'
- `items`: Requerido, array con al menos un item
- `material_code`: Requerido para proveedores productivos
- `quantity`: Requerido, número positivo
- `unit_price`: Requerido, número positivo

**Lógica de Negocio:**
- Si `debt_type = 'compromiso'`: Se genera compromiso en cuenta corriente, no deuda real
- Si `debt_type = 'deuda_directa'`: Se genera deuda directa al confirmarse la OC
- Si proveedor es `productivo`: Se requiere `material_code` en cada item
- Se actualiza automáticamente la cuenta corriente del proveedor

**Ejemplo de Response (201 Created):**
```json
{
  "success": true,
  "message": "Purchase order created successfully",
  "data": {
    "id": 1,
    "purchase_number": "OC0001",
    "supplier_id": 1,
    "status": "pending",
    "debt_type": "compromiso",
    "total_amount": 200000.00,
    "commitment_amount": 200000.00,
    "debt_amount": 0.00,
    "created_at": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### **PUT /api/purchases/:id**
Actualizar una OC existente.

**⚠️ Restricciones:**
- No se puede cambiar `debt_type` si ya tiene facturas asociadas
- No se puede cambiar `supplier_id` si ya tiene facturas asociadas
- Solo se pueden modificar items si la OC está en estado 'pending'

### **PUT /api/purchases/:id/confirm**
Confirmar una OC (cambia compromiso a deuda si aplica).

**Request Body:**
```json
{
  "confirm": true
}
```

**Lógica:**
- Si `debt_type = 'deuda_directa'`: Se genera deuda en cuenta corriente
- Si `debt_type = 'compromiso'`: Se mantiene como compromiso hasta que llegue la factura

---

## 🧾 **3. FACTURAS DE PROVEEDORES**

### **GET /api/suppliers/invoices**
Obtener todas las facturas con paginación y filtros.

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10)
- `search` (opcional): Buscar por número de factura
- `supplier_id` (opcional): Filtrar por proveedor
- `purchase_id` (opcional): Filtrar por OC
- `status` (opcional): Filtrar por estado
- `payment_status` (opcional): Filtrar por estado de pago
- `date_from` (opcional): Fecha desde (YYYY-MM-DD)
- `date_to` (opcional): Fecha hasta (YYYY-MM-DD)

**Ejemplo de Response (200 OK):**
```json
{
  "success": true,
  "message": "Invoices retrieved successfully",
  "data": {
    "invoices": [
      {
        "id": 1,
        "invoice_number": "FC-2024-001",
        "supplier_id": 1,
        "supplier_name": "Proveedor Productivo S.A.",
        "purchase_id": 1,
        "purchase_number": "OC0001",
        "invoice_date": "2024-01-20",
        "due_date": "2024-02-20",
        "subtotal": 141509.43,
        "tax_amount": 25471.70,
        "total_amount": 166981.13,
        "status": "received",
        "payment_status": "pending",
        "paid_amount": 0.00,
        "remaining_amount": 166981.13,
        "delivery_note_id": null,
        "created_at": "2024-01-20T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15,
      "totalPages": 2
    }
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### **GET /api/suppliers/invoices/:id**
Obtener una factura específica con sus items.

**Ejemplo de Response (200 OK):**
```json
{
  "success": true,
  "message": "Invoice retrieved successfully",
  "data": {
    "id": 1,
    "invoice_number": "FC-2024-001",
    "supplier_id": 1,
    "supplier_name": "Proveedor Productivo S.A.",
    "supplier_type": "productivo",
    "purchase_id": 1,
    "purchase_number": "OC0001",
    "invoice_date": "2024-01-20",
    "due_date": "2024-02-20",
    "subtotal": 141509.43,
    "tax_amount": 25471.70,
    "total_amount": 166981.13,
    "status": "received",
    "payment_status": "pending",
    "paid_amount": 0.00,
    "remaining_amount": 166981.13,
    "items": [
      {
        "id": 1,
        "invoice_id": 1,
        "material_code": "MAT-MOT-220V-001",
        "product_id": 5,
        "product_name": "Motor Eléctrico 220V",
        "description": "Motor Eléctrico 220V - Modelo 2024",
        "quantity": 100,
        "unit_price": 1415.09,
        "total_price": 141509.00,
        "unit_cost": 1415.09,
        "affects_production_cost": true,
        "purchase_item_id": 1
      }
    ],
    "delivery_note": null,
    "payments": []
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### **POST /api/suppliers/invoices**
Crear una nueva factura de proveedor.

**Request Body:**
```json
{
  "invoice_number": "FC-2024-001",
  "supplier_id": 1,
  "purchase_id": 1,
  "invoice_date": "2024-01-20",
  "due_date": "2024-02-20",
  "subtotal": 141509.43,
  "tax_amount": 25471.70,
  "total_amount": 166981.13,
  "notes": "Factura correspondiente a OC0001",
  "items": [
    {
      "material_code": "MAT-MOT-220V-001",
      "product_id": 5,
      "description": "Motor Eléctrico 220V - Modelo 2024",
      "quantity": 100,
      "unit_price": 1415.09,
      "unit_cost": 1415.09,
      "affects_production_cost": true,
      "purchase_item_id": 1
    }
  ]
}
```

**Validaciones:**
- `invoice_number`: Requerido, único
- `supplier_id`: Requerido, debe existir
- `purchase_id`: Opcional, pero recomendado para trazabilidad
- `invoice_date`: Requerido, fecha válida
- `items`: Requerido, array con al menos un item
- `material_code`: Requerido para proveedores productivos
- Si está vinculada a OC: Validar que los items coincidan

**Lógica de Negocio:**
- Si `purchase_id` está presente: Validar items contra la OC
- Si proveedor es `productivo`: Requerir `material_code` en todos los items
- Actualizar compromiso a deuda en cuenta corriente
- Si `purchase_id` tiene `debt_type = 'compromiso'`: Convertir compromiso a deuda
- Actualizar `received_quantity` en items de la OC

**Ejemplo de Response (201 Created):**
```json
{
  "success": true,
  "message": "Invoice created successfully",
  "data": {
    "id": 1,
    "invoice_number": "FC-2024-001",
    "supplier_id": 1,
    "purchase_id": 1,
    "total_amount": 166981.13,
    "status": "received",
    "payment_status": "pending",
    "created_at": "2024-01-20T10:30:00.000Z"
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### **PUT /api/suppliers/invoices/:id/link-delivery-note**
Vincular un remito a la factura.

**Request Body:**
```json
{
  "delivery_note_id": 1
}
```

**Validaciones:**
- El remito debe coincidir en cantidad y productos con la factura
- El remito debe pertenecer al mismo proveedor

---

## 📦 **4. REMITOS DE ENTREGA**

### **GET /api/suppliers/delivery-notes**
Obtener todos los remitos con paginación y filtros.

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10)
- `search` (opcional): Buscar por número de remito
- `supplier_id` (opcional): Filtrar por proveedor
- `purchase_id` (opcional): Filtrar por OC
- `invoice_id` (opcional): Filtrar por factura
- `status` (opcional): Filtrar por estado

**Ejemplo de Response (200 OK):**
```json
{
  "success": true,
  "message": "Delivery notes retrieved successfully",
  "data": {
    "delivery_notes": [
      {
        "id": 1,
        "delivery_note_number": "RE-2024-001",
        "supplier_id": 1,
        "supplier_name": "Proveedor Productivo S.A.",
        "purchase_id": 1,
        "purchase_number": "OC0001",
        "invoice_id": 1,
        "invoice_number": "FC-2024-001",
        "delivery_date": "2024-01-18",
        "received_date": "2024-01-18T14:30:00.000Z",
        "status": "complete",
        "matches_invoice": true,
        "items_count": 2,
        "created_at": "2024-01-18T14:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 8,
      "totalPages": 1
    }
  },
  "timestamp": "2024-01-18T14:30:00.000Z"
}
```

### **GET /api/suppliers/delivery-notes/:id**
Obtener un remito específico con sus items.

### **POST /api/suppliers/delivery-notes**
Crear un nuevo remito de entrega.

**Request Body:**
```json
{
  "delivery_note_number": "RE-2024-001",
  "supplier_id": 1,
  "purchase_id": 1,
  "invoice_id": null,
  "delivery_date": "2024-01-18",
  "notes": "Entrega parcial de materiales",
  "items": [
    {
      "material_code": "MAT-MOT-220V-001",
      "product_id": 5,
      "quantity": 50,
      "purchase_item_id": 1,
      "quality_check": true,
      "quality_notes": "Productos en buen estado"
    }
  ]
}
```

**Validaciones:**
- `delivery_note_number`: Requerido, único
- `supplier_id`: Requerido
- `purchase_id`: Requerido
- `items`: Requerido, array con al menos un item
- `quantity`: No puede exceder la cantidad pendiente de la OC
- Si `invoice_id` está presente: Validar coincidencia con factura

**Lógica de Negocio:**
- Actualizar `received_quantity` en items de la OC
- Si es entrega parcial: Marcar OC como parcialmente recibida
- Si completa la OC: Marcar OC como recibida
- Actualizar stock de productos si aplica
- Si está vinculado a factura: Validar coincidencia

**Entregas Parciales:**
- Se permite crear múltiples remitos para una misma OC
- Cada remito puede tener una cantidad menor a la solicitada
- El sistema controla cuánto falta recibir

### **PUT /api/suppliers/delivery-notes/:id/link-invoice**
Vincular una factura al remito.

**Request Body:**
```json
{
  "invoice_id": 1
}
```

**Validaciones:**
- Validar que cantidad y productos del remito coincidan con la factura
- Validar que pertenezcan al mismo proveedor

---

## 💰 **5. PAGOS**

### **GET /api/payments**
Obtener todos los pagos con filtros.

**Query Parameters:**
- `type` (opcional): 'income' o 'outflow'
- `payee_type` (opcional): 'supplier', 'employee', 'other', 'client'
- `payee_id` (opcional): ID del receptor
- `related_type` (opcional): 'order', 'purchase', 'expense', 'payroll'
- `related_id` (opcional): ID relacionado
- `invoice_id` (opcional): Filtrar por factura vinculada
- `date_from` (opcional): Fecha desde
- `date_to` (opcional): Fecha hasta

### **POST /api/payments**
Crear un nuevo pago.

**Request Body (Pago vinculado a factura):**
```json
{
  "type": "outflow",
  "method": "transferencia",
  "amount": 166981.13,
  "payment_date": "2024-01-25T10:30:00.000Z",
  "payee_type": "supplier",
  "payee_id": 1,
  "invoice_id": 1,
  "notes": "Pago de factura FC-2024-001"
}
```

**Request Body (Pago sin factura):**
```json
{
  "type": "outflow",
  "method": "transferencia",
  "amount": 50000.00,
  "payment_date": "2024-01-25T10:30:00.000Z",
  "payee_type": "supplier",
  "payee_id": 1,
  "related_type": "purchase",
  "related_id": 1,
  "notes": "Anticipo para OC0001"
}
```

**Validaciones:**
- `type`: Requerido, debe ser 'income' o 'outflow'
- `method`: Requerido, debe ser 'efectivo', 'tarjeta' o 'transferencia'
- `amount`: Requerido, número positivo
- `payee_type`: Requerido si `payee_id` está presente
- Si `invoice_id` está presente: Validar que el monto no exceda el pendiente

**Lógica de Negocio:**
- Si está vinculado a factura: Actualizar estado de pago de la factura
- Actualizar cuenta corriente del proveedor
- Registrar movimiento en cuenta corriente
- Si pago es parcial: Marcar factura como 'partial_paid'
- Si pago completa la factura: Marcar factura como 'paid'

### **POST /api/payments/validate-invoice**
Validar coincidencia entre factura y pago.

**Request Body:**
```json
{
  "invoice_id": 1,
  "payment_amount": 166981.13
}
```

**Response:**
```json
{
  "success": true,
  "message": "Validation successful",
  "data": {
    "invoice_id": 1,
    "invoice_amount": 166981.13,
    "payment_amount": 166981.13,
    "matches": true,
    "difference": 0.00
  }
}
```

---

## 📊 **6. CUENTA CORRIENTE DE PROVEEDORES**

### **GET /api/suppliers/:id/account**
Obtener la cuenta corriente de un proveedor.

**Ejemplo de Response (200 OK):**
```json
{
  "success": true,
  "message": "Supplier account retrieved successfully",
  "data": {
    "supplier_id": 1,
    "supplier_name": "Proveedor Productivo S.A.",
    "commitment_balance": 50000.00,
    "debt_balance": 150000.00,
    "total_balance": 200000.00,
    "credit_limit": 500000.00,
    "available_credit": 300000.00,
    "is_active": true
  },
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

### **GET /api/suppliers/:id/account/movements**
Obtener los movimientos de cuenta corriente.

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10)
- `movement_type` (opcional): Filtrar por tipo
- `status` (opcional): Filtrar por estado
- `date_from` (opcional): Fecha desde
- `date_to` (opcional): Fecha hasta

**Ejemplo de Response (200 OK):**
```json
{
  "success": true,
  "message": "Account movements retrieved successfully",
  "data": {
    "movements": [
      {
        "id": 1,
        "movement_type": "commitment",
        "type": "debit",
        "amount": 150000.00,
        "balance_after": 150000.00,
        "reference_type": "purchase",
        "reference_id": 1,
        "description": "OC0001 - Compromiso",
        "due_date": null,
        "status": "pending",
        "created_at": "2024-01-15T10:35:00.000Z"
      },
      {
        "id": 2,
        "movement_type": "debt",
        "type": "debit",
        "amount": 166981.13,
        "balance_after": 316981.13,
        "reference_type": "invoice",
        "reference_id": 1,
        "description": "FC-2024-001 - Factura recibida",
        "due_date": "2024-02-20",
        "status": "pending",
        "created_at": "2024-01-20T10:30:00.000Z"
      },
      {
        "id": 3,
        "movement_type": "payment",
        "type": "credit",
        "amount": 166981.13,
        "balance_after": 150000.00,
        "reference_type": "payment",
        "reference_id": 5,
        "description": "Pago de FC-2024-001",
        "payment_date": "2024-01-25",
        "status": "paid",
        "created_at": "2024-01-25T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 3,
      "totalPages": 1
    }
  },
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

### **GET /api/suppliers/:id/account/summary**
Obtener resumen de cuenta corriente.

**Ejemplo de Response (200 OK):**
```json
{
  "success": true,
  "message": "Account summary retrieved successfully",
  "data": {
    "supplier_id": 1,
    "supplier_name": "Proveedor Productivo S.A.",
    "commitment_balance": 50000.00,
    "debt_balance": 150000.00,
    "total_balance": 200000.00,
    "credit_limit": 500000.00,
    "available_credit": 300000.00,
    "pending_invoices": 2,
    "pending_invoices_amount": 200000.00,
    "overdue_invoices": 0,
    "overdue_amount": 0.00,
    "next_due_date": "2024-02-20",
    "next_due_amount": 166981.13
  },
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

---

## 🧾 **7. EGRESOS SIN FACTURA (DEVENGAMIENTOS)**

### **GET /api/suppliers/accrued-expenses**
Obtener todos los egresos devengados con paginación y filtros.

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10)
- `supplier_id` (opcional): Filtrar por proveedor
- `expense_type` (opcional): Filtrar por tipo ('compromise', 'accrual')
- `category` (opcional): Filtrar por categoría
- `status` (opcional): Filtrar por estado
- `has_invoice` (opcional): Filtrar si tiene factura asociada
- `date_from` (opcional): Fecha desde
- `date_to` (opcional): Fecha hasta

### **GET /api/suppliers/accrued-expenses/:id**
Obtener un egreso devengado específico.

### **POST /api/suppliers/accrued-expenses**
Crear un nuevo egreso devengado.

**Request Body:**
```json
{
  "supplier_id": null,
  "expense_type": "accrual",
  "concept": "Seguro anual de vehículos",
  "category": "seguro",
  "amount": 50000.00,
  "accrual_date": "2024-01-01",
  "due_date": "2024-12-31",
  "notes": "Seguro anual pagadero en cuotas"
}
```

**Validaciones:**
- `expense_type`: Requerido, debe ser 'compromise' o 'accrual'
- `concept`: Requerido, máximo 255 caracteres
- `category`: Opcional, debe ser válido
- `amount`: Requerido, número positivo
- `accrual_date`: Requerido, fecha válida
- `supplier_id`: Opcional

**Lógica de Negocio:**
- Se registra como pasivo pendiente
- Se puede vincular con proveedor opcionalmente
- Se puede vincular con factura posterior
- Control de vencimientos

### **PUT /api/suppliers/accrued-expenses/:id**
Actualizar un egreso devengado.

### **PUT /api/suppliers/accrued-expenses/:id/link-invoice**
Vincular una factura al egreso devengado.

**Request Body:**
```json
{
  "invoice_id": 1
}
```

### **DELETE /api/suppliers/accrued-expenses/:id**
Eliminar un egreso devengado (solo si no tiene pagos asociados).

---

## 📊 **8. PASIVOS DEVENGADOS**

### **GET /api/suppliers/accrued-liabilities**
Obtener todos los pasivos devengados con paginación y filtros.

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 10)
- `liability_type` (opcional): Filtrar por tipo
- `status` (opcional): Filtrar por estado
- `overdue` (opcional): true para solo pasivos vencidos
- `date_from` (opcional): Fecha desde
- `date_to` (opcional): Fecha hasta

### **GET /api/suppliers/accrued-liabilities/:id**
Obtener un pasivo devengado específico.

### **POST /api/suppliers/accrued-liabilities**
Crear un nuevo pasivo devengado.

**Request Body:**
```json
{
  "liability_type": "impuesto",
  "description": "IVA Trimestral - Q1 2024",
  "amount": 250000.00,
  "accrual_date": "2024-01-01",
  "due_date": "2024-04-15",
  "treasury_account_id": null,
  "notes": "IVA del primer trimestre"
}
```

**Validaciones:**
- `liability_type`: Requerido, debe ser válido
- `description`: Requerido, máximo 255 caracteres
- `amount`: Requerido, número positivo
- `accrual_date`: Requerido, fecha válida
- `due_date`: Requerido, fecha válida
- `treasury_account_id`: Opcional

**Lógica de Negocio:**
- `remaining_amount` se inicializa igual a `amount`
- `status` se establece como 'pending'
- Control automático de vencimientos

### **PUT /api/suppliers/accrued-liabilities/:id**
Actualizar un pasivo devengado.

### **POST /api/suppliers/accrued-liabilities/:id/link-payment**
Vincular un pago desde tesorería al pasivo.

**Request Body:**
```json
{
  "payment_id": 10,
  "amount": 250000.00,
  "payment_date": "2024-04-10",
  "notes": "Pago completo del IVA"
}
```

**Lógica:**
- Se crea registro en `accrued_liability_payments`
- Se actualiza `paid_amount` y `remaining_amount`
- Si `remaining_amount = 0`: `status = 'paid'`
- Si `remaining_amount > 0`: `status = 'partial_paid'`

### **DELETE /api/suppliers/accrued-liabilities/:id**
Eliminar un pasivo devengado (solo si no tiene pagos asociados).

---

## 🔄 **FLUJOS DE TRABAJO**

### **Flujo 1: OC con Compromiso → Factura → Remito → Pago**

```
1. Crear OC con debt_type='compromiso'
   → Se genera compromiso en cuenta corriente
   → commitment_balance aumenta
   → debt_balance no cambia

2. Recibir Remito (antes de factura)
   → Se registra remito vinculado a OC
   → Se actualiza received_quantity en items
   → Stock se actualiza (si aplica)

3. Recibir Factura
   → Se crea factura vinculada a OC y remito
   → Compromiso se convierte en deuda
   → commitment_balance disminuye
   → debt_balance aumenta
   → Se valida coincidencia con remito

4. Registrar Pago
   → Se crea pago vinculado a factura
   → debt_balance disminuye
   → Estado de factura cambia a 'paid'
   → Estado de pago en cuenta corriente: 'paid'
```

### **Flujo 2: OC con Deuda Directa → Factura → Pago**

```
1. Crear OC con debt_type='deuda_directa'
   → Se genera deuda directamente en cuenta corriente
   → debt_balance aumenta
   → commitment_balance no cambia

2. Confirmar OC
   → Se confirma la deuda
   → Estado de OC: 'confirmed'

3. Recibir Factura
   → Se crea factura vinculada a OC
   → Se valida monto contra OC
   → Estado de factura: 'received'

4. Registrar Pago
   → Se crea pago vinculado a factura
   → debt_balance disminuye
   → Estado de factura: 'paid'
```

### **Flujo 3: Entrega Parcial**

```
1. Crear OC con allows_partial_delivery=true
   → OC con 100 unidades

2. Recibir Remito Parcial (50 unidades)
   → Se crea remito con 50 unidades
   → received_quantity = 50
   → pending_quantity = 50
   → Estado de OC: 'partial'

3. Recibir Factura Parcial
   → Se crea factura por 50 unidades
   → Se vincula a remito parcial

4. Recibir Remito Completo (50 unidades restantes)
   → Se crea segundo remito con 50 unidades
   → received_quantity = 100
   → pending_quantity = 0
   → Estado de OC: 'complete'

5. Recibir Factura Completa
   → Se crea factura por 50 unidades restantes
   → O se actualiza factura anterior
```

### **Flujo 4: Pago Antes de Factura**

```
1. Crear OC
   → Se genera compromiso o deuda

2. Registrar Pago (sin factura)
   → Se crea pago vinculado solo a OC
   → related_type='purchase', related_id=OC_id
   → invoice_id=NULL
   → Se registra como anticipo

3. Recibir Factura
   → Se crea factura
   → Se puede vincular pago existente
   → O registrar nuevo pago si falta
```

### **Flujo 5: Proveedor No Productivo - Factura sin OC**

```
1. Recibir Factura de Proveedor No Productivo
   → Se crea factura sin OC (purchase_id=NULL)
   → material_code opcional en items
   → affects_production_cost=FALSE
   → Se genera deuda en cuenta corriente

2. Registrar Pago (vinculado o no)
   → Opción A: Pago vinculado a factura
      → invoice_id=factura_id
      → Estado de factura: 'paid'
   → Opción B: Pago sin factura (anticipo)
      → related_type='supplier', related_id=proveedor_id
      → invoice_id=NULL
      → Se puede vincular después

3. Vincular Pago a Factura (si aplica)
   → Actualizar pago con invoice_id
   → Actualizar estado de factura
```

### **Flujo 6: Egreso sin Factura (Devengamiento)**

```
1. Registrar Egreso Devengado
   → Se crea accrued_expense
   → expense_type='accrual' o 'compromise'
   → supplier_id opcional
   → Se registra como pasivo pendiente
   → status='pending'

2. Registrar Pago del Egreso
   → Se crea pago vinculado al egreso
   → accrued_expense_id=egreso_id
   → Estado de egreso: 'paid'
   → payment_date se actualiza

3. Vincular Factura (si llega después)
   → Actualizar accrued_expense
   → invoice_id=factura_id
   → has_invoice=TRUE
   → Se mantiene trazabilidad completa
```

### **Flujo 7: Pasivo Devengado (Otros Pasivos)**

```
1. Registrar Pasivo Devengado
   → Se crea accrued_liability
   → liability_type (impuesto, alquiler, seguro, etc.)
   → accrual_date y due_date requeridos
   → remaining_amount = amount
   → status='pending'

2. Pago desde Tesorería
   → Se crea pago en tesorería
   → Se vincula al pasivo mediante accrued_liability_payments
   → Se actualiza paid_amount y remaining_amount
   → Si remaining_amount=0: status='paid'

3. Control de Vencimientos
   → Si due_date < hoy y status='pending': status='overdue'
   → Alertas automáticas para pasivos vencidos
   → Seguimiento de próximos vencimientos
```

---

## 📈 **ESTADOS Y TRANSICIONES**

### **Estados de OC (purchases)**
```
pending → confirmed → received → cancelled
   ↓         ↓           ↓
compromiso  deuda    completo
```

- **pending**: OC creada, no confirmada
- **confirmed**: OC confirmada (si debt_type='deuda_directa', genera deuda)
- **received**: OC completamente recibida
- **cancelled**: OC cancelada

### **Estados de Factura (supplier_invoices)**
```
draft → received → partial_paid → paid
                  ↓
              cancelled
```

- **draft**: Factura en borrador
- **received**: Factura recibida, pendiente de pago
- **partial_paid**: Factura parcialmente pagada
- **paid**: Factura completamente pagada
- **cancelled**: Factura cancelada

### **Estados de Pago (payments)**
```
draft → posted → void
```

- **draft**: Pago en borrador
- **posted**: Pago registrado
- **void**: Pago anulado

### **Estados de Remito (supplier_delivery_notes)**
```
pending → partial → complete → cancelled
```

- **pending**: Remito creado, no recibido
- **partial**: Remito parcial (entregas parciales)
- **complete**: Remito completo
- **cancelled**: Remito cancelado

### **Estados de Egreso Devengado (accrued_expenses)**
```
pending → paid
    ↓
cancelled
```

- **pending**: Egreso registrado, pendiente de pago
- **paid**: Egreso pagado
- **cancelled**: Egreso cancelado

### **Estados de Pasivo Devengado (accrued_liabilities)**
```
pending → partial_paid → paid
    ↓         ↓
overdue  cancelled
```

- **pending**: Pasivo registrado, pendiente de pago
- **partial_paid**: Pasivo parcialmente pagado
- **paid**: Pasivo completamente pagado
- **overdue**: Pasivo vencido (due_date < hoy)
- **cancelled**: Pasivo cancelado

---

## 🔍 **VALIDACIONES Y REGLAS DE NEGOCIO**

### **Validaciones de OC**
1. **Proveedores Productivos**: Requieren `material_code` en todos los items
2. **Compromiso vs Deuda**: Solo una OC puede cambiar de compromiso a deuda al recibir factura
3. **Entregas Parciales**: Solo si `allows_partial_delivery=true`
4. **Cantidades**: No se puede recibir más de lo solicitado

### **Validaciones de Factura**
1. **Códigos de Materiales**: 
   - Obligatorio para proveedores **productivos**
   - Opcional para proveedores **no productivos**
2. **Coincidencia con OC**: Si está vinculada (`purchase_id` presente), validar items y cantidades
3. **Coincidencia con Remito**: Si está vinculada, validar cantidad y productos
4. **Monto**: Si vinculada a OC, no puede exceder el monto de la OC (con tolerancia del 5%)
5. **Facturas sin OC**: Permitidas para proveedores no productivos

### **Validaciones de Remito**
1. **Cantidad**: No puede exceder la cantidad pendiente de la OC
2. **Coincidencia con Factura**: Si está vinculado, validar cantidad y productos
3. **Productos**: Deben coincidir con la OC

### **Validaciones de Pago**
1. **Monto**: No puede exceder el monto pendiente de la factura (si está vinculado)
2. **Factura**: Si está vinculado, validar que la factura existe
3. **Coincidencia**: Validar monto contra factura si aplica
4. **Pagos sin factura**: Permitidos (anticipos)
5. **Egresos devengados**: Se puede vincular pago a egreso devengado

### **Validaciones de Egresos Devengados**
1. **Tipo**: Debe ser 'compromise' o 'accrual'
2. **Monto**: Debe ser positivo
3. **Fechas**: `accrual_date` requerida, `due_date` opcional
4. **Proveedor**: Opcional (permite egresos sin proveedor específico)
5. **Factura**: Se puede vincular factura posterior

### **Validaciones de Pasivos Devengados**
1. **Tipo**: Debe ser válido (impuesto, alquiler, seguro, etc.)
2. **Monto**: Debe ser positivo
3. **Fechas**: `accrual_date` y `due_date` requeridas
4. **Vencimientos**: Control automático de pasivos vencidos
5. **Pagos**: Se pueden vincular múltiples pagos (parciales)

### **Validaciones de Cuenta Corriente**
1. **Límite de Crédito**: No permitir deuda que exceda el límite
2. **Compromiso**: Se convierte en deuda al recibir factura
3. **Pagos**: Deben estar vinculados a factura o OC

---

## 🔗 **TRAZABILIDAD**

### **Relaciones entre Entidades**
```
Proveedor (supplier)
  ├── OC (purchase)
  │     ├── Items (purchase_items)
  │     ├── Facturas (supplier_invoices)
  │     ├── Remitos (supplier_delivery_notes)
  │     └── Pagos (payments)
  │
  ├── Facturas (supplier_invoices)
  │     ├── Items (supplier_invoice_items)
  │     ├── Remito (supplier_delivery_notes)
  │     └── Pagos (payments)
  │
  ├── Remitos (supplier_delivery_notes)
  │     ├── Items (supplier_delivery_note_items)
  │     ├── OC (purchase)
  │     └── Factura (supplier_invoices)
  │
  ├── Pagos (payments)
  │     ├── Factura (supplier_invoices)
  │     └── OC (purchase)
  │
  └── Cuenta Corriente (supplier_accounts)
        └── Movimientos (supplier_account_movements)
```

### **Consultas de Trazabilidad**

#### **Obtener Trazabilidad Completa de una OC**
```
GET /api/purchases/:id/traceability
```

**Response:**
```json
{
  "success": true,
  "data": {
    "purchase": { ... },
    "invoices": [
      {
        "id": 1,
        "invoice_number": "FC-2024-001",
        "items": [ ... ],
        "delivery_notes": [ ... ],
        "payments": [ ... ]
      }
    ],
    "delivery_notes": [ ... ],
    "payments": [ ... ],
    "account_movements": [ ... ]
  }
}
```

#### **Obtener Trazabilidad de una Factura**
```
GET /api/suppliers/invoices/:id/traceability
```

---

## 💵 **IMPACTO EN COSTOS DE PRODUCCIÓN**

### **Cálculo de Costos**
Las facturas de proveedores **productivos** con códigos de materiales afectan el cálculo de costo de producción.

**Reglas:**
1. Solo facturas de proveedores `productivo` afectan costos
2. Se requiere `material_code` en items de factura
3. El `unit_cost` de cada item se usa para calcular costo de producto
4. Se puede rastrear qué materiales y costos afectan cada producto

### **Endpoints de Costos**

#### **GET /api/suppliers/invoices/:id/production-costs**
Obtener impacto en costos de producción de una factura.

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice_id": 1,
    "invoice_number": "FC-2024-001",
    "supplier_type": "productivo",
    "items": [
      {
        "material_code": "MAT-MOT-220V-001",
        "quantity": 100,
        "unit_cost": 1415.09,
        "total_cost": 141509.00,
        "products_affected": [
          {
            "product_id": 5,
            "product_name": "Abanico de Pared 220V",
            "cost_impact": 1415.09
          }
        ]
      }
    ],
    "total_production_cost": 141509.00
  }
}
```

---

## 📝 **NOTAS IMPORTANTES PARA EL FRONTEND**

### **Estados Actuales vs Pendientes**

#### **✅ IMPLEMENTADO:**
- CRUD básico de proveedores
- CRUD básico de OC (purchases)
- CRUD básico de items de OC
- Pagos básicos (con estructura extendida)
- Consultas y filtros básicos

#### **⚠️ PENDIENTE DE IMPLEMENTAR:**
- Campo `supplier_type` en proveedores
- Campo `debt_type` en OC
- Tabla `supplier_invoices` (Facturas)
- Tabla `supplier_delivery_notes` (Remitos)
- Tabla `supplier_accounts` (Cuenta Corriente)
- Tabla `supplier_account_movements` (Movimientos)
- Campo `material_code` en items
- Entregas parciales
- Validaciones de coincidencia Factura-Remito-Pago
- Trazabilidad completa
- Cálculo de costos de producción

### **Recomendaciones de Implementación**

1. **Fase 1 - Estructura Base:**
   - Agregar campos faltantes a tablas existentes
   - Crear tablas de facturas y remitos
   - Implementar CRUD básico

2. **Fase 2 - Lógica de Negocio:**
   - Implementar compromiso vs deuda
   - Implementar entregas parciales
   - Implementar validaciones

3. **Fase 3 - Cuenta Corriente:**
   - Implementar cuenta corriente
   - Implementar movimientos
   - Implementar resúmenes

4. **Fase 4 - Trazabilidad y Costos:**
   - Implementar trazabilidad completa
   - Implementar cálculo de costos
   - Implementar reportes

### **Manejo de Errores**

Todos los endpoints retornan errores en el siguiente formato:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Códigos HTTP:**
- **200**: Operación exitosa
- **201**: Recurso creado
- **400**: Error de validación
- **401**: No autorizado
- **403**: Acceso denegado
- **404**: Recurso no encontrado
- **409**: Conflicto (duplicado)
- **500**: Error interno

---

## 📚 **EJEMPLOS COMPLETOS**

### **Ejemplo 1: Flujo Completo Productivo**

```bash
# 1. Crear Proveedor Productivo
POST /api/purchases/suppliers
{
  "code": "PROV001",
  "name": "Motores Eléctricos S.A.",
  "supplier_type": "productivo",
  "legal_name": "Motores Eléctricos Sociedad Anónima",
  "trade_name": "Motores Eléctricos",
  "purchase_frequency": "mensual",
  "id_type": "CUIT",
  "tax_id": "30-12345678-9",
  "gross_income": "123456789",
  "vat_condition": "Responsable Inscripto",
  "account_description": "Proveedores - Motores",
  "product_service": "Motores eléctricos para abanicos",
  "integral_summary_account": "2.1.1.01",
  "cost": 1500.00,
  "has_account": true,
  "payment_terms": 30
}

# 2. Crear OC con Compromiso
POST /api/purchases
{
  "supplier_id": 1,
  "debt_type": "compromiso",
  "allows_partial_delivery": true,
  "items": [
    {
      "product_id": 5,
      "material_code": "MAT-MOT-220V-001",
      "quantity": 100,
      "unit_price": 1500.00,
      "unit_cost": 1500.00
    }
  ]
}

# 3. Recibir Remito
POST /api/suppliers/delivery-notes
{
  "delivery_note_number": "RE-2024-001",
  "supplier_id": 1,
  "purchase_id": 1,
  "delivery_date": "2024-01-18",
  "items": [
    {
      "material_code": "MAT-MOT-220V-001",
      "product_id": 5,
      "quantity": 100,
      "purchase_item_id": 1
    }
  ]
}

# 4. Recibir Factura
POST /api/suppliers/invoices
{
  "invoice_number": "FC-2024-001",
  "supplier_id": 1,
  "purchase_id": 1,
  "invoice_date": "2024-01-20",
  "due_date": "2024-02-20",
  "total_amount": 166981.13,
  "items": [
    {
      "material_code": "MAT-MOT-220V-001",
      "product_id": 5,
      "description": "Motor Eléctrico 220V",
      "quantity": 100,
      "unit_price": 1415.09,
      "unit_cost": 1415.09,
      "purchase_item_id": 1
    }
  ]
}

# 5. Vincular Remito a Factura
PUT /api/suppliers/invoices/1/link-delivery-note
{
  "delivery_note_id": 1
}

# 6. Registrar Pago
POST /api/payments
{
  "type": "outflow",
  "method": "transferencia",
  "amount": 166981.13,
  "payment_date": "2024-01-25T10:30:00.000Z",
  "payee_type": "supplier",
  "payee_id": 1,
  "invoice_id": 1
}
```

### **Ejemplo 2: Proveedor No Productivo - Factura sin OC**

```bash
# 1. Crear Factura sin OC (Proveedor No Productivo)
POST /api/suppliers/invoices
{
  "invoice_number": "FC-SERV-2024-001",
  "supplier_id": 5,
  "purchase_id": null,
  "invoice_date": "2024-01-20",
  "due_date": "2024-02-20",
  "subtotal": 47619.05,
  "tax_amount": 2380.95,
  "total_amount": 50000.00,
  "items": [
    {
      "description": "Servicio de limpieza mensual - Enero 2024",
      "quantity": 1,
      "unit_price": 50000.00
      // material_code no requerido para no productivos
    }
  ]
}

# 2. Registrar Pago (sin vincular inicialmente - anticipo)
POST /api/payments
{
  "type": "outflow",
  "method": "transferencia",
  "amount": 50000.00,
  "payment_date": "2024-01-18T10:30:00.000Z",
  "payee_type": "supplier",
  "payee_id": 5,
  "invoice_id": null,
  "notes": "Anticipo para servicio de limpieza"
}

# 3. Vincular Pago a Factura (cuando llegue la factura)
PUT /api/payments/10
{
  "invoice_id": 1
}
```

### **Ejemplo 3: Egreso sin Factura (Devengamiento)**

```bash
# 1. Registrar Egreso Devengado (Compromiso)
POST /api/suppliers/accrued-expenses
{
  "expense_type": "compromise",
  "concept": "Seguro anual de vehículos - 2024",
  "category": "seguro",
  "amount": 120000.00,
  "accrual_date": "2024-01-01",
  "due_date": "2024-12-31",
  "notes": "Seguro anual pagadero en cuotas trimestrales"
}

# 2. Registrar Pago del Egreso (Primera cuota)
POST /api/payments
{
  "type": "outflow",
  "method": "transferencia",
  "amount": 30000.00,
  "payment_date": "2024-01-15T10:30:00.000Z",
  "payee_type": "other",
  "accrued_expense_id": 1,
  "notes": "Primera cuota del seguro anual"
}

# 3. Vincular Factura (si llega después)
PUT /api/suppliers/accrued-expenses/1/link-invoice
{
  "invoice_id": 5
}
```

### **Ejemplo 4: Pasivo Devengado (Impuesto)**

```bash
# 1. Registrar Pasivo Devengado
POST /api/suppliers/accrued-liabilities
{
  "liability_type": "impuesto",
  "description": "IVA Trimestral - Q1 2024",
  "amount": 250000.00,
  "accrual_date": "2024-01-01",
  "due_date": "2024-04-15",
  "notes": "IVA del primer trimestre 2024"
}

# 2. Pago desde Tesorería (Pago Completo)
POST /api/suppliers/accrued-liabilities/1/link-payment
{
  "payment_id": 15,
  "amount": 250000.00,
  "payment_date": "2024-04-10",
  "notes": "Pago completo del IVA Q1 2024"
}
```

### **Ejemplo 5: Pasivo Devengado con Pagos Parciales**

```bash
# 1. Registrar Pasivo Devengado
POST /api/suppliers/accrued-liabilities
{
  "liability_type": "alquiler",
  "description": "Alquiler local comercial - 2024",
  "amount": 360000.00,
  "accrual_date": "2024-01-01",
  "due_date": "2024-12-31",
  "notes": "Alquiler anual pagadero mensualmente"
}

# 2. Primer Pago Mensual
POST /api/suppliers/accrued-liabilities/2/link-payment
{
  "payment_id": 20,
  "amount": 30000.00,
  "payment_date": "2024-01-05",
  "notes": "Pago alquiler enero 2024"
}

# 3. Segundo Pago Mensual
POST /api/suppliers/accrued-liabilities/2/link-payment
{
  "payment_id": 21,
  "amount": 30000.00,
  "payment_date": "2024-02-05",
  "notes": "Pago alquiler febrero 2024"
}

# El sistema actualiza automáticamente:
# - paid_amount = 60000.00
# - remaining_amount = 300000.00
# - status = 'partial_paid'
```

### **Ejemplo 6: Entrega Parcial**

```bash
# 1. OC con 200 unidades
POST /api/purchases
{
  "supplier_id": 1,
  "debt_type": "compromiso",
  "allows_partial_delivery": true,
  "items": [
    {
      "material_code": "MAT-ASP-PLA-001",
      "quantity": 200,
      "unit_price": 250.00
    }
  ]
}

# 2. Primer Remito Parcial (100 unidades)
POST /api/suppliers/delivery-notes
{
  "delivery_note_number": "RE-2024-001",
  "supplier_id": 1,
  "purchase_id": 1,
  "items": [
    {
      "material_code": "MAT-ASP-PLA-001",
      "quantity": 100,
      "purchase_item_id": 1
    }
  ]
}

# 3. Segundo Remito (100 unidades restantes)
POST /api/suppliers/delivery-notes
{
  "delivery_note_number": "RE-2024-002",
  "supplier_id": 1,
  "purchase_id": 1,
  "items": [
    {
      "material_code": "MAT-ASP-PLA-001",
      "quantity": 100,
      "purchase_item_id": 1
    }
  ]
}
```

---

## 🎯 **CHECKLIST DE IMPLEMENTACIÓN**

### **Backend (Completado ✅)**
- [x] Migración: Agregar `supplier_type` a `suppliers`
- [x] Migración: Agregar campos a `purchases` (debt_type, commitment_amount, etc.)
- [x] Migración: Agregar `material_code` a `purchase_items` (opcional)
- [x] Migración: Crear tabla `supplier_invoices`
- [x] Migración: Crear tabla `supplier_invoice_items` (material_code opcional)
- [x] Migración: Crear tabla `supplier_delivery_notes`
- [x] Migración: Crear tabla `supplier_delivery_note_items`
- [x] Migración: Crear tabla `supplier_accounts`
- [x] Migración: Crear tabla `supplier_account_movements`
- [x] Migración: Crear tabla `accrued_expenses` (egresos sin factura)
- [x] Migración: Crear tabla `accrued_liabilities` (pasivos devengados)
- [x] Migración: Crear tabla `accrued_liability_payments`
- [x] Entidades: Actualizar Purchase y Supplier
- [x] Entidades: Crear SupplierInvoice, SupplierDeliveryNote, SupplierAccount
- [x] Entidades: Crear AccruedExpense y AccruedLiability
- [x] Repositorios: SupplierInvoiceRepository
- [x] Repositorios: SupplierDeliveryNoteRepository
- [x] Repositorios: SupplierAccountRepository
- [x] Repositorios: AccruedExpenseRepository
- [x] Repositorios: AccruedLiabilityRepository
- [x] Servicios: Lógica de compromiso vs deuda
- [x] Servicios: Validaciones Factura-Remito-Pago
- [x] Servicios: Entregas parciales
- [x] Servicios: Egresos devengados
- [x] Servicios: Pasivos devengados y conciliación con tesorería
- [x] Servicios: Trazabilidad completa
- [x] Servicios: Costos de producción
- [x] Controladores: CRUD de facturas
- [x] Controladores: CRUD de remitos
- [x] Controladores: Cuenta corriente
- [x] Controladores: Egresos devengados
- [x] Controladores: Pasivos devengados
- [x] Rutas: Endpoints de facturas
- [x] Rutas: Endpoints de remitos
- [x] Rutas: Endpoints de cuenta corriente
- [x] Rutas: Endpoints de egresos devengados
- [x] Rutas: Endpoints de pasivos devengados
- [x] Validaciones: Middleware para nuevas entidades

### **Frontend (Recomendado)**
- [ ] Vista de Proveedores con filtro por tipo
- [ ] Vista de OC con indicador de compromiso/deuda
- [ ] Vista de Facturas con códigos de materiales
- [ ] Vista de Remitos con validación de coincidencia
- [ ] Vista de Cuenta Corriente con resumen
- [ ] Vista de Trazabilidad OC-Factura-Remito-Pago
- [ ] Formularios con validaciones
- [ ] Indicadores de entregas parciales
- [ ] Reportes de costos de producción

---

## 📞 **CONTACTO Y SOPORTE**

Para dudas o consultas sobre la implementación, contactar al equipo de desarrollo.

**Última actualización:** 2024-01-25

