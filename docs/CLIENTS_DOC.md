# 📋 Módulo de Clientes - Documentación API

## 📚 Índice
1. [Descripción General](#descripción-general)
2. [Modelo de Datos](#modelo-de-datos)
3. [Endpoints](#endpoints)
4. [Autenticación y Autorización](#autenticación-y-autorización)
5. [Validaciones](#validaciones)
6. [Códigos de Respuesta](#códigos-de-respuesta)
7. [Ejemplos de Uso](#ejemplos-de-uso)

---

## 📝 Descripción General

El módulo de Clientes gestiona toda la información relacionada con los clientes del ERP Norte Abanicos. Soporta diferentes tipos de clientes (Mayorista, Minorista, Personalizado) con generación automática de códigos únicos.

### Características Principales
- ✅ CRUD completo de clientes
- ✅ Generación automática de códigos por tipo de cliente (MAY001, MIN001, PER001)
- ✅ Paginación y filtros avanzados
- ✅ Soft delete para clientes con pedidos
- ✅ Estadísticas de clientes
- ✅ Control de acceso basado en roles
- ✅ Validaciones robustas

---

## 🗃️ Modelo de Datos

### Entidad Client

```typescript
interface Client {
  id: number;                  // ID único del cliente
  code: string;                // Código único autogenerado (ej: MAY001, MIN002)
  client_type: ClientType;     // Tipo de cliente (mayorista, minorista, personalizado)
  sales_channel: SalesChannel; // Canal de venta de origen
  name: string;                // Nombre del cliente (requerido)
  email?: string;              // Email (opcional)
  phone?: string;              // Teléfono (opcional)
  address?: string;            // Dirección (opcional)
  city?: string;               // Ciudad (opcional)
  country?: string;            // País (por defecto: Argentina)
  is_active: boolean;          // Estado activo/inactivo
  created_at: string;          // Fecha de creación
  updated_at: string;          // Fecha de última actualización
}
```

### Tipos de Cliente (ClientType)

```typescript
enum ClientType {
  MAYORISTA = 'mayorista',           // Código: MAY###
  MINORISTA = 'minorista',           // Código: MIN###
  PERSONALIZADO = 'personalizado'    // Código: PER###
}
```

### Canales de Venta (SalesChannel)

```typescript
enum SalesChannel {
  WOOCOMMERCE_MINORISTA = 'woocommerce_minorista',   // WooCommerce Minorista
  WOOCOMMERCE_MAYORISTA = 'woocommerce_mayorista',   // WooCommerce Mayorista
  MERCADOLIBRE = 'mercadolibre',                     // MercadoLibre
  SISTEMA_NORTE = 'sistema_norte',                   // Sistema Norte
  MANUAL = 'manual',                                 // Creado manualmente en el sistema
  OTRO = 'otro'                                      // Otros canales
}
```

**Descripción de Canales:**
- **woocommerce_minorista**: Clientes provenientes de la tienda WooCommerce minorista
- **woocommerce_mayorista**: Clientes provenientes de la tienda WooCommerce mayorista
- **mercadolibre**: Clientes que compran a través de MercadoLibre
- **sistema_norte**: Clientes registrados en el Sistema Norte
- **manual**: Clientes creados manualmente por el equipo (default)
- **otro**: Clientes de otros canales no especificados

---

## 🔌 Endpoints

Base URL: `/api/clients`

### 1. Obtener Todos los Clientes

**GET** `/api/clients`

Obtiene una lista paginada de clientes con filtros opcionales.

#### Query Parameters

| Parámetro | Tipo    | Requerido | Descripción                                    | Default |
|-----------|---------|-----------|------------------------------------------------|---------|
| page          | number  | No        | Número de página                               | 1       |
| limit         | number  | No        | Cantidad de resultados por página              | 10      |
| all           | boolean | No        | Obtener todos sin paginación (all=true)        | false   |
| search        | string  | No        | Buscar por nombre, código o email              | -       |
| status        | string  | No        | Filtrar por estado: 'active' o 'inactive'      | -       |
| city          | string  | No        | Filtrar por ciudad                             | -       |
| sales_channel | string  | No        | Filtrar por canal de venta                     | -       |

#### Roles Autorizados
- `gerencia`
- `ventas`
- `finanzas`

**Nota:** Para acceder a este endpoint, la solicitud debe incluir el token de sesión JWT en el header `Authorization: Bearer <token>`.

#### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "message": "Clients retrieved successfully",
  "data": {
    "clients": [
      {
        "id": 1,
        "code": "MAY001",
        "client_type": "mayorista",
        "sales_channel": "woocommerce_mayorista",
        "name": "Distribuidora del Sur S.A.",
        "email": "contacto@delsur.com",
        "phone": "+54 11 4567-8900",
        "address": "Av. Corrientes 1234",
        "city": "Buenos Aires",
        "country": "Argentina",
        "is_active": true,
        "created_at": "2024-01-15T10:30:00.000Z",
        "updated_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "totalPages": 5
    }
  },
  "timestamp": "2024-01-20T15:45:30.000Z"
}
```

#### Ejemplos de Uso

```bash
# Obtener todos los clientes paginados (página 1, 10 por página)
GET /api/clients

# Obtener todos los clientes sin paginación
GET /api/clients?all=true

# Página 2 con 20 clientes por página
GET /api/clients?page=2&limit=20

# Buscar clientes por nombre, código o email
GET /api/clients?search=maria

# Filtrar solo clientes activos
GET /api/clients?status=active

# Filtrar por ciudad
GET /api/clients?city=Buenos Aires

# Filtrar por canal de venta
GET /api/clients?sales_channel=woocommerce_minorista

# Combinación de filtros
GET /api/clients?status=active&city=Córdoba&search=distribuidora

# Filtrar clientes de WooCommerce mayorista activos
GET /api/clients?sales_channel=woocommerce_mayorista&status=active
```

---

### 2. Obtener Estadísticas de Clientes

**GET** `/api/clients/stats`

Obtiene estadísticas generales sobre los clientes.

#### Roles Autorizados
- `gerencia`
- `ventas`
- `finanzas`

**Nota:** Para acceder a este endpoint, la solicitud debe incluir el token de sesión JWT en el header `Authorization: Bearer <token>`.

#### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "message": "Client statistics retrieved successfully",
  "data": {
    "total_clients": 150,
    "active_clients": 142,
    "inactive_clients": 8,
    "cities_count": 25,
    "new_clients_this_month": 12
  },
  "timestamp": "2024-01-20T15:45:30.000Z"
}
```

---

### 3. Obtener Cliente por ID

**GET** `/api/clients/:id`

Obtiene los detalles de un cliente específico.

#### Path Parameters

| Parámetro | Tipo   | Descripción        |
|-----------|--------|--------------------|
| id        | number | ID del cliente     |

#### Roles Autorizados
- `gerencia`
- `ventas`
- `finanzas`

**Nota:** Para acceder a este endpoint, la solicitud debe incluir el token de sesión JWT en el header `Authorization: Bearer <token>`.

#### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "message": "Client retrieved successfully",
  "data": {
    "id": 1,
    "code": "MAY001",
    "client_type": "mayorista",
    "sales_channel": "woocommerce_mayorista",
    "name": "Distribuidora del Sur S.A.",
    "email": "contacto@delsur.com",
    "phone": "+54 11 4567-8900",
    "address": "Av. Corrientes 1234",
    "city": "Buenos Aires",
    "country": "Argentina",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-20T15:45:30.000Z"
}
```

#### Respuesta Error (404 Not Found)

```json
{
  "success": false,
  "message": "Client not found",
  "timestamp": "2024-01-20T15:45:30.000Z"
}
```

---

### 4. Crear Nuevo Cliente

**POST** `/api/clients`

Crea un nuevo cliente con código autogenerado.

#### Roles Autorizados
- `gerencia`
- `ventas`

**Nota:** Para acceder a este endpoint, la solicitud debe incluir el token de sesión JWT en el header `Authorization: Bearer <token>`.

#### Body Parameters

| Campo         | Tipo         | Requerido | Descripción                                    |
|---------------|--------------|-----------|------------------------------------------------|
| name          | string       | ✅ Sí     | Nombre del cliente (2-100 caracteres)         |
| client_type   | ClientType   | No        | Tipo de cliente (default: 'minorista')        |
| sales_channel | SalesChannel | No        | Canal de venta (default: 'manual')            |
| email         | string       | No        | Email válido                                   |
| phone         | string       | No        | Teléfono (máx 20 caracteres)                  |
| address       | string       | No        | Dirección (máx 500 caracteres)                |
| city          | string       | No        | Ciudad (máx 50 caracteres)                    |
| country       | string       | No        | País (default: 'Argentina', máx 50 caracteres)|

**Nota:** El campo `code` se genera automáticamente según el `client_type`.

#### Request Body

```json
{
  "name": "Ferretería El Tornillo",
  "client_type": "minorista",
  "sales_channel": "manual",
  "email": "info@eltornillo.com",
  "phone": "+54 351 456-7890",
  "address": "Calle Principal 456",
  "city": "Córdoba",
  "country": "Argentina"
}
```

#### Respuesta Exitosa (201 Created)

```json
{
  "success": true,
  "message": "Client created successfully",
  "data": {
    "id": 25,
    "code": "MIN012",
    "client_type": "minorista",
    "sales_channel": "manual",
    "name": "Ferretería El Tornillo",
    "email": "info@eltornillo.com",
    "phone": "+54 351 456-7890",
    "address": "Calle Principal 456",
    "city": "Córdoba",
    "country": "Argentina",
    "is_active": true,
    "created_at": "2024-01-20T15:45:30.000Z",
    "updated_at": "2024-01-20T15:45:30.000Z"
  },
  "timestamp": "2024-01-20T15:45:30.000Z"
}
```

#### Respuesta Error (400 Bad Request)

```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Client name is required",
  "timestamp": "2024-01-20T15:45:30.000Z"
}
```

---

### 5. Actualizar Cliente

**PUT** `/api/clients/:id`

Actualiza la información de un cliente existente.

#### Path Parameters

| Parámetro | Tipo   | Descripción        |
|-----------|--------|--------------------|
| id        | number | ID del cliente     |

#### Roles Autorizados
- `gerencia`
- `ventas`

**Nota:** Para acceder a este endpoint, la solicitud debe incluir el token de sesión JWT en el header `Authorization: Bearer <token>`.

#### Body Parameters (todos opcionales)

| Campo         | Tipo         | Descripción                                    |
|---------------|--------------|------------------------------------------------|
| code          | string       | Código del cliente (3-20 caracteres, A-Z0-9)  |
| client_type   | ClientType   | Tipo de cliente                                |
| sales_channel | SalesChannel | Canal de venta de origen                       |
| name          | string       | Nombre del cliente (2-100 caracteres)         |
| email         | string       | Email válido                                   |
| phone         | string       | Teléfono (máx 20 caracteres)                  |
| address       | string       | Dirección (máx 500 caracteres)                |
| city          | string       | Ciudad (máx 50 caracteres)                    |
| country       | string       | País (máx 50 caracteres)                       |
| is_active     | boolean      | Estado activo/inactivo                         |

#### Request Body

```json
{
  "phone": "+54 351 456-7891",
  "address": "Calle Principal 789",
  "is_active": true
}
```

#### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "message": "Client updated successfully",
  "data": {
    "id": 25,
    "code": "MIN012",
    "client_type": "minorista",
    "sales_channel": "manual",
    "name": "Ferretería El Tornillo",
    "email": "info@eltornillo.com",
    "phone": "+54 351 456-7891",
    "address": "Calle Principal 789",
    "city": "Córdoba",
    "country": "Argentina",
    "is_active": true,
    "created_at": "2024-01-20T15:45:30.000Z",
    "updated_at": "2024-01-20T16:30:00.000Z"
  },
  "timestamp": "2024-01-20T16:30:00.000Z"
}
```

#### Respuestas de Error

**404 Not Found**
```json
{
  "success": false,
  "message": "Client not found",
  "timestamp": "2024-01-20T16:30:00.000Z"
}
```

**409 Conflict** (código duplicado)
```json
{
  "success": false,
  "message": "Client code already exists",
  "timestamp": "2024-01-20T16:30:00.000Z"
}
```

**400 Bad Request** (sin campos para actualizar)
```json
{
  "success": false,
  "message": "No fields to update",
  "timestamp": "2024-01-20T16:30:00.000Z"
}
```

---

### 6. Eliminar Cliente

**DELETE** `/api/clients/:id`

Elimina un cliente. Si el cliente tiene pedidos asociados, realiza un soft delete (desactiva); si no tiene pedidos, realiza un hard delete (elimina completamente).

#### Path Parameters

| Parámetro | Tipo   | Descripción        |
|-----------|--------|--------------------|
| id        | number | ID del cliente     |

#### Roles Autorizados
- `gerencia`
- `ventas`

**Nota:** Para acceder a este endpoint, la solicitud debe incluir el token de sesión JWT en el header `Authorization: Bearer <token>`.

#### Respuesta Exitosa - Soft Delete (200 OK)

```json
{
  "success": true,
  "message": "Client deactivated successfully (has associated orders)",
  "timestamp": "2024-01-20T16:45:00.000Z"
}
```

#### Respuesta Exitosa - Hard Delete (200 OK)

```json
{
  "success": true,
  "message": "Client deleted successfully",
  "timestamp": "2024-01-20T16:45:00.000Z"
}
```

#### Respuesta Error (404 Not Found)

```json
{
  "success": false,
  "message": "Client not found",
  "timestamp": "2024-01-20T16:45:00.000Z"
}
```

---

## 🔐 Autenticación y Autorización

### Autenticación
Todos los endpoints requieren autenticación JWT mediante el header:

```
Authorization: Bearer <token>
```

### Roles y Permisos

| Endpoint                      | Gerencia | Ventas | Finanzas | Logística |
|-------------------------------|----------|--------|----------|-----------|
| GET /api/clients              | ✅       | ✅     | ✅       | ❌        |
| GET /api/clients/stats        | ✅       | ✅     | ✅       | ❌        |
| GET /api/clients/:id          | ✅       | ✅     | ✅       | ❌        |
| POST /api/clients             | ✅       | ✅     | ❌       | ❌        |
| PUT /api/clients/:id          | ✅       | ✅     | ❌       | ❌        |
| DELETE /api/clients/:id       | ✅       | ✅     | ❌       | ❌        |

---

## ✅ Validaciones

### Crear Cliente (POST)

| Campo         | Validación                                                                        |
|---------------|-----------------------------------------------------------------------------------|
| name          | Requerido, 2-100 caracteres, trim                                                |
| client_type   | Debe ser: 'mayorista', 'minorista', o 'personalizado'                            |
| sales_channel | Debe ser: 'woocommerce_minorista', 'woocommerce_mayorista', 'mercadolibre', 'sistema_norte', 'manual', 'otro' |
| email         | Formato email válido, normalizado                                                 |
| phone         | Máximo 20 caracteres, solo: dígitos, espacios, -, +, (, )                       |
| address       | Máximo 500 caracteres, trim                                                       |
| city          | Máximo 50 caracteres, trim                                                        |
| country       | Máximo 50 caracteres, trim                                                        |

### Actualizar Cliente (PUT)

| Campo         | Validación                                                                        |
|---------------|-----------------------------------------------------------------------------------|
| code          | 3-20 caracteres, solo letras mayúsculas y números (A-Z0-9)                       |
| client_type   | Debe ser: 'mayorista', 'minorista', o 'personalizado'                            |
| sales_channel | Debe ser: 'woocommerce_minorista', 'woocommerce_mayorista', 'mercadolibre', 'sistema_norte', 'manual', 'otro' |
| name          | 2-100 caracteres, trim                                                            |
| email         | Formato email válido, normalizado                                                 |
| phone         | Máximo 20 caracteres, solo: dígitos, espacios, -, +, (, )                       |
| address       | Máximo 500 caracteres, trim                                                       |
| city          | Máximo 50 caracteres, trim                                                        |
| country       | Máximo 50 caracteres, trim                                                        |
| is_active     | Debe ser boolean (true/false)                                                     |

---

## 📊 Códigos de Respuesta

| Código | Descripción                                    |
|--------|------------------------------------------------|
| 200    | OK - Operación exitosa                         |
| 201    | Created - Cliente creado exitosamente          |
| 400    | Bad Request - Validación fallida               |
| 401    | Unauthorized - Token inválido o expirado       |
| 403    | Forbidden - Sin permisos para esta operación   |
| 404    | Not Found - Cliente no encontrado              |
| 409    | Conflict - Código de cliente ya existe         |
| 500    | Internal Server Error - Error del servidor     |

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Crear Cliente Mayorista

```bash
curl -X POST http://localhost:3000/api/clients \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Distribuidora Central S.A.",
    "client_type": "mayorista",
    "sales_channel": "woocommerce_mayorista",
    "email": "ventas@central.com",
    "phone": "+54 11 4444-5555",
    "address": "Av. Libertador 2000",
    "city": "Buenos Aires"
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Client created successfully",
  "data": {
    "id": 26,
    "code": "MAY015",
    "client_type": "mayorista",
    "sales_channel": "woocommerce_mayorista",
    "name": "Distribuidora Central S.A.",
    "email": "ventas@central.com",
    "phone": "+54 11 4444-5555",
    "address": "Av. Libertador 2000",
    "city": "Buenos Aires",
    "country": "Argentina",
    "is_active": true,
    "created_at": "2024-01-20T17:00:00.000Z",
    "updated_at": "2024-01-20T17:00:00.000Z"
  },
  "timestamp": "2024-01-20T17:00:00.000Z"
}
```

---

### Ejemplo 2: Buscar Clientes Activos en Buenos Aires

```bash
curl -X GET "http://localhost:3000/api/clients?status=active&city=Buenos%20Aires&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Ejemplo 3: Actualizar Teléfono de Cliente

```bash
curl -X PUT http://localhost:3000/api/clients/26 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+54 11 4444-6666"
  }'
```

---

### Ejemplo 4: Obtener Todos los Clientes sin Paginación

```bash
curl -X GET "http://localhost:3000/api/clients?all=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Ejemplo 5: Desactivar Cliente

```bash
curl -X PUT http://localhost:3000/api/clients/26 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false
  }'
```

---

### Ejemplo 6: Eliminar Cliente

```bash
curl -X DELETE http://localhost:3000/api/clients/26 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎯 Sistema de Códigos Autogenerados

El sistema genera automáticamente códigos únicos para cada cliente según su tipo:

### Formato de Códigos

| Tipo Cliente    | Prefijo | Formato  | Ejemplo |
|-----------------|---------|----------|---------|
| Mayorista       | MAY     | MAY###   | MAY001  |
| Minorista       | MIN     | MIN###   | MIN045  |
| Personalizado   | PER     | PER###   | PER012  |

### Lógica de Generación

1. Se extrae el prefijo del tipo de cliente (primeros 3 caracteres en mayúsculas)
2. Se busca el código más alto existente para ese tipo
3. Se incrementa el número en 1
4. Se formatea con ceros a la izquierda (3 dígitos)

**Ejemplo:**
- Último cliente mayorista: `MAY045`
- Nuevo cliente mayorista: `MAY046`

---

## 📈 Estadísticas Disponibles

### Métricas de Clientes

El endpoint `/api/clients/stats` proporciona:

- **total_clients**: Cantidad total de clientes en el sistema
- **active_clients**: Clientes actualmente activos
- **inactive_clients**: Clientes desactivados
- **cities_count**: Cantidad de ciudades únicas
- **new_clients_this_month**: Clientes creados en el último mes

---

## 🔄 Soft Delete vs Hard Delete

### Soft Delete
- Se aplica cuando el cliente **tiene pedidos asociados**
- El cliente se desactiva (`is_active = false`)
- Los datos históricos se mantienen
- El cliente puede reactivarse

### Hard Delete
- Se aplica cuando el cliente **NO tiene pedidos**
- El registro se elimina completamente de la base de datos
- Es una operación irreversible

---

## 🛡️ Mejores Prácticas

1. **Siempre proporcionar un nombre descriptivo** para el cliente
2. **Validar emails y teléfonos** antes de enviar
3. **Usar el parámetro `all=true`** con precaución en bases de datos grandes
4. **Implementar paginación** para listados grandes
5. **Preferir soft delete** para mantener historial
6. **Usar filtros combinados** para búsquedas específicas
7. **Verificar permisos de rol** antes de operaciones de escritura

---

## 📞 Soporte

Para consultas o problemas, contactar al equipo de desarrollo:
- **Email**: desarrollo@norteabanicos.com
- **Documentación**: [README.md](./README.md)

---

**Última actualización:** Octubre 2025  
**Versión API:** 1.0.0

