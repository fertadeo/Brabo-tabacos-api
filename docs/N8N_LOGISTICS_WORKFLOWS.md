# 🤖 WORKFLOWS N8N PARA MÓDULO DE LOGÍSTICA

## 🎯 **FLUJO RECOMENDADO IMPLEMENTADO**

Basado en tu recomendación del **modelo híbrido pero controlado**, he implementado el flujo exacto que sugeriste:

```
Ingreso Pedido → "Pendiente de preparación" → "Listo para despacho" → Remito Automático → "Entregado" → Facturación
```

---

## 🔄 **WORKFLOW 1: GENERACIÓN AUTOMÁTICA DE REMITOS**

### **Trigger**: Webhook de Pedido (Estado: "Listo para despacho")

```json
{
  "name": "Generar Remito Automático",
  "description": "Genera remito automáticamente cuando pedido está listo para despacho",
  "nodes": [
    {
      "name": "Webhook Pedido Listo",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "order-ready-dispatch",
        "responseMode": "responseNode"
      }
    },
    {
      "name": "Validar Pedido",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "// Validar que el pedido tiene stock reservado\nconst order = $input.first().json;\n\nif (!order.hasStockReserved || !order.isReadyForDispatch) {\n  throw new Error('Pedido no está listo para despacho');\n}\n\nreturn [{ json: order }];"
      }
    },
    {
      "name": "Generar Remito",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "{{$vars.ERP_API_URL}}/api/logistics/n8n/generate-from-order",
        "headers": {
          "x-api-key": "{{$vars.ERP_API_KEY}}",
          "Content-Type": "application/json"
        },
        "body": {
          "orderId": "={{$json.orderId}}"
        }
      }
    },
    {
      "name": "Notificar Logística",
      "type": "n8n-nodes-base.slack",
      "parameters": {
        "channel": "#logistica",
        "text": "🚚 Nuevo remito generado automáticamente:\n• Pedido: {{$('Webhook Pedido Listo').first().json.orderNumber}}\n• Remito: {{$json.data.remitoNumber}}\n• Cliente: {{$('Webhook Pedido Listo').first().json.clientName}}"
      }
    },
    {
      "name": "Respuesta Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{{\n  \"success\": true,\n  \"message\": \"Remito generado exitosamente\",\n  \"remitoId\": $json.data.remitoId,\n  \"remitoNumber\": $json.data.remitoNumber\n}}}"
      }
    }
  ]
}
```

---

## 🔄 **WORKFLOW 2: SEGUIMIENTO DE DESPACHO**

### **Trigger**: Cron (cada 30 minutos)

```json
{
  "name": "Seguimiento de Despachos",
  "description": "Monitorea remitos en tránsito y actualiza estados",
  "nodes": [
    {
      "name": "Cron Trigger",
      "type": "n8n-nodes-base.cron",
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "minutes",
              "minutesInterval": 30
            }
          ]
        }
      }
    },
    {
      "name": "Obtener Remitos en Tránsito",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "{{$vars.ERP_API_URL}}/api/logistics/n8n/sync-data",
        "headers": {
          "x-api-key": "{{$vars.ERP_API_KEY}}"
        },
        "qs": {
          "status": "en_transito",
          "limit": 50
        }
      }
    },
    {
      "name": "Verificar Tracking",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "https://api.oca.com.ar/empresas/{{$vars.OCA_API_KEY}}/tracking/{{$json.tracking_number}}",
        "headers": {
          "Content-Type": "application/json"
        }
      }
    },
    {
      "name": "Actualizar Estado",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "PUT",
        "url": "{{$vars.ERP_API_URL}}/api/logistics/n8n/update-status",
        "headers": {
          "x-api-key": "{{$vars.ERP_API_KEY}}",
          "Content-Type": "application/json"
        },
        "body": "={{{\n  \"remitoId\": $('Obtener Remitos en Tránsito').first().json.id,\n  \"status\": $json.status === 'entregado' ? 'entregado' : 'en_transito',\n  \"trackingData\": {\n    \"last_update\": $json.last_update,\n    \"location\": $json.location,\n    \"estimated_delivery\": $json.estimated_delivery\n  }\n}}}"
      }
    }
  ]
}
```

---

## 🔄 **WORKFLOW 3: NOTIFICACIONES AL CLIENTE**

### **Trigger**: Webhook de Estado de Remito

