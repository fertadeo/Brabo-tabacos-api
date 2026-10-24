# 🚀 Comandos Listos para Crear API Keys

Este documento contiene los comandos exactos listos para copiar y pegar para crear las API Keys.

---

## 📋 Prerequisitos

1. **Obtener JWT Token** (necesitas estar autenticado):

```bash
curl -X POST https://sistema.norteabanicos.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tu-email@ejemplo.com",
    "password": "tu-password"
  }'
```

Copia el `token` de la respuesta.

---

## 1. API Key para n8n (WooCommerce Sync)

### Sin Vencimiento (Recomendado)

```bash
curl -X POST https://sistema.norteabanicos.com/api/api-keys \
  -H "Authorization: Bearer <TU_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

### Con Vencimiento (2 años)

```bash
curl -X POST https://sistema.norteabanicos.com/api/api-keys \
  -H "Authorization: Bearer <TU_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

---

## 2. API Key para Monday.com

### Con Vencimiento de 1 Año (Recomendado)

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

### Con Restricción por IP (si conoces la IP de Monday.com)

```bash
curl -X POST https://sistema.norteabanicos.com/api/api-keys \
  -H "Authorization: Bearer <TU_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

**⚠️ IMPORTANTE**: Reemplaza `52.1.2.3,52.4.5.6` con las IPs reales de Monday.com si las conoces.

---

## 3. API Key para Desarrolladores Externos

### Genérica

```bash
curl -X POST https://sistema.norteabanicos.com/api/api-keys \
  -H "Authorization: Bearer <TU_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

### Específica por Desarrollador (Recomendado)

```bash
curl -X POST https://sistema.norteabanicos.com/api/api-keys \
  -H "Authorization: Bearer <TU_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "key_name": "Desarrollador - [NOMBRE]",
    "description": "API Key para [NOMBRE] - [PROYECTO/INTEGRACIÓN]",
    "expires_at": "2026-12-31T23:59:59Z",
    "rate_limit_per_minute": 60,
    "rate_limit_per_hour": 1000,
    "allowed_ips": "[IP_DEL_DESARROLLADOR]",
    "metadata": {
      "developer": "[Nombre completo]",
      "company": "[Empresa]",
      "project": "[Nombre del proyecto]",
      "contact": "[Email]",
      "phone": "[Teléfono opcional]",
      "review_date": "2026-11-30",
      "notes": "Vence el 31/12/2026 - Contactar para renovación"
    }
  }'
```

**⚠️ IMPORTANTE**: Reemplaza los valores entre `[ ]` con la información real.

---

## 📝 Después de Crear las API Keys

### 1. Guardar el `plainKey`

La respuesta incluirá un campo `plainKey` que solo se muestra UNA VEZ:

```json
{
  "success": true,
  "data": {
    "plainKey": "fnec_abc123def456ghi789..."
  }
}
```

**Guarda este valor inmediatamente** - no podrás verlo de nuevo.

### 2. Verificar que se Creó

```bash
curl -X GET "https://sistema.norteabanicos.com/api/api-keys?is_active=true" \
  -H "Authorization: Bearer <TU_JWT_TOKEN>"
```

### 3. Compartir con el Integrador/Desarrollador

Comparte de forma segura:
- La API Key (`plainKey`)
- El endpoint base: `https://sistema.norteabanicos.com/api`
- El header requerido: `x-api-key`
- La fecha de vencimiento (si aplica)

---

## 🔄 Renovación de API Keys

### Recordatorio para Monday.com

**30 días antes del vencimiento (1 de diciembre de 2026):**

1. Notificar al integrador de Monday.com
2. Crear nueva API Key con nueva fecha de vencimiento
3. Compartir nueva API Key
4. Desactivar API Key antigua después de confirmar que funciona

### Comando para Desactivar API Key Antigua

```bash
curl -X DELETE https://sistema.norteabanicos.com/api/api-keys/[ID] \
  -H "Authorization: Bearer <TU_JWT_TOKEN>"
```

---

## 📊 Resumen de API Keys a Crear

| Integración | Vencimiento | Prioridad |
|-------------|-------------|-----------|
| n8n | Sin vencimiento | Alta |
| Monday.com | 1 año (2026-12-31) | Alta |
| Desarrolladores | 1 año (2026-12-31) | Media |

---

## ✅ Checklist

- [ ] JWT Token obtenido
- [ ] API Key para n8n creada y `plainKey` guardado
- [ ] API Key para Monday.com creada y `plainKey` guardado
- [ ] API Key para desarrolladores creada y `plainKey` guardado
- [ ] API Keys compartidas de forma segura
- [ ] Recordatorio configurado para renovación de Monday.com (30 días antes)
- [ ] Documentación actualizada

---

## 🔐 Seguridad

- ✅ Nunca compartas API Keys públicamente
- ✅ Usa canales seguros para compartir (email encriptado, mensajería segura)
- ✅ Guarda los `plainKey` en un gestor de contraseñas
- ✅ Monitorea los logs regularmente
- ✅ Desactiva inmediatamente cualquier API Key comprometida

