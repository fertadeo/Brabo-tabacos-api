# 🔄 Guía de Integración WooCommerce + ERP usando n8n

## 📚 Tabla de Contenidos

1. [Introducción a n8n](#1-introducción-a-n8n)
2. [Instalación y Configuración Inicial](#2-instalación-y-configuración-inicial)
3. [Configuración de Credenciales](#3-configuración-de-credenciales)
4. [Workflows Paso a Paso](#4-workflows-paso-a-paso)
   - [Workflow 1: Sincronización de Productos (ERP → WooCommerce)](#workflow-1-sincronización-de-productos-erp--woocommerce)
   - [Workflow 2: Sincronización de Stock (WooCommerce → ERP)](#workflow-2-sincronización-de-stock-woocommerce--erp)
   - [Workflow 3: Creación Automática de Clientes y Órdenes (WooCommerce → ERP)](#workflow-3-creación-automática-de-clientes-y-órdenes-woocommerce--erp)
5. [Mejores Prácticas](#5-mejores-prácticas)
6. [Troubleshooting](#6-troubleshooting)
7. [Próximos Pasos](#7-próximos-pasos)
8. [Recursos Adicionales](#8-recursos-adicionales)

---

## 1. Introducción a n8n

### ¿Qué es n8n?

**n8n** es una herramienta de automatización de flujos de trabajo (workflow automation) que permite conectar diferentes servicios y sistemas sin necesidad de escribir código. Es especialmente útil para integrar sistemas como WooCommerce con tu ERP.

### Conceptos Básicos

- **Workflow**: Una secuencia de pasos automatizados que se ejecutan en orden
- **Nodos**: Bloques individuales que realizan acciones específicas (HTTP Request, Webhook, etc.)
- **Triggers**: Eventos que inician el workflow (webhook, cron, etc.)
- **Credentials**: Credenciales almacenadas de forma segura para conectar con servicios externos
- **Executions**: Cada vez que un workflow se ejecuta, se crea una "execution" con logs detallados

### ¿Por qué n8n para esta integración?

✅ **No requiere código**: Interfaz visual drag-and-drop  
✅ **Gratis (self-hosted)**: Puedes instalarlo en tu propio servidor  
✅ **Potente**: Maneja transformaciones de datos complejas  
✅ **Debugging fácil**: Logs detallados de cada ejecución  
✅ **Manejo de errores**: Sistema robusto de manejo de errores y reintentos  

---

## 2. Instalación y Configuración Inicial

### Opción A: n8n Cloud (Recomendado para empezar)

1. Crear cuenta en [https://n8n.io](https://n8n.io)
2. El plan gratuito incluye hasta 250 ejecuciones/mes
3. Acceso inmediato sin configuración de servidor

**Ventajas:**
- ✅ Sin configuración de servidor
- ✅ Actualizaciones automáticas
- ✅ Backups automáticos

**Desventajas:**
- ⚠️ Límite de ejecuciones en plan gratuito
- ⚠️ Requiere conexión a internet

### Opción B: n8n Self-hosted (Recomendado para producción)

#### Instalación con Docker (Recomendado)

```bash
# Instalación básica
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# Instalación con persistencia y variables de entorno
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=tu_password_seguro \
  -e WEBHOOK_URL=https://tu-dominio.com/ \
  --restart unless-stopped \
  n8nio/n8n
```

**Acceso:** http://localhost:5678

#### Instalación con Docker Compose

Crea un archivo `docker-compose.yml`:

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=tu_password_seguro
      - WEBHOOK_URL=https://tu-dominio.com/
      - N8N_HOST=tu-dominio.com
      - N8N_PROTOCOL=https
    volumes:
      - ~/.n8n:/home/node/.n8n
```

Ejecuta: `docker-compose up -d`

**Ventajas:**
- ✅ Control total sobre tus datos
- ✅ Sin límites de ejecuciones
- ✅ Puedes ejecutarlo en tu propia infraestructura

---

## 3. Configuración de Credenciales

### 3.1 Credenciales de tu ERP (Norte ERP API)

#### ¿Cómo Obtener tu API Key?

El ERP FENEC utiliza autenticación mediante **API Key** para permitir integraciones externas. Actualmente, el sistema utiliza una API Key compartida configurada en el servidor.

**Para obtener tu API Key:**

1. **Contacta al administrador del ERP** para solicitar la API Key de integración
2. **O si tienes acceso al servidor**, la API Key se encuentra configurada en la variable de entorno `API_KEY` del archivo `.env`

**API Key por defecto (solo para desarrollo):**
- Valor por defecto: `norte-erp-api-key-2024`
- ⚠️ **IMPORTANTE:** En producción, esta debe ser cambiada por una API Key segura y única

#### Configuración en n8n

1. En n8n, ve a **Settings → Credentials → Add Credential**
2. Busca y selecciona **Header Auth**
3. Configuración:
   - **Name**: `Norte ERP API` (o `FENEC ERP API`)
   - **Header Name**: `x-api-key`
   - **Header Value**: `[TU_API_KEY_AQUI]` (la API Key que te proporcionó el administrador)
   - **Base URL**: `https://tu-dominio.com/api` (o tu URL de producción)
     - Ejemplo: `https://api.norteabanicos.com/api`
     - Ejemplo: `https://erp.fenecstudio.com/api`

#### Configuración para Desarrolladores Externos

Si eres un desarrollador externo que quiere integrar tu sistema con el ERP FENEC:

1. **Solicita acceso:**
   - Contacta al equipo de FENEC Studio
   - Proporciona información sobre tu integración (qué sistema, qué endpoints necesitas, etc.)
   - Solicita una API Key específica para tu integración

2. **Una vez recibida la API Key:**
   - Configúrala en tu sistema (n8n, aplicación, etc.)
   - Úsala en el header `x-api-key` en todas las peticiones
   - Mantén la API Key segura y no la compartas públicamente

3. **Ejemplo de uso:**
   ```http
   GET /api/products
   x-api-key: tu-api-key-aqui
   Content-Type: application/json
   ```

#### Seguridad de la API Key

- ✅ **Nunca compartas tu API Key** públicamente o en repositorios de código
- ✅ **Usa variables de entorno** para almacenar la API Key
- ✅ **Rota la API Key periódicamente** si es posible
- ✅ **Reporta inmediatamente** si sospechas que tu API Key ha sido comprometida

#### Notas Importantes

- **Autenticación:** El ERP actualmente usa solo API Key (no requiere JWT para integraciones externas)
- **Endpoints protegidos:** Todos los endpoints de integración requieren el header `x-api-key`
- **Respuesta de error:** Si la API Key es inválida, recibirás un error `401 Unauthorized` con el mensaje: `"API Key inválida"`

#### Configuración de API Key en el Servidor (Para Administradores)

Si eres administrador del ERP y necesitas configurar o cambiar la API Key:

1. **Edita el archivo `.env` en el servidor:**
   ```bash
   nano /var/www/norte-erp-api/.env
   ```

2. **Agrega o modifica la variable `API_KEY`:**
   ```env
   API_KEY=tu-api-key-super-segura-aqui
   ```

3. **Genera una API Key segura:**
   ```bash
   # Opción 1: Usando OpenSSL
   openssl rand -base64 32
   
   # Opción 2: Usando Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   
   # Opción 3: Generador online seguro (usar con precaución)
   # https://randomkeygen.com/
   ```

4. **Reinicia la aplicación:**
   ```bash
   pm2 restart norte-erp-api
   # o
   pm2 reload norte-erp-api
   ```

5. **Verifica que funciona:**
   ```bash
   curl -H "x-api-key: tu-api-key-aqui" https://tu-dominio.com/api/health
   ```

**⚠️ IMPORTANTE para Administradores:**
- Cambia la API Key por defecto en producción
- Comparte la API Key de forma segura (email encriptado, mensajería segura, etc.)
- Documenta quién tiene acceso a cada API Key
- Considera rotar la API Key periódicamente (cada 3-6 meses)
- Si necesitas revocar acceso, simplemente cambia la API Key en el servidor

#### Mejoras Futuras (Roadmap)

En el futuro, el sistema podría implementar:
- 🔄 **Sistema de API Keys múltiples** (una por desarrollador/integración)
- 🔄 **Dashboard para gestionar API Keys** (crear, revocar, ver uso)
- 🔄 **Rate limiting por API Key** (límites de peticiones por minuto/hora)
- 🔄 **Logs de auditoría** (registro de qué API Key hizo qué peticiones)

**Nota:** Si tu API requiere autenticación JWT además de la API Key, puedes usar **Generic Credential Type** en n8n y configurar múltiples headers.

### 3.2 Credenciales de WooCommerce

#### Para WooCommerce Minorista

1. En n8n: **Settings → Credentials → Add Credential**
2. Busca **WooCommerce**
3. Configuración:
   - **Name**: `WooCommerce Minorista`
   - **WooCommerce URL**: `https://tu-tienda-minorista.com`
   - **Consumer Key**: (obtener desde WooCommerce → Settings → Advanced → REST API)
   - **Consumer Secret**: (obtener desde WooCommerce)
   - **Version**: `wc/v3`

#### Para WooCommerce Mayorista

Repite el proceso anterior con:
   - **Name**: `WooCommerce Mayorista`
   - **WooCommerce URL**: `https://tu-tienda-mayorista.com`

#### Cómo obtener Consumer Key y Secret en WooCommerce

1. Ve a **WooCommerce → Settings → Advanced → REST API**
2. Click en **Add Key**
3. Configura:
   - **Description**: `n8n Integration`
   - **User**: Selecciona un usuario con permisos adecuados
   - **Permissions**: `Read/Write`
4. Click **Generate API Key**
5. Copia el **Consumer Key** y **Consumer Secret** (solo se muestran una vez)

---

## 4. Workflows Paso a Paso

### Workflow 1: Sincronización de Productos (ERP → WooCommerce)

**Objetivo:** Enviar productos y stock del ERP a WooCommerce automáticamente.

#### Paso 1: Crear el Workflow

1. Click en **New Workflow**
2. Nombre: `ERP → WooCommerce: Sincronizar Productos`
3. Descripción: `Sincroniza productos y stock del ERP a WooCommerce cada hora`

#### Paso 2: Configurar Trigger (Cron)

1. Arrastra el nodo **Schedule Trigger** al canvas
2. Configuración:
   - **Trigger Times**: 
     - **Every Hour** (o el intervalo que prefieras)
     - O configuración personalizada: `0 * * * *` (cada hora)
   - **Timezone**: Tu zona horaria (ej: `America/Argentina/Buenos_Aires`)

#### Paso 3: Obtener Productos del ERP

1. Arrastra el nodo **HTTP Request**
2. Configuración:
   - **Name**: `Obtener Productos ERP`
   - **Method**: `GET`
   - **URL**: `{{$credentials.Norte_ERP_API.baseUrl}}/products?all=true`
   - **Authentication**: `Header Auth` → Selecciona `Norte ERP API`
   - **Response Format**: `JSON`
   - **Options**:
     - **Timeout**: `30000` (30 segundos)

**Nota:** Ajusta la URL según la estructura de respuesta de tu API. Si tu API devuelve `{ data: { products: [...] } }`, ajusta los siguientes pasos.

#### Paso 4: Procesar Cada Producto

1. Arrastra el nodo **Split In Batches**
2. Configuración:
   - **Batch Size**: `1` (procesar uno a la vez para evitar rate limits)
   - **Field to Split Out**: `data.products` (ajusta según tu respuesta)

**Alternativa:** Si tu API devuelve los productos directamente en un array, usa el nodo **Split Out Items** en lugar de Split In Batches.

#### Paso 5: Buscar Producto en WooCommerce

1. Arrastra el nodo **WooCommerce**
2. Configuración:
   - **Name**: `Buscar Producto WooCommerce`
   - **Credential**: `WooCommerce Minorista` (o Mayorista según corresponda)
   - **Operation**: `Get All`
   - **Resource**: `Product`
   - **Return All**: `true`
   - **Additional Fields**:
     ```json
     {
       "sku": "{{$json.code}}"
     }
     ```

#### Paso 6: Decidir si Crear o Actualizar

1. Arrastra el nodo **IF**
2. Configuración:
   - **Name**: `¿Producto Existe?`
   - **Condition**: 
     - **Value 1**: `{{$json.length}}`
     - **Operation**: `equals`
     - **Value 2**: `0`

**Lógica:** Si el array está vacío (length = 0), el producto no existe → crear. Si tiene elementos → actualizar.

#### Paso 7a: Crear Producto en WooCommerce

1. Arrastra el nodo **WooCommerce** (conectado a la rama "true" del IF)
2. Configuración:
   - **Name**: `Crear Producto`
   - **Credential**: `WooCommerce Minorista`
   - **Operation**: `Create`
   - **Resource**: `Product`
   - **Name**: `{{$('Obtener Productos ERP').item.json.name}}`
   - **SKU**: `{{$('Obtener Productos ERP').item.json.code}}`
   - **Type**: `simple`
   - **Regular Price**: `{{$('Obtener Productos ERP').item.json.price}}`
   - **Stock Quantity**: `{{$('Obtener Productos ERP').item.json.stock}}`
   - **Manage Stock**: `true`
   - **Stock Status**: `{{$('Obtener Productos ERP').item.json.stock > 0 ? 'instock' : 'outofstock'}}`
   - **Status**: `{{$('Obtener Productos ERP').item.json.is_active ? 'publish' : 'draft'}}`
   - **Description**: `{{$('Obtener Productos ERP').item.json.description || ''}}`

#### Paso 7b: Actualizar Producto en WooCommerce

1. Arrastra el nodo **WooCommerce** (conectado a la rama "false" del IF)
2. Configuración:
   - **Name**: `Actualizar Producto`
   - **Credential**: `WooCommerce Minorista`
   - **Operation**: `Update`
   - **Resource**: `Product`
   - **Product ID**: `{{$json[0].id}}`
   - **Regular Price**: `{{$('Obtener Productos ERP').item.json.price}}`
   - **Stock Quantity**: `{{$('Obtener Productos ERP').item.json.stock}}`
   - **Stock Status**: `{{$('Obtener Productos ERP').item.json.stock > 0 ? 'instock' : 'outofstock'}}`
   - **Status**: `{{$('Obtener Productos ERP').item.json.is_active ? 'publish' : 'draft'}}`

#### Paso 8: Activar el Workflow

1. Toggle el switch **Active** en la parte superior
2. Click en **Save** (Ctrl+S)

**¡Listo!** El workflow se ejecutará automáticamente según el schedule configurado.

---

### Workflow 2: Sincronización de Stock (WooCommerce → ERP)

**Objetivo:** Cuando cambia el stock en WooCommerce, actualizar automáticamente el stock en el ERP.

#### Paso 1: Crear Workflow

1. **New Workflow**
2. Nombre: `WooCommerce → ERP: Actualizar Stock`
3. Descripción: `Actualiza stock en ERP cuando cambia en WooCommerce`

#### Paso 2: Configurar Webhook

1. Arrastra el nodo **Webhook**
2. Configuración:
   - **Name**: `Webhook Stock Update`
   - **HTTP Method**: `POST`
   - **Path**: `woocommerce-stock-update`
   - **Response Mode**: `Response Node`
   - **Response Code**: `200`

3. **Copiar la URL del webhook** que aparece (ej: `https://tu-n8n.com/webhook/woocommerce-stock-update`)

#### Paso 3: Configurar Webhook en WooCommerce

1. Ve a **WooCommerce → Settings → Advanced → Webhooks**
2. Click en **Add webhook**
3. Configuración:
   - **Name**: `Actualizar Stock en ERP`
   - **Status**: `Active`
   - **Topic**: `Product updated`
   - **Delivery URL**: (Pega la URL del webhook de n8n)
   - **Secret**: (Opcional, pero recomendado para seguridad)
   - **API Version**: `WP REST API Integration v3`

4. Click **Save webhook**

#### Paso 4: Procesar Datos del Webhook

1. Arrastra el nodo **Set**
2. Configuración:
   - **Name**: `Extraer Datos Stock`
   - **Keep Only Set Fields**: `false`
   - **Fields to Set**:
     - **sku**: `{{$json.sku}}`
     - **stock**: `{{$json.stock_quantity}}`
     - **product_id**: `{{$json.id}}`

#### Paso 5: Validar que el Producto Existe en ERP

1. Arrastra el nodo **HTTP Request**
2. Configuración:
   - **Name**: `Buscar Producto en ERP`
   - **Method**: `GET`
   - **URL**: `{{$credentials.Norte_ERP_API.baseUrl}}/products?search={{$json.sku}}`
   - **Authentication**: `Header Auth` → `Norte ERP API`

#### Paso 6: Verificar Existencia

1. Arrastra el nodo **IF**
2. Configuración:
   - **Name**: `¿Producto Existe en ERP?`
   - **Condition**:
     - **Value 1**: `{{$json.data.products.length}}`
     - **Operation**: `larger than`
     - **Value 2**: `0`

#### Paso 7: Actualizar Stock en ERP

1. Arrastra el nodo **HTTP Request** (conectado a la rama "true")
2. Configuración:
   - **Name**: `Actualizar Stock ERP`
   - **Method**: `PUT`
   - **URL**: `{{$credentials.Norte_ERP_API.baseUrl}}/products/{{$json.data.products[0].id}}/stock`
   - **Authentication**: `Header Auth` → `Norte ERP API`
   - **Body**:
     ```json
     {
       "stock": {{$('Extraer Datos Stock').item.json.stock}},
       "operation": "set"
     }
     ```

**Alternativa:** Si tu API tiene un endpoint para actualizar por código:

```json
{
  "code": "{{$('Extraer Datos Stock').item.json.sku}}",
  "stock": {{$('Extraer Datos Stock').item.json.stock}},
  "operation": "set"
}
```

#### Paso 8: Respuesta al Webhook

1. Arrastra el nodo **Respond to Webhook**
2. Configuración:
   - **Response Code**: `200`
   - **Response Body**: 
     ```json
     {
       "success": true,
       "message": "Stock actualizado correctamente"
     }
     ```

#### Paso 9: Manejo de Errores

1. Arrastra el nodo **Error Trigger**
2. Conecta todos los nodos a este nodo de error
3. Configuración:
   - **Name**: `Manejar Errores`
   - Agrega un nodo **Set** para formatear el error
   - Opcional: Agrega notificación (Email, Slack, etc.)

#### Paso 10: Activar el Workflow

1. Toggle **Active**
2. **Save**

---

### Workflow 3: Creación Automática de Clientes y Órdenes (WooCommerce → ERP)

**Objetivo:** Cuando se crea una orden en WooCommerce, crear automáticamente el cliente si no existe y luego crear la orden en el ERP.

Este es el workflow más importante porque permite construir una base de datos robusta de clientes automáticamente.

#### Paso 1: Crear Workflow

1. **New Workflow**
2. Nombre: `WooCommerce → ERP: Nueva Orden`
3. Descripción: `Crea cliente automáticamente si no existe y luego crea la orden en el ERP`

#### Paso 2: Configurar Webhook para Nuevas Órdenes

1. Arrastra el nodo **Webhook**
2. Configuración:
   - **Name**: `Webhook Nueva Orden`
   - **HTTP Method**: `POST`
   - **Path**: `woocommerce-new-order`
   - **Response Mode**: `Response Node`

3. **Copiar la URL del webhook**

#### Paso 3: Configurar Webhook en WooCommerce

1. Ve a **WooCommerce → Settings → Advanced → Webhooks**
2. Click en **Add webhook**
3. Configuración:
   - **Name**: `Crear Orden en ERP`
   - **Status**: `Active`
   - **Topic**: `Order created`
   - **Delivery URL**: (Pega la URL del webhook de n8n)
   - **Secret**: (Recomendado)
   - **API Version**: `WP REST API Integration v3`

4. Click **Save webhook**

#### Paso 4: Extraer y Preparar Datos del Cliente

1. Arrastra el nodo **Set**
2. Configuración:
   - **Name**: `Preparar Datos Cliente`
   - **Keep Only Set Fields**: `false`
   - **Fields to Set**:
     - **customer_email**: `{{$json.billing.email || $json.customer.email}}`
     - **customer_name**: `{{$json.billing.first_name}} {{$json.billing.last_name}}`
     - **customer_phone**: `{{$json.billing.phone}}`
     - **order_id**: `{{$json.id}}`
     - **order_number**: `{{$json.number}}`
     - **order_date**: `{{$json.date_created}}`
     - **line_items**: `{{$json.line_items}}`
     - **shipping**: `{{$json.shipping}}`
     - **billing**: `{{$json.billing}}`
     - **total**: `{{$json.total}}`

#### Paso 5: Buscar Cliente en ERP por Email

1. Arrastra el nodo **HTTP Request**
2. Configuración:
   - **Name**: `Buscar Cliente en ERP`
   - **Method**: `GET`
   - **URL**: `{{$credentials.Norte_ERP_API.baseUrl}}/clients?search={{$json.customer_email}}`
   - **Authentication**: `Header Auth` → `Norte ERP API`

**Nota:** Ajusta la URL según tu endpoint de búsqueda. Si tu API busca por email directamente, usa: `/clients?email={{$json.customer_email}}`

#### Paso 6: Verificar si el Cliente Existe

1. Arrastra el nodo **IF**
2. Configuración:
   - **Name**: `¿Cliente Existe?`
   - **Condition**:
     - **Value 1**: `{{$json.data.clients.length || $json.data.length || 0}}`
     - **Operation**: `equals`
     - **Value 2**: `0`

#### Paso 7a: Crear Cliente en ERP

1. Arrastra el nodo **HTTP Request** (conectado a la rama "true" del IF)
2. Configuración:
   - **Name**: `Crear Cliente en ERP`
   - **Method**: `POST`
   - **URL**: `{{$credentials.Norte_ERP_API.baseUrl}}/clients`
   - **Authentication**: `Header Auth` → `Norte ERP API`
   - **Body**:
     ```json
     {
       "name": "{{$('Preparar Datos Cliente').item.json.customer_name}}",
       "email": "{{$('Preparar Datos Cliente').item.json.customer_email}}",
       "phone": "{{$('Preparar Datos Cliente').item.json.customer_phone}}",
       "address": "{{$('Preparar Datos Cliente').item.json.shipping.address_1 || $('Preparar Datos Cliente').item.json.billing.address_1}}",
       "city": "{{$('Preparar Datos Cliente').item.json.shipping.city || $('Preparar Datos Cliente').item.json.billing.city}}",
       "country": "{{$('Preparar Datos Cliente').item.json.shipping.country || $('Preparar Datos Cliente').item.json.billing.country || 'Argentina'}}",
       "client_type": "minorista",
       "sales_channel": "woocommerce_minorista"
     }
     ```

**Nota:** Si es para la tienda mayorista, cambia:
- `"client_type": "mayorista"`
- `"sales_channel": "woocommerce_mayorista"`

3. Arrastra un nodo **Set** después para extraer el ID del cliente creado:
   - **Name**: `Extraer ID Cliente Creado`
   - **client_id**: `{{$json.data.id}}`

#### Paso 7b: Usar Cliente Existente

1. Arrastra el nodo **Set** (conectado a la rama "false" del IF)
2. Configuración:
   - **Name**: `Extraer ID Cliente Existente`
   - **client_id**: `{{$json.data.clients[0].id || $json.data[0].id}}`

#### Paso 8: Preparar Datos de la Orden para el ERP

1. Arrastra el nodo **Code** (JavaScript)
2. Configuración:
   - **Name**: `Preparar Datos Orden`
   - **Mode**: `Run Once for All Items`
   - **Code**:
   ```javascript
   // Obtener datos del cliente (ya sea creado o existente)
   const clienteData = $input.first();
   const ordenData = $('Preparar Datos Cliente').first().json;
   
   // Preparar items de la orden
   const lineItems = ordenData.line_items || [];
   const items = [];
   
   for (const item of lineItems) {
     items.push({
       sku: item.sku,
       quantity: item.quantity || 1,
       unit_price: parseFloat(item.price || 0),
       product_name: item.name
     });
   }
   
   // Preparar objeto completo de la orden
   return {
     order_date: ordenData.order_date,
     order_number: ordenData.order_number || ordenData.order_id.toString(),
     customer: {
       email: ordenData.customer_email,
       first_name: ordenData.billing?.first_name || '',
       last_name: ordenData.billing?.last_name || '',
       phone: ordenData.customer_phone,
       display_name: ordenData.customer_name
     },
     line_items: items,
     shipping: {
       address_1: ordenData.shipping?.address_1 || ordenData.billing?.address_1 || '',
       city: ordenData.shipping?.city || ordenData.billing?.city || '',
       country: ordenData.shipping?.country || ordenData.billing?.country || 'Argentina',
       phone: ordenData.shipping?.phone || ordenData.customer_phone,
       method: ordenData.shipping?.method_title || '',
       total: ordenData.shipping?.total || '0'
     },
     billing: {
       address_1: ordenData.billing?.address_1 || '',
       city: ordenData.billing?.city || '',
       country: ordenData.billing?.country || 'Argentina',
       phone: ordenData.billing?.phone || ordenData.customer_phone
     },
     total: ordenData.total || '0'
   };
   ```

#### Paso 9: Crear Orden en ERP

1. Arrastra el nodo **HTTP Request**
2. Configuración:
   - **Name**: `Crear Orden en ERP`
   - **Method**: `POST`
   - **URL**: `{{$credentials.Norte_ERP_API.baseUrl}}/integration/orders/woocommerce-mayorista`
   - **Authentication**: `Header Auth` → `Norte ERP API`
   - **Body**:
     ```json
     {{$json}}
     ```

**Nota:** Tu API ya tiene un endpoint específico `/integration/orders/woocommerce-mayorista` que maneja la creación automática de clientes. Si prefieres usar ese endpoint directamente, puedes simplificar el workflow saltándote los pasos 5-7 y enviando directamente los datos de WooCommerce a ese endpoint.

#### Paso 10: Respuesta al Webhook

1. Arrastra el nodo **Respond to Webhook**
2. Configuración:
   - **Response Code**: `200`
   - **Response Body**: 
     ```json
     {
       "success": true,
       "message": "Orden creada exitosamente en el ERP",
       "order_id": "{{$json.data.order.id}}",
       "order_number": "{{$json.data.order.order_number}}"
     }
     ```

#### Paso 11: Manejo de Errores

1. Arrastra el nodo **Error Trigger**
2. Conecta todos los nodos críticos a este nodo
3. Agrega un nodo **Set** para formatear el error
4. Opcional: Agrega notificación (Email, Slack, Telegram, etc.)

#### Paso 12: Activar el Workflow

1. Toggle **Active**
2. **Save**

**¡Listo!** Ahora cada vez que se cree una orden en WooCommerce:
1. Se buscará el cliente por email
2. Si no existe, se creará automáticamente
3. Se creará la orden en el ERP con todos los productos

---

## 5. Mejores Prácticas

### 5.1 Manejo de Errores

- ✅ **Siempre agrega nodos Error Trigger** en workflows críticos
- ✅ **Configura notificaciones** (email, Slack) para errores importantes
- ✅ **Usa nodos Try-Catch** para operaciones que pueden fallar
- ✅ **Implementa reintentos** en operaciones críticas

**Ejemplo de configuración de Error Trigger:**
```
Error Trigger → Set (formatear error) → Email/Slack (notificar)
```

### 5.2 Logging y Debugging

- ✅ **Usa nodos Set** para guardar datos intermedios y facilitar debugging
- ✅ **Revisa Execution Log** en n8n después de cada ejecución
- ✅ **Agrega nodos de logging** antes de operaciones críticas
- ✅ **Usa nombres descriptivos** para todos los nodos

**Tip:** Agrega un nodo **Set** llamado "Debug" antes de operaciones críticas para guardar el estado actual de los datos.

### 5.3 Optimización

- ✅ **Usa Split In Batches** para procesar grandes volúmenes de datos
- ✅ **Configura timeouts apropiados** en HTTP Requests (30-60 segundos)
- ✅ **Implementa rate limiting** si haces muchas llamadas a APIs externas
- ✅ **Usa filtros** para evitar procesar datos innecesarios

**Ejemplo de rate limiting:**
Agrega un nodo **Wait** entre llamadas a APIs si hay límites de rate:
- **Wait Time**: `1000` (1 segundo entre llamadas)

### 5.4 Seguridad

- ✅ **Usa credenciales encriptadas** en n8n (nunca hardcodees passwords)
- ✅ **Valida webhooks con secret keys** cuando sea posible
- ✅ **Usa HTTPS** para todas las conexiones
- ✅ **Implementa autenticación básica** en n8n si es self-hosted
- ✅ **Revisa logs regularmente** para detectar accesos no autorizados

### 5.5 Testing

- ✅ **Prueba workflows con datos de prueba** antes de activarlos
- ✅ **Usa el modo "Manual"** para ejecutar workflows manualmente y verificar resultados
- ✅ **Crea workflows de prueba** separados para testing
- ✅ **Verifica que los datos se transformen correctamente** en cada paso

### 5.6 Monitoreo

- ✅ **Revisa ejecuciones fallidas** regularmente
- ✅ **Configura alertas** para workflows críticos
- ✅ **Monitorea el uso de recursos** si es self-hosted
- ✅ **Mantén logs de auditoría** de operaciones importantes

---

## 6. Troubleshooting

### Problema: El webhook no se ejecuta

**Síntomas:** El workflow no se activa cuando debería.

**Soluciones:**
1. ✅ Verificar que el workflow esté **activado** (toggle Active)
2. ✅ Revisar la **URL del webhook** en WooCommerce (debe coincidir exactamente)
3. ✅ Verificar que el webhook en WooCommerce esté en estado **Active**
4. ✅ Revisar **Execution Log** en n8n para ver si hay errores
5. ✅ Verificar que n8n sea accesible desde internet (si es self-hosted, verificar firewall)
6. ✅ Probar el webhook manualmente con una herramienta como Postman

### Problema: Error 401 (No autorizado)

**Síntomas:** Las peticiones al ERP fallan con error 401.

**Soluciones:**
1. ✅ Verificar que la **API Key** esté correcta en las credenciales
2. ✅ Revisar que el header `x-api-key` esté configurado correctamente
3. ✅ Verificar que la **Base URL** sea correcta
4. ✅ Si usas JWT, verificar que el token no haya expirado
5. ✅ Revisar logs del ERP para ver qué error específico devuelve

### Problema: Cliente no se crea

**Síntomas:** El workflow se ejecuta pero el cliente no aparece en el ERP.

**Soluciones:**
1. ✅ Verificar que el **email** sea válido y no esté vacío
2. ✅ Revisar **logs del ERP** para ver errores de validación
3. ✅ Verificar que el campo **name** no esté vacío
4. ✅ Revisar que los **roles/permissions** del usuario de la API permitan crear clientes
5. ✅ Verificar el formato del **request body** (debe coincidir con la documentación de la API)
6. ✅ Revisar Execution Log en n8n para ver la respuesta del servidor

### Problema: Producto no se encuentra

**Síntomas:** Al crear una orden, algunos productos no se encuentran en el ERP.

**Soluciones:**
1. ✅ Verificar que el **SKU** coincida exactamente entre WooCommerce y ERP
2. ✅ Revisar que el producto esté **activo** en el ERP (`is_active = true`)
3. ✅ Verificar que el producto exista en el ERP antes de crear la orden
4. ✅ Implementar un workflow de sincronización de productos primero
5. ✅ Agregar validación en el workflow para productos faltantes

### Problema: Stock no se sincroniza correctamente

**Síntomas:** El stock en WooCommerce y ERP no coincide.

**Soluciones:**
1. ✅ Verificar que el **webhook de actualización de stock** esté configurado correctamente
2. ✅ Revisar que el **SKU** coincida entre ambos sistemas
3. ✅ Verificar que la **operación de stock** sea correcta (`set`, `add`, `subtract`)
4. ✅ Revisar logs de ambos sistemas para ver qué valores se están enviando/recibiendo
5. ✅ Verificar que no haya **múltiples workflows** actualizando el mismo producto simultáneamente

### Problema: Workflow se ejecuta muy lento

**Síntomas:** Los workflows tardan mucho en completarse.

**Soluciones:**
1. ✅ Reducir el **Batch Size** en Split In Batches
2. ✅ Aumentar el **timeout** en HTTP Requests si las APIs son lentas
3. ✅ Verificar la **conexión a internet** y latencia de las APIs
4. ✅ Optimizar las **consultas a la base de datos** en el ERP
5. ✅ Considerar ejecutar workflows en **horarios de menor carga**

### Problema: Datos no se transforman correctamente

**Síntomas:** Los datos llegan al ERP pero en formato incorrecto.

**Soluciones:**
1. ✅ Revisar el **Execution Log** en n8n para ver los datos en cada paso
2. ✅ Usar nodos **Set** para verificar transformaciones intermedias
3. ✅ Verificar que las **expresiones** en los nodos sean correctas (ej: `{{$json.field}}`)
4. ✅ Comparar el formato esperado por el ERP con lo que se está enviando
5. ✅ Usar el nodo **Code** para transformaciones complejas

---

## 7. Próximos Pasos

### Fase 1: Implementación Básica (Semana 1)

1. ✅ **Instalar y configurar n8n**
2. ✅ **Configurar credenciales** (ERP y WooCommerce)
3. ✅ **Implementar Workflow 3** (Creación automática de clientes y órdenes) - **MÁS IMPORTANTE**
4. ✅ **Probar con órdenes de prueba**
5. ✅ **Monitorear durante 2-3 días**

### Fase 2: Sincronización de Productos (Semana 2)

1. ✅ **Implementar Workflow 1** (Sincronización de productos)
2. ✅ **Configurar schedule** apropiado (cada hora o según necesidad)
3. ✅ **Verificar que productos se sincronicen correctamente**
4. ✅ **Ajustar mapeo de campos** si es necesario

### Fase 3: Sincronización de Stock (Semana 3)

1. ✅ **Implementar Workflow 2** (Sincronización de stock)
2. ✅ **Configurar webhooks en WooCommerce**
3. ✅ **Probar cambios de stock** manualmente
4. ✅ **Verificar sincronización bidireccional** si es necesario

### Fase 4: Optimización y Mejoras (Semana 4+)

1. ✅ **Agregar manejo de errores** robusto
2. ✅ **Implementar notificaciones** (email, Slack)
3. ✅ **Optimizar workflows** según uso real
4. ✅ **Documentar casos especiales** y ajustes personalizados
5. ✅ **Crear workflows adicionales** según necesidades (ej: actualizar estado de órdenes)

### Workflows Adicionales Recomendados

#### Workflow 4: Actualizar Estado de Orden (ERP → WooCommerce)

Cuando una orden cambia de estado en el ERP, actualizar el estado en WooCommerce.

**Trigger:** Webhook desde ERP cuando cambia el estado de una orden  
**Acción:** Actualizar orden en WooCommerce con nuevo estado

#### Workflow 5: Sincronización Bidireccional de Stock

Sincronizar stock en ambas direcciones:
- ERP → WooCommerce (cuando cambia en ERP)
- WooCommerce → ERP (cuando cambia en WooCommerce)

**Precaución:** Implementar lógica para evitar loops infinitos.

#### Workflow 6: Reporte de Sincronización Diaria

Enviar un reporte diario con:
- Órdenes sincronizadas
- Clientes creados
- Errores encontrados
- Productos sincronizados

---

## 8. Recursos Adicionales

### Documentación Oficial

- **n8n Documentation**: [https://docs.n8n.io](https://docs.n8n.io)
- **n8n Community**: [https://community.n8n.io](https://community.n8n.io)
- **WooCommerce REST API**: [https://woocommerce.github.io/woocommerce-rest-api-docs/](https://woocommerce.github.io/woocommerce-rest-api-docs/)

### Tutoriales y Guías

- **n8n YouTube Channel**: [https://www.youtube.com/c/n8n-io](https://www.youtube.com/c/n8n-io)
- **n8n Blog**: [https://n8n.io/blog](https://n8n.io/blog)
- **WooCommerce Webhooks Guide**: [https://woocommerce.com/document/webhooks/](https://woocommerce.com/document/webhooks/)

### Herramientas Útiles

- **Postman**: Para probar APIs manualmente
- **JSON Formatter**: Para formatear y validar JSON
- **Cron Expression Generator**: Para generar expresiones cron

### Soporte

- **n8n Community Forum**: Para preguntas y ayuda
- **WooCommerce Support**: Para problemas específicos de WooCommerce
- **Documentación del ERP**: Revisar documentación de endpoints en `/docs`

---

## 9. Ejemplos de Expresiones Útiles en n8n

### Acceder a Datos de Nodos Anteriores

```javascript
// Datos del nodo anterior
{{$json.field}}

// Datos de un nodo específico
{{$('Nombre del Nodo').item.json.field}}

// Primer elemento de un array
{{$json.array[0].field}}

// Último elemento procesado
{{$input.item.json.field}}
```

### Transformaciones Comunes

```javascript
// Concatenar strings
{{$json.first_name}} {{$json.last_name}}

// Condicionales
{{$json.stock > 0 ? 'instock' : 'outofstock'}}

// Formatear números
{{parseFloat($json.price).toFixed(2)}}

// Fechas
{{new Date().toISOString()}}
```

### Ejemplos en Workflows

```javascript
// Obtener email del cliente
{{$json.billing.email || $json.customer.email}}

// Obtener dirección de envío o facturación
{{$json.shipping.address_1 || $json.billing.address_1}}

// Calcular total
{{parseFloat($json.subtotal) + parseFloat($json.shipping_total)}}
```

---

## 10. Checklist de Implementación

### Antes de Empezar

- [ ] n8n instalado y configurado
- [ ] Credenciales del ERP configuradas
- [ ] Credenciales de WooCommerce configuradas
- [ ] Acceso a logs del ERP
- [ ] Acceso a logs de WooCommerce
- [ ] Documentación de APIs revisada

### Workflow 1: Sincronización de Productos

- [ ] Workflow creado
- [ ] Schedule trigger configurado
- [ ] Endpoint de productos del ERP probado
- [ ] Búsqueda de productos en WooCommerce funcionando
- [ ] Creación de productos probada
- [ ] Actualización de productos probada
- [ ] Workflow activado
- [ ] Primera ejecución exitosa

### Workflow 2: Sincronización de Stock

- [ ] Workflow creado
- [ ] Webhook configurado en n8n
- [ ] Webhook configurado en WooCommerce
- [ ] Webhook probado manualmente
- [ ] Actualización de stock en ERP probada
- [ ] Manejo de errores implementado
- [ ] Workflow activado
- [ ] Cambio de stock probado

### Workflow 3: Creación de Clientes y Órdenes

- [ ] Workflow creado
- [ ] Webhook configurado en n8n
- [ ] Webhook configurado en WooCommerce
- [ ] Búsqueda de clientes probada
- [ ] Creación de clientes probada
- [ ] Creación de órdenes probada
- [ ] Manejo de errores implementado
- [ ] Notificaciones configuradas
- [ ] Workflow activado
- [ ] Orden de prueba creada exitosamente

### Post-Implementación

- [ ] Monitoreo durante 1 semana
- [ ] Errores documentados y resueltos
- [ ] Optimizaciones aplicadas
- [ ] Documentación actualizada
- [ ] Equipo entrenado en el uso de n8n

---

## 11. Notas Finales

### Importante

- ⚠️ **Siempre prueba en un ambiente de desarrollo** antes de activar workflows en producción
- ⚠️ **Haz backups** de tus workflows regularmente (n8n permite exportar workflows como JSON)
- ⚠️ **Monitorea los primeros días** después de implementar cada workflow
- ⚠️ **Documenta cualquier personalización** que hagas a los workflows

### Recomendación de Orden de Implementación

1. **Primero:** Workflow 3 (Órdenes y Clientes) - Es el más crítico y te permitirá construir la base de datos de clientes
2. **Segundo:** Workflow 1 (Productos) - Asegura que los productos estén sincronizados
3. **Tercero:** Workflow 2 (Stock) - Mantiene el stock actualizado

### Contacto y Soporte

Si encuentras problemas o necesitas ayuda adicional:
1. Revisa los logs de ejecución en n8n
2. Revisa los logs del ERP
3. Consulta la documentación de n8n
4. Consulta la documentación del ERP en `/docs`

---

**¡Éxito con tu integración! 🚀**