```json
{
  "name": "Notificaciones Cliente",
  "description": "Envía notificaciones al cliente según el estado del remito",
  "nodes": [
    {
      "name": "Webhook Estado Remito",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "remito-status-change"
      }
    },
    {
      "name": "Obtener Datos Cliente",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "{{$vars.ERP_API_URL}}/api/clients/{{$json.client_id}}",
        "headers": {
          "x-api-key": "{{$vars.ERP_API_KEY}}"
        }
      }
    },
    {
      "name": "Decidir Tipo Notificación",
      "type": "n8n-nodes-base.switch",
      "parameters": {
        "rules": {
          "rules": [
            {
              "conditions": {
                "string": [
                  {
                    "value1": "={{$json.status}}",
                    "operation": "equal",
                    "value2": "en_transito"
                  }
                ]
              },
              "output": 0
            },
            {
              "conditions": {
                "string": [
                  {
                    "value1": "={{$json.status}}",
                    "operation": "equal",
                    "value2": "entregado"
                  }
                ]
              },
              "output": 1
            }
          ]
        }
      }
    },
    {
      "name": "Notificación En Tránsito",
      "type": "n8n-nodes-base.whatsAppBusiness",
      "parameters": {
        "phoneNumber": "={{$('Obtener Datos Cliente').first().json.phone}}",
        "message": "🚚 Tu pedido está en camino!\n\n📦 Remito: {{$json.remito_number}}\n🚛 Tracking: {{$json.tracking_number}}\n📍 Estado: En tránsito\n\nPuedes seguirlo en: {{$vars.TRACKING_URL}}/{{$json.remito_number}}"
      }
    },
    {
      "name": "Notificación Entregado",
      "type": "n8n-nodes-base.whatsAppBusiness",
      "parameters": {
        "phoneNumber": "={{$('Obtener Datos Cliente').first().json.phone}}",
        "message": "✅ ¡Tu pedido fue entregado!\n\n📦 Remito: {{$json.remito_number}}\n📅 Fecha de entrega: {{$json.delivery_date}}\n\n¡Gracias por elegirnos! 🌟"
      }
    }
  ]
}
```

---

## 🔄 **WORKFLOW 4: FACTURACIÓN AUTOMÁTICA**

### **Trigger**: Webhook de Remito Entregado

```json
{
  "name": "Facturación Automática",
  "description": "Genera factura automáticamente cuando el remito es entregado",
  "nodes": [
    {
      "name": "Webhook Remito Entregado",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "remito-delivered"
      }
    },
    {
      "name": "Validar Datos Facturación",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "const remito = $input.first().json;\n\n// Validar que el remito está realmente entregado\nif (remito.status !== 'entregado') {\n  throw new Error('Remito no está en estado entregado');\n}\n\n// Validar que no existe factura previa\nif (remito.has_invoice) {\n  throw new Error('Ya existe factura para este remito');\n}\n\nreturn [{ json: remito }];"
      }
    },
    {
      "name": "Generar Factura",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "{{$vars.ERP_API_URL}}/api/billing/invoices",
        "headers": {
          "x-api-key": "{{$vars.ERP_API_KEY}}",
          "Content-Type": "application/json"
        },
        "body": "={{{\n  \"remito_id\": $json.id,\n  \"order_id\": $json.order_id,\n  \"client_id\": $json.client_id,\n  \"invoice_type\": \"A\",\n  \"items\": $json.items.map(item => ({\n    \"product_id\": item.product_id,\n    \"quantity\": item.quantity,\n    \"unit_price\": item.unit_price,\n    \"total_price\": item.total_price\n  }))\n}}}"
      }
    },
    {
      "name": "Enviar Factura Cliente",
      "type": "n8n-nodes-base.emailSend",
      "parameters": {
        "fromEmail": "facturacion@norteabanicos.com",
        "toEmail": "={{$json.client_email}}",
        "subject": "Factura {{$json.invoice_number}} - Norte Abanicos",
        "message": "Estimado/a {{$json.client_name}},\n\nAdjunto encontrará la factura correspondiente a su pedido.\n\n📄 Factura: {{$json.invoice_number}}\n📅 Fecha: {{$json.invoice_date}}\n💰 Total: ${{$json.total_amount}}\n\n¡Gracias por su compra!"
      }
    }
  ]
}
```

---

## 🔄 **WORKFLOW 5: DASHBOARD DE LOGÍSTICA**

### **Trigger**: Cron (cada hora)

