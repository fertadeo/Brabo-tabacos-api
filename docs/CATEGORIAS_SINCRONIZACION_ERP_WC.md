# 🔄 Sincronización ERP → WooCommerce

## 📋 Resumen

Este documento describe cómo funciona la sincronización de categorías desde el ERP hacia WooCommerce. Cuando un usuario del ERP crea, edita o elimina una categoría, automáticamente se sincroniza con WooCommerce para que los clientes vean los cambios.

---

## ⚙️ Configuración

### Variables de Entorno

Agrega estas variables en tu archivo `.env` o en Vercel:

```env
# WooCommerce REST API Configuration
WOOCOMMERCE_URL=https://tu-tienda.com
WOOCOMMERCE_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WOOCOMMERCE_API_VERSION=wc/v3
```

### Obtener Credenciales de WooCommerce

1. Ve a **WooCommerce → Settings → Advanced → REST API**
2. Click en **Add Key**
3. Configura:
   - **Description**: `ERP Integration`
   - **User**: Selecciona un usuario con permisos de administrador
   - **Permissions**: `Read/Write`
4. Click **Generate API Key**
5. Copia el **Consumer Key** y **Consumer Secret**

---

## 🔄 Flujo de Sincronización

### 1. Crear Categoría en el ERP

**Endpoint:** `POST /api/categories`

**Request:**
```json
{
  "name": "Laptops",
  "description": "Categoría de laptops",
  "parent_id": null
}
```

**Proceso:**
1. Se crea la categoría en el ERP
2. Si no tiene `woocommerce_id`, se crea automáticamente en WooCommerce
3. Se actualiza la categoría en el ERP con el `woocommerce_id` y `woocommerce_slug` recibidos de WooCommerce

**Response:**
```json
{
  "success": true,
  "message": "Categoría creada exitosamente y sincronizada a WooCommerce (ID: 15)",
  "data": {
    "category": {
      "id": 1,
      "name": "Laptops",
      "woocommerce_id": 15,
      "woocommerce_slug": "laptops",
      "is_active": true
    }
  }
}
```

### 2. Editar Categoría en el ERP

**Endpoint:** `PUT /api/categories/:id`

**Request:**
```json
{
  "name": "Laptops Gaming",
  "description": "Laptops para gaming"
}
```

**Proceso:**
1. Se actualiza la categoría en el ERP
2. Si la categoría tiene `woocommerce_id`, se actualiza automáticamente en WooCommerce
3. Si se cambia el `parent_id`, se resuelve el `woocommerce_id` del padre y se actualiza en WooCommerce

**Response:**
```json
{
  "success": true,
  "message": "Categoría actualizada exitosamente y sincronizada a WooCommerce",
  "data": {
    "category": {
      "id": 1,
      "name": "Laptops Gaming",
      "woocommerce_id": 15,
      "woocommerce_slug": "laptops-gaming"
    }
  }
}
```

### 3. Eliminar Categoría en el ERP

**Endpoint:** `DELETE /api/categories/:id`

**Proceso:**
1. Si la categoría tiene `woocommerce_id`, se elimina primero en WooCommerce
2. Se desactiva la categoría en el ERP (`is_active = false`)
3. Se limpian los campos `woocommerce_id` y `woocommerce_slug`

**Response:**
```json
{
  "success": true,
  "message": "Categoría eliminada exitosamente",
  "data": {
    "id": 1,
    "name": "Laptops Gaming",
    "woocommerce_id": null
  }
}
```

### 4. Desactivar Categoría (Soft Delete)

**Endpoint:** `PUT /api/categories/:id`

**Request:**
```json
{
  "is_active": false
}
```

**Proceso:**
1. Si la categoría tiene `woocommerce_id`, se elimina en WooCommerce
2. Se desactiva la categoría en el ERP (`is_active = false`)
3. Se mantienen los campos `woocommerce_id` y `woocommerce_slug` (por si se reactiva después)

---

## 🔍 Detalles Técnicos

### Manejo de Categorías Padre

Cuando una categoría tiene `parent_id` en el ERP:
- El sistema busca el `woocommerce_id` del padre en el ERP
- Si el padre tiene `woocommerce_id`, se usa ese ID al crear/actualizar en WooCommerce
- Si el padre no tiene `woocommerce_id`, se crea primero el padre en WooCommerce

### Generación de Slugs

Si una categoría no tiene `woocommerce_slug` al crearse:
- Se genera automáticamente desde el nombre
- Se normaliza (elimina acentos, caracteres especiales)
- Se convierte a minúsculas y se reemplazan espacios por guiones

Ejemplo: `"Laptops Gaming"` → `"laptops-gaming"`

### Manejo de Errores

