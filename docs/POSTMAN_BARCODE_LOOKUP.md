# Guía de Pruebas Postman - Barcode Lookup API

## 🔐 Paso 1: Obtener Token JWT

Primero necesitas autenticarte para obtener un token.

### Request: Login
```
POST http://localhost:8086/api/auth/login
Content-Type: application/json

{
  "username": "tu_usuario",
  "password": "tu_password"
}
```

**En Postman:**
- Method: `POST`
- URL: `http://localhost:8086/api/auth/login`
- Headers:
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "username": "admin",
  "password": "tu_password"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

**Copia el `token` de la respuesta para usarlo en los siguientes requests.**

---

## 🔍 Paso 2: Buscar por Código de Barras

### Request: GET Barcode Lookup
```
GET http://localhost:8086/api/products/barcode/1234567890123
Authorization: Bearer <tu_token_aqui>
```

**En Postman:**

#### Configuración:
- **Method:** `GET`
- **URL:** `http://localhost:8086/api/products/barcode/1234567890123`
- **Headers:**
  - `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (reemplaza con tu token)
  - `Content-Type: application/json`

#### Códigos de Barras para Probar:

**Códigos de prueba UPCItemDB (pueden funcionar):**
- `0794000000000`
- `075678164125`
- `0123456789012`
- `1234567890123`

**Código de producto existente (si tienes productos con barcode):**
- Usa el código de barras de un producto que ya creaste en tu base de datos

#### Respuesta Esperada (si encuentra datos):
```json
{
  "success": true,
  "message": "Datos encontrados exitosamente",
  "data": {
    "title": "Nombre del Producto",
    "description": "Descripción del producto encontrado",
    "brand": "Marca del Producto",
    "images": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "source": "upcitemdb",
    "suggested_price": 1500.00,
    "category_suggestion": "Electrónica",
    "exists_as_product": false,
    "preview_message": "Hemos encontrado: Nombre del Producto",
    "available_actions": {
      "accept": true,
      "modify": true,
      "ignore": true
    },
    "provider_response_time": 1200
  },
  "timestamp": "2026-02-19T10:30:05.000Z"
}
```

#### Respuesta si el producto ya existe:
```json
{
  "success": true,
  "message": "Datos encontrados exitosamente",
  "data": {
    "title": "Producto Existente",
    "description": "...",
    "source": "products",
    "exists_as_product": true,
    "product_id": 123,
    "preview_message": "Producto ya existe: Producto Existente",
    "available_actions": {
      "accept": false,
      "modify": false,
      "ignore": false
    }
  }
}
```

#### Respuesta si no encuentra datos:
```json
{
  "success": false,
  "message": "No se encontraron datos para este código de barras",
  "timestamp": "2026-02-19T10:30:05.000Z"
}
```

---

## ✅ Paso 3: Aceptar Datos y Crear Producto

### Request: POST Accept Barcode Data
```
POST http://localhost:8086/api/products/barcode/1234567890123/accept
Authorization: Bearer <tu_token>
Content-Type: application/json

{
  "category_id": 5,
  "price": 1500.00,
  "stock": 10,
  "code": "PROD-001"
}
```

**En Postman:**

#### Configuración:
- **Method:** `POST`
- **URL:** `http://localhost:8086/api/products/barcode/1234567890123/accept`
- **Headers:**
  - `Authorization: Bearer <tu_token>`
  - `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "category_id": 5,
  "price": 1500.00,
  "stock": 10,
  "code": "PROD-001"
}
```

**Nota:** El campo `code` es opcional. Si no lo proporcionas, se generará automáticamente desde el barcode.

#### Respuesta Esperada:
```json
{
  "success": true,
  "message": "Producto creado exitosamente",
  "data": {
    "id": 123,
    "code": "PROD-001",
    "name": "Nombre del Producto",
    "description": "Descripción...",
    "barcode": "1234567890123",
    "price": 1500.00,
    "stock": 10,
    ...
  },
  "timestamp": "2026-02-19T10:30:05.000Z"
}
```

---

## ✏️ Paso 4: Modificar Datos y Crear Producto

### Request: POST Create Product from Barcode
```
POST http://localhost:8086/api/products/barcode/1234567890123/create
Authorization: Bearer <tu_token>
Content-Type: application/json

{
  "code": "PROD-001",
  "name": "Nombre Modificado del Producto",
  "description": "Descripción editada por el usuario",
  "price": 1500.00,
  "stock": 10,
  "category_id": 5,
  "barcode": "1234567890123",
  "images": ["https://example.com/image1.jpg"]
}
```

