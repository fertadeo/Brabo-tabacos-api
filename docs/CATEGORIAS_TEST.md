# 🧪 Guía de Pruebas - Sincronización de Categorías

## ✅ Checklist Pre-Prueba

Antes de hacer la primera prueba, verifica:

- [ ] La tabla `categories` existe en la base de datos
- [ ] Los campos `woocommerce_id`, `woocommerce_slug`, `parent_id`, `updated_at` están agregados a la tabla
- [ ] La variable `WEBHOOK_SECRET` está configurada en Vercel/`.env`
- [ ] El snippet de WordPress está instalado y activo
- [ ] El servidor de la API está corriendo

---

## 🔍 Prueba 1: Verificar Endpoint Manualmente (Postman/cURL)

### Prueba con cURL:

```bash
curl -X POST https://api.sistema.mfcomputers.com.ar/api/woocommerce/categories/sync \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: mf-wooc-secret" \
  -d '{
    "categories": [
      {
        "id": 1,
        "name": "Electrónicos",
        "slug": "electronicos",
        "parent": 0
      },
      {
        "id": 2,
        "name": "Computadoras",
        "slug": "computadoras",
        "parent": 1
      }
    ]
  }'
```

### Respuesta esperada:

```json
{
  "success": true,
  "message": "Sincronización completada. 2 creadas, 0 actualizadas.",
  "data": {
    "created": 2,
    "updated": 0,
    "errors": []
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

## 🔍 Prueba 2: Verificar Categorías en Base de Datos

Después de la prueba 1, verifica que las categorías se hayan creado:

```sql
SELECT id, name, woocommerce_id, woocommerce_slug, parent_id, is_active 
FROM categories 
ORDER BY woocommerce_id;
```

Deberías ver:
- `name`: "Electrónicos", `woocommerce_id`: 1, `parent_id`: NULL
- `name`: "Computadoras", `woocommerce_id`: 2, `parent_id`: 1

---

## 🔍 Prueba 3: Probar desde WordPress

### Paso 1: Activar Debug en WordPress

En `wp-config.php`, agrega:

```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

### Paso 2: Crear una categoría de prueba

1. Ve a **Productos → Categorías** en WordPress
2. Crea una nueva categoría llamada "Prueba Sync"
3. Guarda

### Paso 3: Verificar logs

Revisa `wp-content/debug.log` para ver:

```
ERP Category Sync: Todas las categorías sincronizadas exitosamente. Total: X categorías
```

### Paso 4: Verificar en la API

Consulta el endpoint:

```bash
curl -X GET https://api.sistema.mfcomputers.com.ar/api/categories \
  -H "X-API-Key: tu_api_key"
```

Deberías ver la nueva categoría "Prueba Sync" en la lista.

---

## 🔍 Prueba 4: Verificar Sincronización Completa

### Crear múltiples categorías en WooCommerce:

1. Categoría padre: "Accesorios" (parent: 0)
2. Categoría hija: "Cables" (parent: Accesorios)
3. Categoría hija: "Adaptadores" (parent: Accesorios)

### Después de crear cada una:

1. Verifica en la base de datos que todas se hayan sincronizado
2. Verifica que las relaciones padre-hijo estén correctas:

```sql
SELECT 
  c1.name as categoria,
  c1.woocommerce_id,
  c2.name as categoria_padre,
  c2.woocommerce_id as padre_id
FROM categories c1
LEFT JOIN categories c2 ON c1.parent_id = c2.id
WHERE c1.woocommerce_id IS NOT NULL
ORDER BY c1.woocommerce_id;
```

---

## 🐛 Solución de Problemas

### Error: "Autenticación requerida"

**Causa**: El secret no coincide o no se está enviando.

**Solución**:
1. Verifica que `WEBHOOK_SECRET` en Vercel/`.env` sea igual al secret en el snippet de WordPress
2. Verifica que el header `X-Webhook-Secret` se esté enviando correctamente

### Error: "Formato inválido. Se espera un array de categorías"

**Causa**: El payload no tiene el formato correcto.

**Solución**: Verifica que el snippet envíe:
```json
{
  "categories": [...]
}
```

### Las categorías no se sincronizan

**Causa**: Puede ser un problema de conexión o el endpoint no está accesible.

**Solución**:
1. Verifica que la URL de la API sea correcta y accesible desde WordPress
2. Revisa los logs de WordPress (`wp-content/debug.log`)
3. Revisa los logs de la API (Vercel logs o servidor)

### Error: "Ya existe una categoría con ese nombre"

**Causa**: Hay una categoría con el mismo nombre pero sin `woocommerce_id`.

**Solución**: El código debería manejarlo automáticamente actualizando la categoría existente. Si persiste, verifica los logs.

---

## 📊 Verificación Final

Después de todas las pruebas, verifica:

- [ ] Las categorías se crean correctamente en la BD
- [ ] Los `woocommerce_id` se guardan correctamente
- [ ] Las relaciones padre-hijo funcionan
- [ ] Al editar una categoría en WooCommerce, se actualiza en la BD
- [ ] Al crear una nueva categoría, todas las categorías se sincronizan

---

## 🎯 Comandos Útiles

### Ver todas las categorías sincronizadas:

```sql
SELECT * FROM categories WHERE woocommerce_id IS NOT NULL ORDER BY woocommerce_id;
```

### Contar categorías sincronizadas:

```sql
SELECT COUNT(*) as total_sincronizadas FROM categories WHERE woocommerce_id IS NOT NULL;
```

### Ver categorías sin woocommerce_id:

```sql
SELECT * FROM categories WHERE woocommerce_id IS NULL;
```

### Limpiar categorías de prueba (si es necesario):

```sql
DELETE FROM categories WHERE woocommerce_id IN (1, 2, 3); -- Ajusta los IDs según necesites
```

---

## ✅ Listo para Producción

Una vez que todas las pruebas pasen:

1. ✅ Desactiva `WP_DEBUG` en producción
2. ✅ Verifica que `WEBHOOK_SECRET` esté configurado en Vercel
3. ✅ Verifica que el snippet esté activo en WordPress
4. ✅ Monitorea los logs durante los primeros días

¡La sincronización debería funcionar automáticamente! 🎉