Si la sincronización a WooCommerce falla:
- **Al crear**: La categoría se crea en el ERP pero sin `woocommerce_id`
- **Al actualizar**: La categoría se actualiza en el ERP pero no en WooCommerce
- **Al eliminar**: Se intenta eliminar de WooCommerce, pero si falla, se continúa con la desactivación en el ERP

Los errores se registran en los logs pero no interrumpen la operación en el ERP.

---

## 🧪 Pruebas

### Prueba 1: Crear Categoría

```bash
curl -X POST https://api.sistema.mfcomputers.com.ar/api/categories \
  -H "X-API-Key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Category",
    "description": "Categoría de prueba"
  }'
```

**Verificar en WooCommerce:**
1. Ve a **Productos → Categorías**
2. Busca "Test Category"
3. Verifica que se haya creado correctamente

### Prueba 2: Actualizar Categoría

```bash
curl -X PUT https://api.sistema.mfcomputers.com.ar/api/categories/1 \
  -H "X-API-Key: tu-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Category Updated"
  }'
```

**Verificar en WooCommerce:**
1. Ve a **Productos → Categorías**
2. Busca la categoría actualizada
3. Verifica que el nombre haya cambiado

### Prueba 3: Eliminar Categoría

```bash
curl -X DELETE https://api.sistema.mfcomputers.com.ar/api/categories/1 \
  -H "X-API-Key: tu-api-key"
```

**Verificar en WooCommerce:**
1. Ve a **Productos → Categorías**
2. Verifica que la categoría ya no exista (o esté en la papelera)

---

## ⚠️ Consideraciones Importantes

### 1. Sincronización Bidireccional

- **ERP → WooCommerce**: Automática cuando se crea/edita/elimina en el ERP
- **WooCommerce → ERP**: Automática cuando se crea/edita/elimina en WooCommerce (vía webhook)

### 2. Evitar Bucles Infinitos

El sistema detecta si una categoría viene de WooCommerce (tiene `woocommerce_id`) y no sincroniza de vuelta para evitar bucles.

### 3. Productos Asociados

Cuando se elimina una categoría en WooCommerce:
- Los productos que tenían esa categoría quedan sin categoría
- En el ERP, los productos mantienen el `category_id` pero la categoría está inactiva

**Recomendación**: Antes de eliminar una categoría, verifica qué productos la usan.

---

## 📊 Logs

Los logs de sincronización incluyen:

```
[CategoryService] Sincronizando categoría "Laptops" a WooCommerce...
[WooCommerceService] Creando categoría en WooCommerce: { name: "Laptops", ... }
[CategoryService] ✅ Categoría creada en WooCommerce (ID: 15)
```

Si hay errores:

```
[CategoryService] Error sincronizando categoría a WooCommerce: WooCommerce API Error: ...
```

---

## 🔧 Troubleshooting

### Error: "WooCommerce no está configurado"

**Causa**: Las variables de entorno no están configuradas.

**Solución**: Verifica que `WOOCOMMERCE_URL`, `WOOCOMMERCE_CONSUMER_KEY` y `WOOCOMMERCE_CONSUMER_SECRET` estén configuradas.

### Error: "WooCommerce API Error: 401"

**Causa**: Las credenciales son incorrectas.

**Solución**: Verifica que el Consumer Key y Consumer Secret sean correctos y tengan permisos Read/Write.

### Error: "WooCommerce API Error: 404"

**Causa**: La categoría no existe en WooCommerce.

**Solución**: Verifica que el `woocommerce_id` sea correcto o que la categoría no haya sido eliminada manualmente en WooCommerce.

### La categoría se crea en el ERP pero no en WooCommerce

**Causa**: WooCommerce no está configurado o hay un error de conexión.

**Solución**: 
1. Verifica los logs de la API
2. Verifica que las credenciales sean correctas
3. Verifica que la URL de WooCommerce sea accesible desde el servidor de la API

---

## ✅ Checklist de Configuración

- [ ] Variables de entorno configuradas en `.env` o Vercel
- [ ] Consumer Key y Consumer Secret generados en WooCommerce
- [ ] Permisos Read/Write configurados en WooCommerce
- [ ] Prueba de creación de categoría exitosa
- [ ] Prueba de actualización de categoría exitosa
- [ ] Prueba de eliminación de categoría exitosa
- [ ] Logs verificados sin errores

---

## 🎯 Resumen del Flujo Completo

```
Usuario en ERP crea categoría
    ↓
ERP crea categoría en BD
    ↓
ERP crea categoría en WooCommerce (si está configurado)
    ↓
ERP actualiza categoría con woocommerce_id
    ↓
Cliente ve categoría en WooCommerce
```

¡La sincronización está lista para usar! 🚀
