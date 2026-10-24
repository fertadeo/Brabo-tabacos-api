# 🔑 Configuración de API Keys para Integraciones

## 📋 API Keys Generadas

### 1. API Key para Variable de Entorno (Fallback General)
```
tS/N9qKtbYLRnCVmWQPDWNkoJzmvKMjgL6NSfJlaka8=
```
**Uso:** Variable `API_KEY` en `.env` - Se usa como fallback cuando no hay API Keys en BD

### 2. API Key para n8n (WooCommerce Sync)
```
xeAwmK71TUT0uoF5USaL9Yq1ncOlP6a+y8DhAu4oBLk=
```
**Uso:** Para sincronización de productos desde WooCommerce con n8n

---

## 🚀 Paso 1: Configurar API Key en .env

### En el servidor, edita el archivo `.env`:

```bash
nano /home/fenecstudio/norte-erp-api/.env
```

### Agrega al final del archivo:

```env
# API Key para integraciones externas (fallback)
API_KEY=tS/N9qKtbYLRnCVmWQPDWNkoJzmvKMjgL6NSfJlaka8=
```

### Guarda y reinicia:

```bash
# Guardar en nano: Ctrl+O, Enter, Ctrl+X
# Reiniciar aplicación
pm2 restart norte-erp-api
# o
pm2 reload norte-erp-api
```

---

## 🔐 Paso 2: Crear API Keys desde el Sistema (Recomendado)

### Requisitos:
- Autenticación JWT con rol `admin` o `gerencia`
- Acceso al endpoint `/api/api-keys`

### 2.1. API Key para n8n

**Endpoint:** `POST /api/api-keys`

**Request:**
```bash
curl -X POST https://sistema.norteabanicos.com/api/api-keys \
  -H "Authorization: Bearer <TU_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "key_name": "n8n WooCommerce Sync",
    "description": "API Key para sincronización automática de productos desde WooCommerce mayorista con n8n",
    "rate_limit_per_minute": 60,
    "rate_limit_per_hour": 1000,
    "metadata": {
      "integration": "n8n",
      "purpose": "woocommerce_product_sync",
      "store": "mayorista"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "API Key creada exitosamente",
  "data": {
    "apiKey": {
      "id": 1,
      "key_name": "n8n WooCommerce Sync",
      ...
    },
    "plainKey": "fnec_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
    "warning": "⚠️ IMPORTANTE: Guarda esta API Key ahora. No se mostrará nuevamente."
  }
}
```

**⚠️ IMPORTANTE:** Guarda el valor de `plainKey` - solo se muestra una vez.

---

### 2.2. API Key para Monday.com

**Endpoint:** `POST /api/api-keys`

**Request:**
```bash
curl -X POST https://sistema.norteabanicos.com/api/api-keys \
  -H "Authorization: Bearer <TU_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "key_name": "Monday.com Integration",
    "description": "API Key para integración con Monday.com. Permite sincronización de datos entre el ERP y Monday.com para gestión de proyectos y tareas.",
    "expires_at": "2026-12-31T23:59:59Z",
    "rate_limit_per_minute": 60,
    "rate_limit_per_hour": 1000,
    "allowed_ips": null,
    "metadata": {
      "integration": "monday",
      "purpose": "project_management_sync",
      "contact": "integrador@monday.com",
      "company": "Monday.com",
      "review_date": "2026-11-30",
      "notes": "Vence el 31/12/2026 - Notificar al integrador 30 días antes para renovación"
    }
  }'
```

**Especificaciones:**
- ✅ **Vencimiento**: 1 año (recomendado para integradores externos)
- ✅ **Rate Limit**: 60/min, 1000/hora
- ✅ **Restricción IP**: Opcional (agregar si conoces la IP de Monday.com)
- ⚠️ **Importante**: Recordar renovar 30 días antes del vencimiento

**Response:**
```json
{
  "success": true,
  "message": "API Key creada exitosamente",
  "data": {
    "apiKey": {
      "id": 2,
      "key_name": "Monday.com Integration",
      ...
    },
    "plainKey": "fnec_xyz789abc123def456ghi789jkl012mno345pqr678stu901vwx",
    "warning": "⚠️ IMPORTANTE: Guarda esta API Key ahora. No se mostrará nuevamente."
  }
}
```

**⚠️ IMPORTANTE:** Guarda el valor de `plainKey` - solo se muestra una vez.

---

### 2.3. API Key para Desarrolladores Externos

**Endpoint:** `POST /api/api-keys`

**Request:**
```bash
curl -X POST https://sistema.norteabanicos.com/api/api-keys \
  -H "Authorization: Bearer <TU_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "key_name": "API Key para Desarrolladores",
    "description": "API Key para desarrolladores externos que necesitan integrar con el ERP",
    "expires_at": "2026-12-31T23:59:59Z",
    "rate_limit_per_minute": 120,
    "rate_limit_per_hour": 2000,
    "metadata": {
      "purpose": "external_developers",
      "notes": "Compartir con desarrolladores que necesiten acceso a la API"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "API Key creada exitosamente",
  "data": {
    "apiKey": {
      "id": 2,
      "key_name": "API Key para Desarrolladores",
      ...
    },
    "plainKey": "fnec_xyz789abc123def456ghi789jkl012mno345pqr678stu901vwx",
    "warning": "⚠️ IMPORTANTE: Guarda esta API Key ahora. No se mostrará nuevamente."
  }
}
```

