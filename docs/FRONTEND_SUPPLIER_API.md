# 📋 GUÍA PARA EL FRONTEND - API DE PROVEEDORES

## 🎯 ENDPOINTS DISPONIBLES

### **GET** `/api/purchases/suppliers` - Listar Proveedores

### **Autenticación**
Requiere Bearer Token en el header:
```
Authorization: Bearer <jwt_token>
```

### **Permisos**
- Roles permitidos: `gerencia`, `finanzas`, `logistica`

### **Query Parameters:**
- `page` (opcional, default: 1): Número de página
- `limit` (opcional, default: 10): Elementos por página
- `search` (opcional): Buscar por nombre, código o contacto
- `city` (opcional): Filtrar por ciudad
- `is_active` (opcional): Filtrar por estado activo (`true`/`false`)
- `all` (opcional, default: `false`): Si es `true`, retorna todos sin paginación

### **Ejemplo de Request:**
```bash
GET /api/purchases/suppliers?page=1&limit=10&search=proveedor&is_active=true
Authorization: Bearer <token>
```

### **Estructura de Response (200 OK):**

#### **Con Paginación (default):**
```json
{
  "success": true,
  "message": "Suppliers retrieved successfully",
  "data": {
    "suppliers": [
      {
        "id": 1,
        "code": "PROV001",
        "name": "Proveedor Test",
        "contact_name": null,
        "email": null,
        "phone": null,
        "address": null,
        "city": null,
        "country": "Argentina",
        "is_active": true,
        "created_at": "2024-01-25T10:30:00.000Z",
        "updated_at": "2024-01-25T10:30:00.000Z"
      },
      {
        "id": 2,
        "code": "PROV002",
        "name": "Motores Eléctricos S.A.",
        "contact_name": "Juan Pérez",
        "email": "juan@proveedor.com",
        "phone": "+54 11 1234-5678",
        "address": "Av. Corrientes 1234",
        "city": "Buenos Aires",
        "country": "Argentina",
        "is_active": true,
        "created_at": "2024-01-25T11:00:00.000Z",
        "updated_at": "2024-01-25T11:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  },
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

#### **Sin Paginación (`all=true`):**
```json
{
  "success": true,
  "message": "All suppliers retrieved successfully",
  "data": {
    "suppliers": [
      {
        "id": 1,
        "code": "PROV001",
        "name": "Proveedor Test",
        "contact_name": null,
        "email": null,
        "phone": null,
        "address": null,
        "city": null,
        "country": "Argentina",
        "is_active": true,
        "created_at": "2024-01-25T10:30:00.000Z",
        "updated_at": "2024-01-25T10:30:00.000Z"
      }
    ],
    "total": 25,
    "message": "All suppliers retrieved (no pagination applied)"
  },
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

### **Estructura del Objeto Supplier:**
```typescript
interface Supplier {
  id: number;
  code: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string;
  is_active: boolean;
  created_at: string;  // ISO 8601 format
  updated_at: string;  // ISO 8601 format
  
  // Nota: Los siguientes campos estarán disponibles después de ejecutar la migración:
  // supplier_type?: string;
  // legal_name?: string | null;
  // trade_name?: string | null;
  // purchase_frequency?: string | null;
  // id_type?: string | null;
  // tax_id?: string | null;
  // gross_income?: string | null;
  // vat_condition?: string | null;
  // account_description?: string | null;
  // product_service?: string | null;
  // integral_summary_account?: string | null;
  // cost?: number | null;
  // has_account?: boolean;
  // payment_terms?: number;
}
```

### **Response de Error (500 Internal Server Error):**
```json
{
  "success": false,
  "message": "Error retrieving suppliers",
  "error": "Error message details",
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

---

## 🎯 ENDPOINT: Crear Proveedor

### **POST** `/api/purchases/suppliers`

### **Autenticación**
Requiere Bearer Token en el header:
```
Authorization: Bearer <jwt_token>
```

### **Permisos**
- Roles permitidos: `gerencia`, `finanzas`

---

## 📝 Estructura del Request

### **Campos Requeridos:**
- `code` (string, máximo 20 caracteres) - **OBLIGATORIO**
- `name` (string, máximo 100 caracteres) - **OBLIGATORIO**

### **Campos Opcionales:**
Todos los demás campos son opcionales y pueden ser enviados como `null` o simplemente omitidos del request.

```typescript
interface CreateSupplierRequest {
  // Campos requeridos
  code: string;
  name: string;
  
  // Campos opcionales - pueden ser null o undefined
  supplier_type?: 'productivo' | 'no_productivo' | 'otro_pasivo';
  legal_name?: string | null;           // Razón Social
  trade_name?: string | null;           // Nombre de Fantasía
  purchase_frequency?: string | null;   // Frecuencia de Compra
  id_type?: 'CUIT' | 'CUIL' | 'DNI' | 'PASAPORTE' | 'OTRO' | null;
  tax_id?: string | null;               // CUIT
  gross_income?: string | null;         // Ingresos Brutos
  vat_condition?: 'Responsable Inscripto' | 'Monotributista' | 'Exento' | 'No Responsable' | 'Consumidor Final' | null;
  account_description?: string | null;  // Descripción de Cuenta
  product_service?: string | null;      // Producto/Servicio
  integral_summary_account?: string | null; // Cuenta de Resumen Integral
  cost?: number | null;                 // Costo
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  has_account?: boolean;
  payment_terms?: number;
}
```

---

## ✅ Ejemplos de Request

### **Ejemplo 1: Mínimo requerido (solo código y nombre)**
```json
{
  "code": "PROV001",
  "name": "Proveedor Test"
}
```

### **Ejemplo 2: Con algunos campos opcionales**
```json
{
  "code": "PROV002",
  "name": "Motores Eléctricos S.A.",
  "supplier_type": "productivo",
  "legal_name": "Motores Eléctricos Sociedad Anónima",
  "tax_id": "30-12345678-9",
  "vat_condition": "Responsable Inscripto"
}
```

### **Ejemplo 3: Con campos null explícitos (para completar después)**
```json
{
  "code": "PROV003",
  "name": "Proveedor Nuevo",
  "legal_name": null,
  "trade_name": null,
  "tax_id": null,
  "vat_condition": null
}
```

### **Ejemplo 4: Completo (todos los campos)**
```json
{
  "code": "PROV004",
  "name": "Proveedor Completo S.A.",
  "supplier_type": "productivo",
  "legal_name": "Proveedor Completo Sociedad Anónima",
  "trade_name": "Proveedor Completo",
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

---

## 📤 Estructura del Response

### **Response exitoso (201 Created)**
```json
{
  "success": true,
  "message": "Supplier created successfully",
  "data": {
    "id": 1,
    "code": "PROV001",
    "name": "Proveedor Test",
    "supplier_type": "no_productivo",
    "legal_name": null,
    "trade_name": null,
    "purchase_frequency": null,
    "id_type": null,
    "tax_id": null,
    "gross_income": null,
    "vat_condition": null,
    "account_description": null,
    "product_service": null,
    "integral_summary_account": null,
    "cost": null,
    "contact_name": null,
    "email": null,
    "phone": null,
    "address": null,
    "city": null,
    "country": "Argentina",
    "has_account": true,
    "payment_terms": 30,
    "is_active": true,
    "created_at": "2024-01-25T10:30:00.000Z",
    "updated_at": "2024-01-25T10:30:00.000Z"
  },
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

### **Response de error - Validación (400 Bad Request)**
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "code es requerido, name es requerido",
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

### **Response de error - Código duplicado (500 Internal Server Error)**
```json
{
  "success": false,
  "message": "Error creating supplier",
  "error": "El código de proveedor ya existe",
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

---

## 🔄 Flujo de Trabajo Recomendado

### **Opción 1: Crear básico y completar después**
1. Usuario crea proveedor con solo `code` y `name`
2. Se guarda el proveedor con los demás campos en `null`
3. Usuario puede completar el resto de campos después usando **PUT** `/api/purchases/suppliers/:id`

### **Opción 2: Crear completo desde el inicio**
1. Usuario completa todos los campos en el formulario
2. Se envía el request completo
3. El proveedor se guarda con toda la información

---

## 📝 Validaciones

### **Campos Requeridos:**
- `code`: No puede estar vacío, máximo 20 caracteres, debe ser único
- `name`: No puede estar vacío, máximo 100 caracteres

### **Campos Opcionales con Validaciones:**
- `supplier_type`: Si se envía, debe ser uno de: `'productivo'`, `'no_productivo'`, `'otro_pasivo'`
- `legal_name`: Si se envía, máximo 255 caracteres
- `trade_name`: Si se envía, máximo 255 caracteres
- `purchase_frequency`: Si se envía, máximo 50 caracteres
- `id_type`: Si se envía, debe ser uno de: `'CUIT'`, `'CUIL'`, `'DNI'`, `'PASAPORTE'`, `'OTRO'`
- `tax_id`: Si se envía, máximo 20 caracteres
- `gross_income`: Si se envía, máximo 50 caracteres
- `vat_condition`: Si se envía, debe ser una condición IVA válida
- `account_description`: Si se envía, debe ser texto
- `product_service`: Si se envía, debe ser texto
- `integral_summary_account`: Si se envía, máximo 100 caracteres
- `cost`: Si se envía, debe ser un número positivo
- `email`: Si se envía, debe ser un email válido
- `phone`: Si se envía, máximo 20 caracteres
- `address`: Si se envía, máximo 500 caracteres
- `city`: Si se envía, máximo 50 caracteres
- `country`: Si se envía, máximo 50 caracteres
- `payment_terms`: Si se envía, debe ser un número entero positivo

---

## 🚨 Errores Comunes

### **Error: "code es requerido"**
- **Causa**: No se envió el campo `code`
- **Solución**: Asegurarse de incluir `code` en el request

### **Error: "El código de proveedor ya existe"**
- **Causa**: Ya existe un proveedor con ese código
- **Solución**: Usar un código diferente

### **Error: "Validation failed"**
- **Causa**: Algún campo no cumple las validaciones (formato, longitud, etc.)
- **Solución**: Revisar el mensaje de error y corregir el campo indicado

---

## 🔗 Endpoints Relacionados

### **Listar Proveedores**
- **GET** `/api/purchases/suppliers`
- Lista todos los proveedores con paginación y filtros
- Ver estructura de respuesta arriba

### **Obtener Proveedor por ID**
- **GET** `/api/purchases/suppliers/:id`
- Obtiene la información completa de un proveedor específico

**Ejemplo de Response (200 OK):**
```json
{
  "success": true,
  "message": "Supplier retrieved successfully",
  "data": {
    "id": 1,
    "code": "PROV001",
    "name": "Proveedor Test",
    "contact_name": null,
    "email": null,
    "phone": null,
    "address": null,
    "city": null,
    "country": "Argentina",
    "is_active": true,
    "created_at": "2024-01-25T10:30:00.000Z",
    "updated_at": "2024-01-25T10:30:00.000Z"
  },
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

### **Actualizar Proveedor**
- **PUT** `/api/purchases/suppliers/:id`
- Permite actualizar cualquier campo del proveedor después de crearlo

**Ejemplo de Request:**
```json
{
  "name": "Nuevo Nombre",
  "email": "nuevo@email.com",
  "legal_name": "Nueva Razón Social S.A.",
  "tax_id": "30-12345678-9"
}
```

**Ejemplo de Response (200 OK):**
```json
{
  "success": true,
  "message": "Supplier updated successfully",
  "data": {
    "id": 1,
    "code": "PROV001",
    "name": "Nuevo Nombre",
    "email": "nuevo@email.com",
    "legal_name": "Nueva Razón Social S.A.",
    "tax_id": "30-12345678-9",
    "updated_at": "2024-01-25T12:00:00.000Z"
  },
  "timestamp": "2024-01-25T12:00:00.000Z"
}
```

### **Eliminar Proveedor**
- **DELETE** `/api/purchases/suppliers/:id`
- Elimina un proveedor (soft delete si tiene compras asociadas)

**Ejemplo de Response (200 OK):**
```json
{
  "success": true,
  "message": "Supplier deleted successfully",
  "timestamp": "2024-01-25T12:00:00.000Z"
}
```

---

## 💡 Notas Importantes

1. **Campos opcionales**: Todos los campos excepto `code` y `name` son opcionales. Pueden enviarse como `null` o simplemente omitirse.

2. **Valores por defecto**:
   - `supplier_type`: Si no se envía, se establece como `'no_productivo'`
   - `country`: Si no se envía, se establece como `'Argentina'`
   - `has_account`: Si no se envía, se establece como `true`
   - `payment_terms`: Si no se envía, se establece como `30` días

3. **Completar campos después**: Es totalmente válido crear un proveedor con solo `code` y `name`, y completar el resto de campos después usando el endpoint de actualización.

4. **Código único**: El campo `code` debe ser único en todo el sistema. Si se intenta crear un proveedor con un código que ya existe, se retornará un error.