**En Postman:**

#### Configuración:
- **Method:** `POST`
- **URL:** `http://localhost:8086/api/products/barcode/1234567890123/create`
- **Headers:**
  - `Authorization: Bearer <tu_token>`
  - `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "code": "PROD-001",
  "name": "Auricular Logitech G435",
  "description": "Auricular gaming inalámbrico con micrófono",
  "price": 1500.00,
  "stock": 10,
  "category_id": 5,
  "barcode": "1234567890123",
  "images": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
}
```

**Campos requeridos:**
- `code` - Código interno del producto
- `name` - Nombre del producto
- `price` - Precio

**Campos opcionales:**
- `description` - Descripción
- `category_id` - ID de categoría
- `stock` - Stock inicial
- `barcode` - Debe coincidir con el parámetro de la URL
- `images` - Array de URLs de imágenes

---

## 🚫 Paso 5: Ignorar Datos Encontrados

### Request: POST Ignore Barcode Data
```
POST http://localhost:8086/api/products/barcode/1234567890123/ignore
Authorization: Bearer <tu_token>
```

**En Postman:**

#### Configuración:
- **Method:** `POST`
- **URL:** `http://localhost:8086/api/products/barcode/1234567890123/ignore`
- **Headers:**
  - `Authorization: Bearer <tu_token>`
  - `Content-Type: application/json`

#### Respuesta Esperada:
```json
{
  "success": true,
  "message": "Datos descartados exitosamente",
  "timestamp": "2026-02-19T10:30:05.000Z"
}
```

---

## 📋 Colección de Postman (JSON)

Puedes importar esta colección directamente en Postman:

```json
{
  "info": {
    "name": "Barcode Lookup API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Login",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"username\": \"admin\",\n  \"password\": \"tu_password\"\n}"
        },
        "url": {
          "raw": "http://localhost:8086/api/auth/login",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8086",
          "path": ["api", "auth", "login"]
        }
      }
    },
    {
      "name": "2. Buscar Barcode",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}",
            "description": "Reemplazar {{token}} con el token obtenido del login"
          }
        ],
        "url": {
          "raw": "http://localhost:8086/api/products/barcode/1234567890123",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8086",
          "path": ["api", "products", "barcode", "1234567890123"]
        }
      }
    },
    {
      "name": "3. Aceptar Datos",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"category_id\": 5,\n  \"price\": 1500.00,\n  \"stock\": 10,\n  \"code\": \"PROD-001\"\n}"
        },
        "url": {
          "raw": "http://localhost:8086/api/products/barcode/1234567890123/accept",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8086",
          "path": ["api", "products", "barcode", "1234567890123", "accept"]
        }
      }
    },
    {
      "name": "4. Crear con Modificaciones",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"code\": \"PROD-001\",\n  \"name\": \"Nombre Modificado\",\n  \"description\": \"Descripción editada\",\n  \"price\": 1500.00,\n  \"stock\": 10,\n  \"category_id\": 5,\n  \"barcode\": \"1234567890123\"\n}"
        },
        "url": {
          "raw": "http://localhost:8086/api/products/barcode/1234567890123/create",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8086",
          "path": ["api", "products", "barcode", "1234567890123", "create"]
        }
      }
    },
    {
      "name": "5. Ignorar Datos",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "http://localhost:8086/api/products/barcode/1234567890123/ignore",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8086",
          "path": ["api", "products", "barcode", "1234567890123", "ignore"]
        }
      }
    }
  ]
}
```

---

## ⚠️ Troubleshooting

### Error 401 Unauthorized
- Verifica que el token esté correcto
- Asegúrate de incluir `Bearer ` antes del token
- El token puede haber expirado, vuelve a hacer login

### Error 400 Bad Request
- Verifica que el código de barras tenga formato válido (8-14 dígitos)
- Revisa que el JSON del body esté bien formado

### Error 404 Not Found
- El código de barras no se encontró en ninguna fuente
- Verifica que el endpoint esté correcto

### Error 500 Internal Server Error
- Revisa los logs del servidor
- Verifica que la base de datos esté conectada
- Asegúrate de que las migraciones estén ejecutadas

---

## 🎯 Flujo Completo de Prueba

1. **Login** → Obtener token
2. **Buscar Barcode** → Ver datos encontrados
3. **Aceptar** o **Crear con Modificaciones** → Crear producto
4. **Buscar nuevamente** → Debería mostrar `exists_as_product: true`
