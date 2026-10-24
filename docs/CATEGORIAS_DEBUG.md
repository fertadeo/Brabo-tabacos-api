# 🔍 Guía de Debugging - Sincronización de Categorías

## ❌ Problema: No se ven logs cuando se crea una categoría en WooCommerce

Si creaste una categoría en WooCommerce pero no ves logs en la API, sigue estos pasos:

---

## ✅ Paso 1: Verificar que el Snippet esté Instalado

### En WordPress:

1. Ve a **Plugins → Code Snippets** (o donde tengas el snippet)
2. Verifica que el snippet esté **Activo** (no solo guardado)
3. Verifica que el código tenga la URL correcta de tu API

### Verificar el código del snippet:

El snippet debe tener algo como esto:

```php
$this->api_url = 'https://api.sistema.mfcomputers.com.ar/api/woocommerce/categories/sync';
$this->secret = 'mf-wooc-secret'; // Debe coincidir con WEBHOOK_SECRET
```

---

## ✅ Paso 2: Activar Debug en WordPress

En `wp-config.php`, agrega estas líneas **antes de** `/* That's all, stop editing! */`:

```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

Esto creará un archivo `wp-content/debug.log` donde verás los errores.

---

## ✅ Paso 3: Verificar Logs de WordPress

Después de crear una categoría, revisa `wp-content/debug.log`:

```bash
# En el servidor de WordPress
tail -f wp-content/debug.log
```

O descarga el archivo y busca mensajes como:
- `ERP Category Sync:`
- `Error enviando webhook`
- `Todas las categorías enviadas`

---

## ✅ Paso 4: Verificar que la API esté Recibiendo Requests

Con los logs agregados al middleware, ahora verás **TODAS** las requests que lleguen, incluso si fallan la autenticación.

### En los logs de la API deberías ver:

```
[WEBHOOK-AUTH] Request recibida en: POST /api/woocommerce/categories/sync
[WEBHOOK-AUTH] IP: xxx.xxx.xxx.xxx
[WEBHOOK-AUTH] Headers recibidos: { ... }
```

**Si NO ves estos logs**, significa que:
- ❌ El snippet no está enviando la request
- ❌ Hay un problema de conectividad entre WordPress y la API
- ❌ La URL en el snippet está incorrecta

---

## ✅ Paso 5: Probar el Endpoint Manualmente

Prueba el endpoint directamente con cURL o Postman:

```bash
curl -X POST https://api.sistema.mfcomputers.com.ar/api/woocommerce/categories/sync \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: mf-wooc-secret" \
  -d '{
    "categories": [
      {
        "id": 999,
        "name": "Prueba Manual",
        "slug": "prueba-manual",
        "parent": 0
      }
    ]
  }'
```

**Si esto funciona**, verás logs en la API. Si funciona, el problema está en WordPress.

---

## ✅ Paso 6: Verificar Variables de Entorno

### En Vercel:
1. Ve a **Settings → Environment Variables**
2. Verifica que `WEBHOOK_SECRET` esté configurada
3. Verifica que el valor sea exactamente igual al del snippet

### En desarrollo local:
Verifica tu archivo `.env`:

```env
WEBHOOK_SECRET=mf-wooc-secret
```

---

## ✅ Paso 7: Verificar que WordPress Pueda Hacer Requests Externos

Agrega este código temporal al snippet para probar:

```php
// Prueba de conectividad
$test_url = 'https://api.sistema.mfcomputers.com.ar/api/woocommerce/categories/sync';
$test_response = wp_remote_get($test_url, array('timeout' => 10));

