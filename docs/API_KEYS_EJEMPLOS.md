# 🔑 Ejemplos de Creación de API Keys

Este documento contiene ejemplos específicos para crear API Keys para diferentes integraciones y casos de uso.

---

## 📋 Índice

1. [API Key para n8n (WooCommerce Sync)](#1-api-key-para-n8n-woocommerce-sync)
2. [API Key para Monday.com](#2-api-key-para-mondaycom)
3. [API Key para Desarrolladores Externos](#3-api-key-para-desarrolladores-externos)
4. [API Key Temporal (Pruebas)](#4-api-key-temporal-pruebas)
5. [API Key con Restricción por IP](#5-api-key-con-restricción-por-ip)

---

## 1. API Key para n8n (WooCommerce Sync)

### Especificaciones Recomendadas

- **Vencimiento**: Sin vencimiento (o 2 años)
- **Rate Limit**: 60/min, 1000/hora
- **Restricción IP**: Opcional (si conoces la IP de n8n)
- **Uso**: Sincronización automática de productos desde WooCommerce

### Request

```bash
POST /api/api-keys
Authorization: Bearer <TU_JWT_TOKEN>
Content-Type: application/json

{
  "key_name": "n8n WooCommerce Sync",
  "description": "API Key para sincronización automática de productos desde WooCommerce mayorista con n8n. Sincroniza productos, stock y precios.",
  "expires_at": null,
  "rate_limit_per_minute": 60,
  "rate_limit_per_hour": 1000,
  "allowed_ips": null,
  "metadata": {
    "integration": "n8n",
    "purpose": "woocommerce_product_sync",
    "store": "mayorista",
    "contact": "tu-email@ejemplo.com",
    "notes": "Sin vencimiento - Revisar anualmente"
  }
}
```

### Alternativa con Vencimiento (2 años)

```json
{
  "key_name": "n8n WooCommerce Sync",
  "description": "API Key para sincronización automática de productos desde WooCommerce mayorista con n8n",
  "expires_at": "2027-12-31T23:59:59Z",
  "rate_limit_per_minute": 60,
  "rate_limit_per_hour": 1000,
  "metadata": {
    "integration": "n8n",
    "purpose": "woocommerce_product_sync",
    "store": "mayorista",
    "review_date": "2027-11-30",
    "notes": "Vence el 31/12/2027 - Renovar antes de esa fecha"
  }
}
```

---

## 2. API Key para Monday.com

### Especificaciones Recomendadas

- **Vencimiento**: 1 año (recomendado para integradores externos)
- **Rate Limit**: 60/min, 1000/hora
- **Restricción IP**: Si conoces la IP de Monday.com
- **Uso**: Integración con Monday.com para gestión de proyectos/tareas

### Request

```bash
POST /api/api-keys
Authorization: Bearer <TU_JWT_TOKEN>
Content-Type: application/json

{
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
}
```

### Con Restricción por IP (si conoces la IP)

```json
{
  "key_name": "Monday.com Integration",
  "description": "API Key para integración con Monday.com",
  "expires_at": "2026-12-31T23:59:59Z",
  "rate_limit_per_minute": 60,
  "rate_limit_per_hour": 1000,
  "allowed_ips": "52.1.2.3,52.4.5.6",
  "metadata": {
    "integration": "monday",
    "purpose": "project_management_sync",
    "contact": "integrador@monday.com",
    "ips": "52.1.2.3,52.4.5.6",
    "notes": "IPs de Monday.com - Actualizar si cambian"
  }
}
```

### Notas Importantes

- ⚠️ **Recordar renovar**: Configurar recordatorio 30 días antes del vencimiento
- 📧 **Contacto**: Mantener contacto del integrador en metadata
- 🔄 **Renovación**: Crear nueva API Key antes del vencimiento y actualizar en Monday.com

---

## 3. API Key para Desarrolladores Externos

### Especificaciones Recomendadas

- **Vencimiento**: 1 año (recomendado)
- **Rate Limit**: 120/min, 2000/hora (más permisivo)
- **Restricción IP**: Opcional (recomendado si es posible)
- **Uso**: Desarrollo de integraciones personalizadas

### Request Genérico

```bash
POST /api/api-keys
Authorization: Bearer <TU_JWT_TOKEN>
Content-Type: application/json

{
  "key_name": "API Key para Desarrolladores",
  "description": "API Key para desarrolladores externos que necesitan integrar con el ERP. Permite acceso a endpoints de productos, clientes y órdenes.",
  "expires_at": "2026-12-31T23:59:59Z",
  "rate_limit_per_minute": 120,
  "rate_limit_per_hour": 2000,
  "allowed_ips": null,
  "metadata": {
    "purpose": "external_developers",
    "contact": "dev@ejemplo.com",
    "notes": "Compartir con desarrolladores que necesiten acceso a la API"
  }
}
```

### Request Específico por Desarrollador (Recomendado)

```json
{
  "key_name": "Desarrollador - [Nombre del Dev]",
  "description": "API Key para [Nombre del desarrollador] - [Proyecto/Integración específica]",
  "expires_at": "2026-12-31T23:59:59Z",
  "rate_limit_per_minute": 60,
  "rate_limit_per_hour": 1000,
  "allowed_ips": "[IP del desarrollador si es conocida]",
  "metadata": {
    "developer": "[Nombre completo]",
    "company": "[Empresa]",
    "project": "[Nombre del proyecto]",
    "contact": "[Email]",
    "phone": "[Teléfono opcional]",
    "review_date": "2026-11-30",
    "notes": "Vence el 31/12/2026 - Contactar para renovación"
  }
}
```

### Ventajas de API Keys Individuales

- ✅ Control individual por desarrollador
- ✅ Puedes revocar acceso individualmente
- ✅ Logs de auditoría separados
- ✅ Rate limiting personalizado
- ✅ Restricción por IP por desarrollador

---

## 4. API Key Temporal (Pruebas)

### Especificaciones

- **Vencimiento**: 1-3 meses (para pruebas)
- **Rate Limit**: 30/min, 500/hora (más restrictivo)
- **Restricción IP**: Recomendado
- **Uso**: Pruebas, desarrollo, integraciones temporales

### Request

```bash
POST /api/api-keys
Authorization: Bearer <TU_JWT_TOKEN>
Content-Type: application/json

{
  "key_name": "API Key Temporal - Pruebas",
  "description": "API Key temporal para pruebas de integración. Vence en 3 meses.",
  "expires_at": "2025-03-31T23:59:59Z",
  "rate_limit_per_minute": 30,
  "rate_limit_per_hour": 500,
  "allowed_ips": "[Tu IP]",
  "metadata": {
    "purpose": "testing",
    "temporary": true,
    "expires": "2025-03-31",
    "notes": "Eliminar después de pruebas o convertir a permanente"
  }
}
```

---

## 5. API Key con Restricción por IP

### Especificaciones

- **Vencimiento**: Según necesidad
- **Rate Limit**: Según necesidad
- **Restricción IP**: Múltiples IPs permitidas
- **Uso**: Mayor seguridad para integraciones críticas

### Request

```bash
POST /api/api-keys
Authorization: Bearer <TU_JWT_TOKEN>
Content-Type: application/json

{
  "key_name": "API Key con Restricción IP",
  "description": "API Key con restricción por IP para mayor seguridad",
  "expires_at": "2026-12-31T23:59:59Z",
  "rate_limit_per_minute": 60,
  "rate_limit_per_hour": 1000,
  "allowed_ips": "192.168.1.100,10.0.0.50,52.1.2.3",
  "metadata": {
    "purpose": "secure_integration",
    "ips": "192.168.1.100,10.0.0.50,52.1.2.3",
    "notes": "Solo permite acceso desde estas IPs. Actualizar si cambian."
  }
}
```

### Formato de IPs

- **IPs individuales**: `192.168.1.100`
- **Múltiples IPs**: `192.168.1.100,10.0.0.50,52.1.2.3`
- **Todas las IPs**: `null` o no especificar (permite cualquier IP)

---

## 📝 Guía de Uso

### Paso 1: Obtener JWT Token

Primero necesitas autenticarte y obtener un JWT token:

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "tu-email@ejemplo.com",
  "password": "tu-password"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

### Paso 2: Crear API Key

Usa el token en el header `Authorization`:

```bash
POST /api/api-keys
Authorization: Bearer <TU_JWT_TOKEN>
Content-Type: application/json

{
  "key_name": "...",
  "description": "...",
  ...
}
```

### Paso 3: Guardar la API Key

**⚠️ IMPORTANTE**: La respuesta incluye `plainKey` que solo se muestra UNA VEZ:

```json
{
  "success": true,
  "message": "API Key creada exitosamente",
  "data": {
    "apiKey": {
      "id": 1,
      "key_name": "...",
      ...
    },
    "plainKey": "fnec_abc123def456ghi789...",
    "warning": "⚠️ IMPORTANTE: Guarda esta API Key ahora. No se mostrará nuevamente."
  }
}
```

**Guarda el `plainKey` inmediatamente** - no podrás verlo de nuevo.

---

## 🔄 Renovación de API Keys

### Proceso de Renovación

1. **30 días antes del vencimiento**: Notificar al integrador/desarrollador
2. **Crear nueva API Key**: Con nueva fecha de vencimiento
3. **Compartir nueva API Key**: De forma segura
4. **Actualizar en el sistema externo**: (n8n, Monday.com, etc.)
5. **Desactivar API Key antigua**: Después de confirmar que la nueva funciona

### Ejemplo de Renovación

```bash
# 1. Crear nueva API Key
POST /api/api-keys
{
  "key_name": "Monday.com Integration (Renovada 2026)",
  "expires_at": "2027-12-31T23:59:59Z",
  ...
}

# 2. Después de actualizar en Monday.com, desactivar la antigua
DELETE /api/api-keys/1
```

---

## 📊 Resumen de Especificaciones

| Integración | Vencimiento | Rate Limit/min | Rate Limit/hora | Restricción IP |
|-------------|-------------|----------------|-----------------|----------------|
| n8n | Sin vencimiento | 60 | 1000 | Opcional |
| Monday.com | 1 año | 60 | 1000 | Recomendado |
| Desarrolladores | 1 año | 120 | 2000 | Opcional |
| Temporal/Pruebas | 1-3 meses | 30 | 500 | Recomendado |

---

## ✅ Checklist de Creación

Antes de crear una API Key, verifica:

- [ ] Tienes JWT token válido con rol `admin` o `gerencia`
- [ ] Has definido el propósito y uso de la API Key
- [ ] Has decidido el vencimiento apropiado
- [ ] Has configurado rate limits apropiados
- [ ] Has considerado restricciones por IP
- [ ] Has documentado contacto en metadata
- [ ] Tienes un lugar seguro para guardar el `plainKey`
- [ ] Has configurado recordatorio para renovación (si aplica)

---

## 🔐 Seguridad

### Mejores Prácticas

1. ✅ **Vencimiento**: Usar vencimiento para integradores externos
2. ✅ **Restricción IP**: Cuando sea posible
3. ✅ **Rate Limiting**: Configurar límites apropiados
4. ✅ **Metadata**: Documentar todo en metadata
5. ✅ **Monitoreo**: Revisar logs regularmente
6. ✅ **Renovación**: Proceso claro de renovación
7. ✅ **Revocación**: Capacidad de desactivar rápidamente

---

## 📞 Soporte

Si necesitas ayuda:
1. Revisa la documentación completa en `/docs/API_KEYS_DOC.md`
2. Consulta los ejemplos en este documento
3. Verifica los logs en `api_key_logs` para debugging

