# 🔑 Módulo de API Keys - Documentación Completa

## 📚 Índice

1. [Descripción General](#descripción-general)
2. [Características](#características)
3. [Instalación y Migración](#instalación-y-migración)
4. [Modelo de Datos](#modelo-de-datos)
5. [Endpoints](#endpoints)
6. [Autenticación](#autenticación)
7. [Ejemplos de Uso](#ejemplos-de-uso)
8. [Seguridad](#seguridad)
9. [Troubleshooting](#troubleshooting)

---

## 📝 Descripción General

El módulo de API Keys permite gestionar múltiples claves de API para diferentes desarrolladores e integraciones externas. Este sistema reemplaza la API Key única configurada en variables de entorno, permitiendo:

- ✅ Crear múltiples API Keys para diferentes integraciones
- ✅ Gestionar y revocar acceso individualmente
- ✅ Configurar límites de rate limiting por API Key
- ✅ Restringir acceso por IP
- ✅ Establecer fechas de expiración
- ✅ Registrar y auditar el uso de cada API Key

---

## 🎯 Características

### Funcionalidades Principales

- **CRUD Completo**: Crear, leer, actualizar y eliminar API Keys
- **Autenticación Mejorada**: Validación contra base de datos con fallback a variable de entorno
- **Rate Limiting**: Límites configurables por minuto y por hora
- **Restricción por IP**: Permitir solo ciertas IPs para cada API Key
- **Expiración**: Fechas de expiración opcionales
- **Logs de Auditoría**: Registro de todas las peticiones por API Key
- **Soft Delete**: Desactivar API Keys sin eliminarlas permanentemente
- **Metadatos**: Almacenar información adicional en formato JSON

---

## 🚀 Instalación y Migración

### 1. Ejecutar la Migración

```bash
# Opción 1: Desde MySQL directamente
mysql -u root -p norte_erp_db < src/database/migration_api_keys.sql

# Opción 2: Usando el script de migración (si existe)
npm run migrate:api-keys
```

### 2. Verificar que las Tablas se Crearon

```sql
-- Verificar tabla api_keys
SHOW TABLES LIKE 'api_keys';

-- Verificar tabla api_key_logs
SHOW TABLES LIKE 'api_key_logs';

-- Ver estructura de api_keys
DESCRIBE api_keys;
```

### 3. Reiniciar la Aplicación

```bash
pm2 restart norte-erp-api
# o
pm2 reload norte-erp-api
```

---

## 🗃️ Modelo de Datos

### Tabla: `api_keys`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | ID único (PK) |
| `key_name` | VARCHAR(100) | Nombre descriptivo de la API Key |
| `api_key` | VARCHAR(255) | La API Key en texto plano (solo referencia) |
| `key_hash` | VARCHAR(255) | Hash de la API Key para validación |
| `description` | TEXT | Descripción del uso |
| `created_by` | INT | Usuario que creó la API Key (FK → users) |
| `is_active` | BOOLEAN | Si la API Key está activa |
| `last_used_at` | TIMESTAMP | Última vez que se usó |
| `expires_at` | TIMESTAMP | Fecha de expiración (NULL = sin expiración) |
| `rate_limit_per_minute` | INT | Límite de peticiones por minuto |
| `rate_limit_per_hour` | INT | Límite de peticiones por hora |
| `allowed_ips` | TEXT | IPs permitidas separadas por coma |
| `metadata` | JSON | Metadatos adicionales |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Fecha de última actualización |

### Tabla: `api_key_logs`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | ID único (PK) |
| `api_key_id` | INT | ID de la API Key (FK → api_keys) |
| `endpoint` | VARCHAR(255) | Endpoint accedido |
| `method` | VARCHAR(10) | Método HTTP |
| `ip_address` | VARCHAR(45) | IP desde donde se hizo la petición |
| `user_agent` | TEXT | User agent del cliente |
| `response_status` | INT | Código de respuesta HTTP |
| `response_time_ms` | INT | Tiempo de respuesta en ms |
| `created_at` | TIMESTAMP | Fecha del log |

---

## 🔌 Endpoints

### Base URL
```
/api/api-keys
```

### Autenticación
Todos los endpoints requieren autenticación JWT con roles `admin` o `gerencia`.

---

### 1. Listar API Keys

**GET** `/api/api-keys`

Obtiene una lista paginada de API Keys.

#### Query Parameters

| Parámetro | Tipo | Requerido | Descripción | Default |
|-----------|------|-----------|-------------|---------|
| `page` | number | No | Número de página | 1 |
| `limit` | number | No | Resultados por página | 10 |
| `is_active` | boolean | No | Filtrar por estado activo | - |
| `search` | string | No | Buscar por nombre o descripción | - |

#### Ejemplo de Request

```http
GET /api/api-keys?page=1&limit=10&is_active=true
Authorization: Bearer <jwt_token>
```

#### Ejemplo de Response (200 OK)

```json
{
  "success": true,
  "message": "API Keys obtenidas exitosamente",
  "data": {
    "apiKeys": [
      {
        "id": 1,
        "key_name": "n8n Integration",
        "api_key": "***HIDDEN***",
        "description": "API Key para integración con n8n",
        "is_active": true,
        "last_used_at": "2024-01-20T15:30:00Z",
        "expires_at": null,
        "rate_limit_per_minute": 60,
        "rate_limit_per_hour": 1000,
        "allowed_ips": null,
        "created_at": "2024-01-15T10:00:00Z",
        "updated_at": "2024-01-20T15:30:00Z",
        "creator_name": "admin",
        "creator_email": "admin@example.com"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  },
  "timestamp": "2024-01-20T16:00:00Z"
}
```

---

### 2. Obtener API Key por ID

**GET** `/api/api-keys/:id`

Obtiene una API Key específica por su ID.

#### Path Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | number | ID de la API Key |

#### Ejemplo de Request

```http
GET /api/api-keys/1
Authorization: Bearer <jwt_token>
```

#### Ejemplo de Response (200 OK)

```json
{
  "success": true,
  "message": "API Key obtenida exitosamente",
  "data": {
    "id": 1,
    "key_name": "n8n Integration",
    "api_key": "***HIDDEN***",
    "description": "API Key para integración con n8n",
    "is_active": true,
    "last_used_at": "2024-01-20T15:30:00Z",
    "expires_at": null,
    "rate_limit_per_minute": 60,
    "rate_limit_per_hour": 1000,
    "allowed_ips": null,
    "metadata": null,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-20T15:30:00Z",
    "creator_name": "admin",
    "creator_email": "admin@example.com"
  },
  "timestamp": "2024-01-20T16:00:00Z"
}
```

---

### 3. Crear Nueva API Key

**POST** `/api/api-keys`

Crea una nueva API Key. **IMPORTANTE**: La API Key en texto plano solo se muestra una vez al crear.

#### Request Body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `key_name` | string | ✅ Sí | Nombre descriptivo (1-100 caracteres) |
| `description` | string | No | Descripción del uso (máx 500 caracteres) |
| `expires_at` | string | No | Fecha de expiración (ISO 8601) |
| `rate_limit_per_minute` | number | No | Límite por minuto (default: 60) |
| `rate_limit_per_hour` | number | No | Límite por hora (default: 1000) |
| `allowed_ips` | string | No | IPs permitidas separadas por coma |
| `metadata` | object | No | Metadatos adicionales (JSON) |

#### Ejemplo de Request

```http
POST /api/api-keys
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "key_name": "n8n Integration",
  "description": "API Key para integración con n8n y WooCommerce",
  "expires_at": "2025-12-31T23:59:59Z",
  "rate_limit_per_minute": 60,
  "rate_limit_per_hour": 1000,
  "allowed_ips": "192.168.1.100,10.0.0.50",
  "metadata": {
    "integration_type": "n8n",
    "woocommerce_store": "mayorista"
  }
}
```

#### Ejemplo de Response (201 Created)

```json
{
  "success": true,
  "message": "API Key creada exitosamente",
  "data": {
    "apiKey": {
      "id": 1,
      "key_name": "n8n Integration",
      "api_key": "***HIDDEN***",
      "description": "API Key para integración con n8n y WooCommerce",
      "is_active": true,
      "expires_at": "2025-12-31T23:59:59Z",
      "rate_limit_per_minute": 60,
      "rate_limit_per_hour": 1000,
      "allowed_ips": "192.168.1.100,10.0.0.50",
      "created_at": "2024-01-20T16:00:00Z",
      "updated_at": "2024-01-20T16:00:00Z"
    },
    "plainKey": "fnec_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
    "warning": "⚠️ IMPORTANTE: Guarda esta API Key ahora. No se mostrará nuevamente."
  },
  "timestamp": "2024-01-20T16:00:00Z"
}
```

**⚠️ IMPORTANTE**: Guarda el valor de `plainKey` inmediatamente. No se mostrará nuevamente.

---

### 4. Actualizar API Key

**PUT** `/api/api-keys/:id`

Actualiza una API Key existente. No se puede cambiar la API Key en sí, solo sus propiedades.

#### Path Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | number | ID de la API Key |

#### Request Body (todos los campos son opcionales)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `key_name` | string | Nuevo nombre (1-100 caracteres) |
| `description` | string | Nueva descripción (máx 500 caracteres) |
| `is_active` | boolean | Activar/desactivar |
| `expires_at` | string | Nueva fecha de expiración (ISO 8601) |
| `rate_limit_per_minute` | number | Nuevo límite por minuto |
| `rate_limit_per_hour` | number | Nuevo límite por hora |
| `allowed_ips` | string | Nuevas IPs permitidas |
| `metadata` | object | Nuevos metadatos |

#### Ejemplo de Request

```http
PUT /api/api-keys/1
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "description": "Actualizada para incluir WooCommerce minorista",
  "rate_limit_per_minute": 120,
  "allowed_ips": "192.168.1.100,10.0.0.50,10.0.0.51"
}
```

---

### 5. Desactivar API Key

**DELETE** `/api/api-keys/:id`

Desactiva una API Key (soft delete). La API Key no se elimina, solo se marca como inactiva.

#### Path Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | number | ID de la API Key |

#### Ejemplo de Request

```http
DELETE /api/api-keys/1
Authorization: Bearer <jwt_token>
```

#### Ejemplo de Response (200 OK)

```json
{
  "success": true,
  "message": "API Key desactivada exitosamente",
  "timestamp": "2024-01-20T16:00:00Z"
}
```

---

### 6. Activar API Key

**PUT** `/api/api-keys/:id/activate`

Activa una API Key previamente desactivada.

#### Ejemplo de Request

```http
PUT /api/api-keys/1/activate
Authorization: Bearer <jwt_token>
```

---

### 7. Eliminar Permanentemente

**DELETE** `/api/api-keys/:id/permanent`

Elimina permanentemente una API Key de la base de datos. **Esta acción no se puede deshacer**.

#### Ejemplo de Request

```http
DELETE /api/api-keys/1/permanent
Authorization: Bearer <jwt_token>
```

---

## 🔐 Autenticación

### Uso de API Keys en Peticiones

Una vez que tienes una API Key, úsala en el header `x-api-key` en todas las peticiones:

```http
GET /api/products
x-api-key: fnec_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
Content-Type: application/json
```

### Validación Automática

El middleware `authenticateApiKey` ahora:

1. **Primero** intenta validar contra la base de datos
2. **Si no encuentra** la API Key en la BD, usa la variable de entorno `API_KEY` como fallback (compatibilidad hacia atrás)

### Validaciones Realizadas

- ✅ API Key existe y está activa
- ✅ API Key no ha expirado (si tiene `expires_at`)
- ✅ IP del cliente está permitida (si `allowed_ips` está configurado)
- ✅ Se registra el uso en `api_key_logs`

---

## 📖 Ejemplos de Uso

### Ejemplo 1: Crear API Key para n8n

```bash
curl -X POST https://sistema.norteabanicos.com/api/api-keys \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "key_name": "n8n WooCommerce Integration",
    "description": "API Key para sincronización automática con WooCommerce",
    "rate_limit_per_minute": 60,
    "rate_limit_per_hour": 1000,
    "metadata": {
      "integration": "n8n",
      "purpose": "woocommerce_sync"
    }
  }'
```

### Ejemplo 2: Usar API Key en n8n

En n8n, configura la credencial:

1. **Settings → Credentials → Add Credential**
2. Tipo: **Header Auth**
3. Configuración:
   - Name: `FENEC ERP API`
   - Header Name: `x-api-key`
   - Header Value: `[la API Key obtenida]`
   - Base URL: `https://sistema.norteabanicos.com/api`

### Ejemplo 3: Listar todas las API Keys activas

```bash
curl -X GET "https://sistema.norteabanicos.com/api/api-keys?is_active=true&limit=20" \
  -H "Authorization: Bearer <jwt_token>"
```

### Ejemplo 4: Desactivar una API Key comprometida

```bash
curl -X DELETE https://sistema.norteabanicos.com/api/api-keys/1 \
  -H "Authorization: Bearer <jwt_token>"
```

---

## 🔒 Seguridad

### Mejores Prácticas

1. **Nunca compartas API Keys** públicamente o en repositorios
2. **Rota las API Keys periódicamente** (cada 3-6 meses)
3. **Usa restricciones por IP** cuando sea posible
4. **Configura fechas de expiración** para API Keys temporales
5. **Monitorea los logs** regularmente para detectar uso anormal
6. **Desactiva inmediatamente** cualquier API Key comprometida

### Rate Limiting

Cada API Key puede tener límites personalizados:

- **Por minuto**: Controla peticiones rápidas
- **Por hora**: Controla uso total en períodos largos

**Nota**: El rate limiting actualmente se registra en los logs pero la implementación de bloqueo automático está pendiente (futura mejora).

### Restricción por IP

Puedes restringir una API Key a ciertas IPs:

```json
{
  "allowed_ips": "192.168.1.100,10.0.0.50,10.0.0.51"
}
```

O permitir todas las IPs:

```json
{
  "allowed_ips": "*"
}
```

---

## 🐛 Troubleshooting

### Problema: API Key no funciona

**Síntomas**: Error 401 al usar la API Key

**Soluciones**:
1. Verificar que la API Key esté activa (`is_active = true`)
2. Verificar que no haya expirado (`expires_at`)
3. Verificar que tu IP esté en `allowed_ips` (si está configurado)
4. Verificar que estés usando el header correcto: `x-api-key`

### Problema: No puedo crear API Keys

**Síntomas**: Error 403 al intentar crear

**Soluciones**:
1. Verificar que tengas rol `admin` o `gerencia`
2. Verificar que el token JWT sea válido
3. Verificar que el token no haya expirado

### Problema: La API Key no aparece en la lista

**Síntomas**: No veo la API Key que acabo de crear

**Soluciones**:
1. Verificar que no estés filtrando por `is_active=false`
2. Verificar que la búsqueda no esté filtrando resultados
3. Verificar que tengas permisos para ver API Keys

### Problema: Error al ejecutar la migración

**Síntomas**: Error al crear las tablas

**Soluciones**:
1. Verificar que la base de datos exista
2. Verificar permisos del usuario de BD
3. Verificar que no existan tablas con el mismo nombre
4. Ejecutar la migración manualmente línea por línea si es necesario

---

## 📊 Logs y Auditoría

### Ver Logs de una API Key

Los logs se almacenan automáticamente en la tabla `api_key_logs`. Para consultarlos:

```sql
SELECT * FROM api_key_logs 
WHERE api_key_id = 1 
ORDER BY created_at DESC 
LIMIT 100;
```

### Información Registrada

- Endpoint accedido
- Método HTTP
- IP del cliente
- User agent
- Código de respuesta
- Tiempo de respuesta
- Fecha y hora

---

## 🚀 Próximas Mejoras

- [ ] Dashboard web para gestionar API Keys
- [ ] Rate limiting automático (bloqueo de peticiones)
- [ ] Alertas por uso anormal
- [ ] Estadísticas de uso por API Key
- [ ] Exportación de logs
- [ ] Rotación automática de API Keys

---

## 📞 Soporte

Para problemas o preguntas sobre el módulo de API Keys:
1. Revisa esta documentación
2. Revisa los logs del servidor
3. Consulta la documentación general del ERP en `/docs`

---

**¡Sistema de API Keys implementado exitosamente! 🎉**