**⚠️ IMPORTANTE:** Guarda el valor de `plainKey` - solo se muestra una vez.

---

## 📝 Paso 3: Configurar en n8n

### 3.1. Crear Credencial en n8n

1. En n8n: **Settings → Credentials → Add Credential**
2. Busca: **Header Auth**
3. Configuración:
   - **Name**: `Norte ERP API - n8n`
   - **Header Name**: `x-api-key`
   - **Header Value**: `[La plainKey obtenida del paso 2.1]`
   - **Base URL**: `https://sistema.norteabanicos.com/api`

### 3.2. Usar en HTTP Request

En el nodo HTTP Request "Enviar Productos al ERP":
- **Authentication**: Selecciona la credencial `Norte ERP API - n8n`
- O manualmente:
  - **Headers**:
    - `x-api-key`: `[La plainKey]`
    - `Content-Type`: `application/json`

---

## 🔒 Paso 4: Compartir API Key con Desarrolladores

### Opción A: Compartir la API Key directamente

1. Obtén la `plainKey` del paso 2.2
2. Compártela de forma segura (email encriptado, mensajería segura, etc.)
3. Proporciona esta información:

```
API Key: [la plainKey]
Endpoint Base: https://sistema.norteabanicos.com/api
Header: x-api-key
```

### Opción B: Crear API Keys individuales por desarrollador

Para mayor control, crea una API Key por cada desarrollador:

```bash
curl -X POST https://sistema.norteabanicos.com/api/api-keys \
  -H "Authorization: Bearer <TU_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "key_name": "Desarrollador - [Nombre del Dev]",
    "description": "API Key para [Nombre del desarrollador] - [Proyecto/Integración]",
    "rate_limit_per_minute": 60,
    "rate_limit_per_hour": 1000,
    "allowed_ips": "[IP del desarrollador si es conocida]",
    "metadata": {
      "developer": "[Nombre]",
      "project": "[Proyecto]",
      "contact": "[Email]"
    }
  }'
```

**Ventajas:**
- ✅ Control individual por desarrollador
- ✅ Puedes revocar acceso individualmente
- ✅ Puedes restringir por IP
- ✅ Logs de auditoría separados

---

## 📊 Paso 5: Verificar API Keys Creadas

### Listar todas las API Keys:

```bash
curl -X GET "https://sistema.norteabanicos.com/api/api-keys?is_active=true" \
  -H "Authorization: Bearer <TU_JWT_TOKEN>"
```

### Ver detalles de una API Key específica:

```bash
curl -X GET "https://sistema.norteabanicos.com/api/api-keys/1" \
  -H "Authorization: Bearer <TU_JWT_TOKEN>"
```

**Nota:** La API Key en texto plano (`plainKey`) NO se muestra después de la creación por seguridad.

---

## 🔄 Paso 6: Gestionar API Keys

### Desactivar una API Key:

```bash
curl -X DELETE https://sistema.norteabanicos.com/api/api-keys/1 \
  -H "Authorization: Bearer <TU_JWT_TOKEN>"
```

### Reactivar una API Key:

```bash
curl -X PUT https://sistema.norteabanicos.com/api/api-keys/1/activate \
  -H "Authorization: Bearer <TU_JWT_TOKEN>"
```

### Actualizar configuración:

```bash
curl -X PUT https://sistema.norteabanicos.com/api/api-keys/1 \
  -H "Authorization: Bearer <TU_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Descripción actualizada",
    "rate_limit_per_minute": 120
  }'
```

---

## ✅ Checklist de Configuración

- [ ] API Key agregada al `.env` y aplicación reiniciada
- [ ] API Key para n8n creada desde el sistema
- [ ] API Key para Monday.com creada desde el sistema
- [ ] API Key para desarrolladores creada desde el sistema
- [ ] Credencial configurada en n8n
- [ ] API Keys guardadas de forma segura
- [ ] Recordatorios configurados para renovación (Monday.com: 30 días antes)
- [ ] Documentación compartida con desarrolladores/integradores

---

## 🔐 Seguridad

### Mejores Prácticas:

1. ✅ **Nunca compartas API Keys** públicamente o en repositorios
2. ✅ **Rota las API Keys periódicamente** (cada 3-6 meses)
3. ✅ **Usa restricciones por IP** cuando sea posible
4. ✅ **Monitorea los logs** regularmente
5. ✅ **Desactiva inmediatamente** cualquier API Key comprometida

### Variables de Entorno:

- La `API_KEY` en `.env` es un **fallback** para compatibilidad
- Las API Keys creadas desde el sistema tienen **prioridad**
- Si una API Key existe en BD y está activa, se usa esa
- Si no, se usa la `API_KEY` del `.env`

---

## 📚 Documentación Adicional

- **Ejemplos detallados**: Consulta `/docs/API_KEYS_EJEMPLOS.md` para ejemplos específicos de cada tipo de API Key
- **Documentación completa**: Consulta `/docs/API_KEYS_DOC.md` para la documentación técnica completa
- **Migración de tablas**: Consulta `/docs/MIGRACION_API_KEYS.md` si necesitas crear las tablas en la BD

## 📞 Soporte

Si necesitas ayuda adicional:
1. Revisa los logs: `pm2 logs norte-erp-api`
2. Verifica que las tablas `api_keys` y `api_key_logs` existan
3. Consulta la documentación completa en `/docs/API_KEYS_DOC.md`
4. Revisa los ejemplos en `/docs/API_KEYS_EJEMPLOS.md`