if (is_wp_error($test_response)) {
    error_log('ERROR de conectividad: ' . $test_response->get_error_message());
} else {
    $response_code = wp_remote_retrieve_response_code($test_response);
    error_log('Conectividad OK. Código: ' . $response_code);
}
```

---

## ✅ Paso 8: Verificar Hooks de WordPress

Asegúrate de que los hooks estén registrados correctamente. El snippet debe tener:

```php
add_action('created_product_cat', 'sync_all_product_categories_to_erp', 10, 3);
add_action('edited_product_cat', 'sync_all_product_categories_to_erp', 10, 3);
```

**Prueba rápida**: Agrega esto temporalmente al snippet:

```php
add_action('created_product_cat', function($term_id) {
    error_log('HOOK DISPARADO: created_product_cat - ID: ' . $term_id);
}, 10, 1);
```

Si ves este log cuando creas una categoría, el hook funciona. Si no, hay un problema con WordPress.

---

## ✅ Paso 9: Verificar URL y Secret en el Snippet

### URL debe ser exactamente:
```
https://api.sistema.mfcomputers.com.ar/api/woocommerce/categories/sync
```

### Secret debe coincidir exactamente:
- En WordPress: `$this->secret = 'mf-wooc-secret';`
- En Vercel/`.env`: `WEBHOOK_SECRET=mf-wooc-secret`

**Importante**: Sin espacios, sin comillas extras, exactamente igual.

---

## ✅ Paso 10: Verificar Logs de la API en Tiempo Real

### En desarrollo local:
Los logs aparecen directamente en la consola.

### En Vercel:
```bash
vercel logs --follow
```

O ve a Vercel Dashboard → Deployments → Click en el deployment → Functions → Ver logs

---

## 🐛 Problemas Comunes y Soluciones

### Problema 1: No veo logs de `[WEBHOOK-AUTH]`

**Causa**: El request no está llegando a la API.

**Soluciones**:
1. Verifica que la URL en el snippet sea correcta
2. Verifica que WordPress pueda hacer requests externos (no bloqueado por firewall)
3. Verifica que el snippet esté activo
4. Revisa `wp-content/debug.log` para errores

---

### Problema 2: Veo `[WEBHOOK-AUTH]` pero dice "AUTENTICACIÓN FALLIDA"

**Causa**: El secret no coincide.

**Soluciones**:
1. Verifica que `WEBHOOK_SECRET` en Vercel sea igual al del snippet
2. Verifica que no haya espacios extra
3. Verifica que el header se esté enviando como `X-Webhook-Secret` (case-sensitive)

---

### Problema 3: Veo logs pero dice "Formato inválido"

**Causa**: El payload no tiene el formato correcto.

**Soluciones**:
1. Verifica que el snippet esté enviando `{ "categories": [...] }`
2. Verifica que cada categoría tenga `id`, `name`, `slug`, `parent`

---

### Problema 4: El hook no se dispara en WordPress

**Causa**: El snippet no está activo o hay un error de sintaxis.

**Soluciones**:
1. Verifica que el snippet esté activo
2. Revisa `wp-content/debug.log` para errores de PHP
3. Verifica que no haya errores de sintaxis en el snippet
4. Prueba desactivar y reactivar el snippet

---

## 📋 Checklist de Debugging

Marca cada paso cuando lo completes:

- [ ] Snippet está activo en WordPress
- [ ] `WP_DEBUG` está activado
- [ ] Revisé `wp-content/debug.log` después de crear categoría
- [ ] Probé el endpoint manualmente con cURL
- [ ] Verifiqué que `WEBHOOK_SECRET` coincida en WordPress y Vercel
- [ ] Verifiqué los logs de la API (veo `[WEBHOOK-AUTH]`)
- [ ] Verifiqué que la URL del snippet sea correcta
- [ ] Verifiqué que WordPress pueda hacer requests externos

---

## 🧪 Prueba Rápida Completa

Ejecuta este comando para probar todo el flujo:

```bash
# 1. Probar endpoint directamente
curl -X POST https://api.sistema.mfcomputers.com.ar/api/woocommerce/categories/sync \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: mf-wooc-secret" \
  -d '{"categories":[{"id":999,"name":"Test","slug":"test","parent":0}]}'

# 2. Verificar en BD
# SELECT * FROM categories WHERE woocommerce_id = 999;

# 3. Crear categoría en WordPress y ver logs
# tail -f wp-content/debug.log
```

---

## 📞 Si Nada Funciona

Si después de seguir todos estos pasos aún no funciona:

1. **Comparte los logs**:
   - Logs de WordPress (`wp-content/debug.log`)
   - Logs de la API (Vercel o servidor)
   - Logs del middleware `[WEBHOOK-AUTH]`

2. **Verifica la versión del snippet**:
   - Asegúrate de usar la versión más reciente que envía TODAS las categorías

3. **Prueba con un snippet simplificado**:
   - Usa solo la función básica sin clases para descartar problemas de OOP

---

## ✅ Snippet Simplificado para Prueba

Si el snippet completo no funciona, prueba con esta versión simplificada:

```php
function test_category_sync($term_id) {
    error_log('TEST: Hook disparado para categoría ID: ' . $term_id);
    
    $api_url = 'https://api.sistema.mfcomputers.com.ar/api/woocommerce/categories/sync';
    $secret = 'mf-wooc-secret';
    
    $all_cats = get_terms(array('taxonomy' => 'product_cat', 'hide_empty' => false));
    $payload = array('categories' => array());
    
    foreach ($all_cats as $cat) {
        $payload['categories'][] = array(
            'id' => (int)$cat->term_id,
            'name' => $cat->name,
            'slug' => $cat->slug,
            'parent' => $cat->parent ? (int)$cat->parent : 0
        );
    }
    
    error_log('TEST: Enviando ' . count($payload['categories']) . ' categorías');
    
    $response = wp_remote_post($api_url, array(
        'method' => 'POST',
        'timeout' => 30,
        'blocking' => true, // Cambiar a true para ver errores inmediatamente
        'headers' => array(
            'Content-Type' => 'application/json',
            'X-Webhook-Secret' => $secret
        ),
        'body' => json_encode($payload)
    ));
    
    if (is_wp_error($response)) {
        error_log('TEST ERROR: ' . $response->get_error_message());
    } else {
        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        error_log('TEST Response Code: ' . $code);
        error_log('TEST Response Body: ' . $body);
    }
}

add_action('created_product_cat', 'test_category_sync', 10, 1);
```

Este snippet simplificado te dará logs detallados de cada paso.