```json
{
  "name": "Dashboard Logístico",
  "description": "Actualiza dashboard con métricas de logística",
  "nodes": [
    {
      "name": "Cron Hourly",
      "type": "n8n-nodes-base.cron",
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hoursInterval": 1
            }
          ]
        }
      }
    },
    {
      "name": "Obtener Estadísticas",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "{{$vars.ERP_API_URL}}/api/logistics/stats",
        "headers": {
          "x-api-key": "{{$vars.ERP_API_KEY}}"
        }
      }
    },
    {
      "name": "Actualizar Google Sheets",
      "type": "n8n-nodes-base.googleSheets",
      "parameters": {
        "operation": "update",
        "documentId": "{{$vars.LOGISTICS_DASHBOARD_SHEET_ID}}",
        "sheetName": "Dashboard",
        "range": "A1:H10",
        "values": "={{[\n  ['Métrica', 'Valor', 'Fecha'],\n  ['Total Remitos', $json.data.total_remitos, new Date().toISOString()],\n  ['Pendientes Entrega', $json.data.pending_delivery, new Date().toISOString()],\n  ['En Tránsito', $json.data.in_transit, new Date().toISOString()],\n  ['Entregados Hoy', $json.data.delivered_today, new Date().toISOString()],\n  ['Retrasados', $json.data.delayed_deliveries, new Date().toISOString()],\n  ['Valor Total', $json.data.total_value, new Date().toISOString()],\n  ['Tiempo Promedio', $json.data.average_delivery_time + ' horas', new Date().toISOString()]\n]}}"
      }
    }
  ]
}
```

---

## 🔄 **WORKFLOW 6: ALERTAS DE RETRASOS**

### **Trigger**: Cron (diario a las 9:00 AM)

```json
{
  "name": "Alertas de Retrasos",
  "description": "Identifica y alerta sobre entregas retrasadas",
  "nodes": [
    {
      "name": "Cron Daily 9AM",
      "type": "n8n-nodes-base.cron",
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hoursInterval": 24
            }
          ],
          "triggerAtHour": 9
        }
      }
    },
    {
      "name": "Obtener Remitos Retrasados",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "{{$vars.ERP_API_URL}}/api/logistics/n8n/sync-data",
        "headers": {
          "x-api-key": "{{$vars.ERP_API_KEY}}"
        },
        "qs": {
          "status": "en_transito",
          "delayed": true,
          "limit": 100
        }
      }
    },
    {
      "name": "Enviar Alerta Slack",
      "type": "n8n-nodes-base.slack",
      "parameters": {
        "channel": "#alertas-logistica",
        "text": "🚨 ALERTA: Remitos Retrasados\n\n{{$json.map(item => `• Remito ${item.remito_number} - Cliente: ${item.client_name} - Retraso: ${item.delay_days} días`).join('\\n')}}\n\n📞 Contactar transportistas inmediatamente."
      }
    }
  ]
}
```

---

## ⚙️ **CONFIGURACIÓN DE VARIABLES N8N**

### **Variables de Entorno Requeridas**

```env
# ERP API
ERP_API_URL=https://api.norteabanicos.com
ERP_API_KEY=norte-erp-api-key-2024

# Transportistas
OCA_API_KEY=tu_oca_api_key
ANDREANI_API_KEY=tu_andreani_api_key

# Notificaciones
SLACK_WEBHOOK=https://hooks.slack.com/xxx
WHATSAPP_TOKEN=tu_whatsapp_token
EMAIL_SMTP=smtp.gmail.com:587

# Dashboard
LOGISTICS_DASHBOARD_SHEET_ID=tu_google_sheet_id
TRACKING_URL=https://norteabanicos.com/tracking

# Configuración
AUTO_GENERATE_REMITO=true
REQUIRE_STOCK_RESERVATION=true
MAX_DELIVERY_DAYS=7
```

---

## 🎯 **BENEFICIOS DEL FLUJO IMPLEMENTADO**

### **✅ Evita Remitos Falsos**
- Solo genera remitos cuando el pedido está **realmente listo**
- Valida stock reservado antes de crear el remito
- Previene duplicados automáticamente

### **✅ Mantiene Stock Real**
- Stock se actualiza automáticamente al generar remito
- Trazabilidad completa de movimientos
- Control de inventario en tiempo real

### **✅ Refleja Realidad Operativa**
- No todo pedido implica entrega inmediata
- Estados claros: pendiente → listo → remito → entregado
- Flujo natural del negocio

### **✅ Facilita Reportes**
- Sabes exactamente cuántos pedidos están en cada etapa
- Métricas precisas de eficiencia logística
- Dashboard actualizado automáticamente

---

## 🚀 **PRÓXIMOS PASOS**

### **1. Importar Workflows en N8N**
- Copiar cada workflow JSON
- Importar en tu instancia de N8N
- Configurar variables de entorno

### **2. Configurar Webhooks en tu ERP**
- Configurar endpoints para recibir notificaciones
- Establecer triggers en el módulo de pedidos

### **3. Testing**
- Probar generación automática de remitos
- Verificar notificaciones a clientes
- Validar actualización de estados

### **4. Monitoreo**
- Configurar alertas de errores
- Establecer métricas de performance
- Dashboard de monitoreo de workflows

---

**🎯 Con estos workflows implementas exactamente el flujo híbrido controlado que recomendaste: eficiente, automatizado y sin errores manuales.**

**📅 Última actualización**: $(date)
**🔄 Versión**: 1.0.0
**👥 Desarrollado por**: Equipo Norte ERP + N8N
