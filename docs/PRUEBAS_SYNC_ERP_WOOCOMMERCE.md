# Pruebas de sincronización ERP ↔ WooCommerce

Guía para probar el sync de productos entre el ERP (API Node) y la tienda WooCommerce. Los cambios de la API están alineados con el snippet `docs/WORDPRESS_CRUD_PRODUCTS.php` (misma API REST wc/v3 y payload compatible).

## 1. Variables de entorno (API ERP)

En el servidor donde corre la API, configurá:

```env
WOOCOMMERCE_URL=https://mfcomputers.com.ar
WOOCOMMERCE_CONSUMER_KEY=ck_xxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxx
WOOCOMMERCE_API_VERSION=wc/v3
```

Las mismas credenciales que usás en el snippet PHP (`WC_BASE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET`) corresponden a `WOOCOMMERCE_URL`, `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET`.

## 2. Alineación con WORDPRESS_CRUD_PRODUCTS.php

| Aspecto | Snippet PHP | API ERP |
|--------|-------------|---------|
| API WooCommerce | wc/v3 (GET/POST/PUT/DELETE /products) | wc/v3, mismo prefijo |
| Crear producto | `wc_create_product($data)` → POST /products | `WooCommerceService.createProduct()` → POST /products |
| Editar producto | `wc_update_product($id, $data)` → PUT /products/{id} | `WooCommerceService.updateProduct(id, data)` → PUT /products/{id} |
| Campos payload | name, type, sku, regular_price, description, manage_stock, stock_quantity, status | Los mismos + short_description, images, categories, meta_data |
| Auth | consumer_key / consumer_secret (query o Basic) | Basic Auth (URL user/pass) |

Ambos hablan con la misma tienda WooCommerce; podés probar desde la API ERP o desde el snippet PHP contra la misma URL y credenciales.

## 3. Pruebas recomendadas (ERP → WooCommerce)

### 3.1 Sincronizar un producto existente (crear en WC)

1. Tener un producto en el ERP **sin** `woocommerce_id` (nunca sincronizado).
2. Llamar a la API (con JWT de rol gerencia):

   ```http
   POST /api/products/:id/sync-to-woocommerce
   Authorization: Bearer <token>
   ```

   Reemplazá `:id` por el ID del producto en el ERP.

3. Respuesta esperada: `{ "success": true, "data": { "woocommerce_id": 12345, "created": true } }`.
4. En WooCommerce: ver el producto recién creado (SKU = código del producto en ERP). En el ERP el producto debe quedar con `woocommerce_id` guardado.

### 3.2 Sincronizar un producto ya vinculado (actualizar en WC)

1. Producto en el ERP **con** `woocommerce_id` ya asignado.
2. Cambiar nombre, precio o stock en el ERP (PUT /api/products/:id).
3. Llamar de nuevo:

   ```http
   POST /api/products/:id/sync-to-woocommerce
   ```

4. Respuesta: `{ "created": false, "woocommerce_id": ... }`. En WooCommerce el producto debe reflejar los cambios.

### 3.3 Crear producto y sincronizar en un solo paso

```http
POST /api/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "TEST-SYNC-001",
  "name": "Producto prueba sync",
  "price": 1500,
  "stock": 5,
  "sync_to_woocommerce": true
}
```

Comprobar que el producto existe en el ERP y en WooCommerce, y que el ERP tiene `woocommerce_id` asignado.

### 3.4 Actualizar producto y sincronizar a WC

```http
PUT /api/products/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "price": 2000,
  "stock": 10,
  "sync_to_woocommerce": true
}
```

Solo tiene efecto si el producto ya tiene `woocommerce_id`; si no, actualizar en el ERP no dispara sync (evita crear duplicados).

## 3.5 Probar que las imágenes se carguen correctamente (dos procesos)

Las imágenes se manejan en **dos pasos**: (1) subir el archivo a la galería de WordPress, (2) crear o actualizar el producto con esas imágenes y sincronizar a WooCommerce.

### Proceso 1: Subir imagen(es) a la galería de WordPress

1. **Requisito:** Variables `WP_APPLICATION_USER` y `WP_APPLICATION_PASSWORD` en `.env` de la API. El usuario de WordPress debe tener **rol Administrador o Editor** (necesita la capacidad "Subir archivos" / `upload_files`). Si aparece "no tienes permisos con este usuario para crear entradas", revisa el rol en WordPress → Usuarios.
2. Enviar una petición **multipart/form-data** al endpoint de media:

   ```http
   POST /api/woocommerce/media
   X-API-Key: <tu API key>
   Content-Type: multipart/form-data
   Body: campo "files" con uno o más archivos (jpeg, png, gif, webp; máx. 10 MB c/u)
   ```

3. **Resultado esperado:** `200` y body con `data.uploads`: array de `{ id, source_url }`.  
   Ejemplo: `{ "success": true, "data": { "uploads": [ { "id": 12345, "source_url": "https://tutienda.com/wp-content/uploads/..." } ] } }`.
4. **Comprobar:** En WordPress → Medios, debe aparecer la imagen recién subida.

### Proceso 2: Crear o actualizar producto con imágenes y sincronizar

1. Usar los `id` y `source_url` devueltos en el paso 1.
2. **Crear producto** (o actualizar uno existente) con imágenes y opcionalmente sync:

   ```http
   POST /api/products
   Authorization: Bearer <token>
   Content-Type: application/json

   {
     "code": "TEST-IMG-001",
     "name": "Producto con imagen",
     "price": 999,
     "stock": 5,
     "images": ["https://tutienda.com/wp-content/uploads/.../foto.jpg"],
     "woocommerce_image_ids": [12345],
     "sync_to_woocommerce": true
   }
   ```

   (Reemplazá `source_url` e `id` por los del paso 1.)

3. **Resultado esperado:** `201` y producto creado con `images` y `woocommerce_image_ids`. Si `sync_to_woocommerce: true`, el producto debe aparecer en WooCommerce **con la imagen**.
4. **Si el producto ya existe** (sin sync al crear): llamar después a `POST /api/products/:id/sync-to-woocommerce` con JWT. La API enviará las imágenes por ID (si hay `woocommerce_image_ids`) o por URL (si solo hay `images`); las URLs vacías se filtran y no generan error "No URL Provided".

### Comprobar en WooCommerce que la imagen se cargó

- En WooCommerce → Productos → abrir el producto por SKU (ej. `TEST-IMG-001`).
- En la pestaña de imagen del producto debe verse la imagen subida.
- En Medios de WordPress puede estar la misma imagen (si se usó el proceso 1).

### Nota sobre productos con imágenes vacías

Si el producto en el ERP tiene `images` con URLs vacías (`""`) o `woocommerce_image_ids` con valores inválidos (0, null), la API **filtra** esos valores antes de enviar a WooCommerce. El sync no falla con "No URL Provided"; el producto se crea/actualiza en WC sin esas entradas (o sin imágenes si no queda ninguna válida).

## 4. Comprobar en WooCommerce

- **SKU**: debe coincidir con el `code` del producto en el ERP.
- **Meta**: en el producto en WC podés ver `_mfcomputers_erp_id` y `_mfcomputers_erp_code` (ID y código del ERP).
- **Stock y precio**: deben coincidir con el ERP después de cada sync.

## 5. Si algo falla

- Revisar logs de la API (mensajes `[WooCommerceService]`).
- Verificar que la URL de la tienda sea la correcta (con/sin barra final no debería afectar; la API normaliza).
- Comprobar que las credenciales de WooCommerce tengan permiso de lectura/escritura sobre productos (REST API habilitada en WooCommerce).
- Para comparar comportamiento, podés usar el snippet PHP (ejemplos en la sección 7 del archivo) contra la misma tienda y credenciales.
