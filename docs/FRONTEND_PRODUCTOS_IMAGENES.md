# Frontend: Productos e imágenes — qué enviar y cómo verificar

Indicaciones para que el frontend envíe y verifique correctamente los datos de imágenes en **PUT /api/products/:id** y en el flujo de Sync WooCommerce.

---

## 1. Comportamiento de la API (resumen)

- **`images`** se interpreta como **lista final** (reemplazo), no como “agregar a las existentes”.
- Si el usuario **borra todas** las imágenes y **agrega una** (por URL o archivo), el front debe enviar **solo esa imagen** en `images`.
- La API limpia `woocommerce_image_ids` cuando se actualiza `images`, para que el próximo Sync WooCommerce use las URLs y actualice la galería en WooCommerce.
- **Sync WooCommerce:** se envían **tanto** los IDs de medios (archivos subidos) **como** las URLs (externas, ej. cdn.smart-gsm.com). Si cargas archivo y URL a la vez, ambos se reflejan en WooCommerce. Si solo quieres la URL, envía en `images` solo esa URL (la API limpiará los IDs y en el sync solo irá la URL).

---

## 2. Endpoint: PUT /api/products/:id

**Content-Type:** `application/json`

### Campo `images`

| Lo que quiere el usuario | Qué debe enviar el frontend |
|--------------------------|-----------------------------|
| No cambiar las imágenes | **No incluir** `images` en el body (o enviar solo los demás campos que sí cambian). |
| Borrar todas las imágenes | `"images": null` o `"images": []` |
| Dejar solo una (o N) imágenes | `"images": ["https://...", ...]` — array con **exactamente** las URLs que deben quedar. |
| Agregar una sin borrar las demás | `"images": [url1, url2, ..., urlNueva]` — array con **todas** las URLs (existentes + nueva). |

- Cada elemento del array debe ser un **string** (URL).
- No enviar `woocommerce_image_ids` al guardar desde el modal de imágenes; la API lo gestiona internamente.

### Ejemplo de body (solo imágenes)

```json
{
  "images": ["https://ejemplo.com/imagen1.jpg", "https://ejemplo.com/imagen2.jpg"]
}
```

Para “borrar todas y dejar una”:

```json
{
  "images": ["https://ejemplo.com/nueva-imagen.jpg"]
}
```

---

## 3. Checklist para el frontend

### Modal “Imágenes” / “Guardar cambios”

- [ ] **Estado en el modal:**  
  El estado local del modal debe reflejar la **lista final** que el usuario quiere (después de borrar/agregar/reordenar). No enviar “solo las nuevas” ni “solo las borradas”.

- [ ] **Al guardar:**  
  Se envía **PUT /api/products/:id** con `images` = array de strings (URLs) con **esa lista final**.
  - Si el usuario borró todas y agregó 1 URL → `images: [esaUrl]`.
  - Si el usuario tenía 3 y agregó 1 → `images: [url1, url2, url3, urlNueva]`.
  - Si el usuario borró todas y no agregó nada → `images: []` o `images: null`.

- [ ] **No mezclar con otros campos:**  
  Si solo se cambian imágenes, se puede enviar solo `images` (y opcionalmente los campos que el formulario toque). No es necesario reenviar todo el producto si no cambió.

- [ ] **Tras guardar:**  
  Recargar el producto (**GET /api/products/:id**) y actualizar la UI (galería, thumbnails) con `data.images` de la respuesta, para que lo que se ve coincida con lo guardado.

### Sync WooCommerce

- [ ] El botón “Sync WooCommerce” llama a **POST /api/products/:id/sync-to-woocommerce** (sin body de imágenes).
- [ ] Después del sync, opcionalmente volver a hacer **GET /api/products/:id** para refrescar datos si el backend devolviera algo actualizado.

### Subida por archivo

- [ ] Si las imágenes se suben primero a un servidor/WooCommerce y se obtiene una URL, esa URL es la que debe ir en el array `images` que se envía en el PUT.
- [ ] Al guardar el producto, enviar en `images` la **lista final** de URLs (las que ya tenía el producto + las nuevas URLs obtenidas tras subir).

---

## 4. Cómo verificar que todo se envía bien

### En el navegador (DevTools)

1. **Network:**  
   Al hacer “Guardar cambios” en el modal de imágenes, localizar la petición **PUT** a `/api/products/:id`.

2. **Payload (Request payload / Request body):**  
   - Debe haber un campo `images`.
   - Debe ser un **array** de strings.
   - El array debe tener **exactamente** las URLs que quieres que queden en el producto (lista final).
   - Si borraste todas y agregaste una, debe verse algo como:  
     `images: ["https://..."]` (un solo elemento).

3. **Response:**  
   - Status 200 y en `data.images` el mismo array (o el normalizado por la API). Comparar con lo enviado.

### Casos de prueba sugeridos

| Caso | Acción en el modal | Body esperado (ejemplo) | Resultado esperado |
|------|--------------------|-------------------------|--------------------|
| 1 | Borrar todas las imágenes, agregar 1 por URL, Guardar | `{"images": ["https://..."]}` | Producto con 1 imagen; Sync WC actualiza galería. |
| 2 | Tener 2 imágenes, agregar 1 por URL, Guardar | `{"images": ["url1", "url2", "urlNueva"]}` | Producto con 3 imágenes. |
| 3 | Borrar todas, no agregar ninguna, Guardar | `{"images": []}` o `{"images": null}` | Producto con 0 imágenes. |
| 4 | Solo abrir modal y Guardar sin tocar imágenes | No enviar `images` o enviar el array actual sin cambios | Imágenes no cambian. |

### Logs en la API

Con los logs con colores de la API podés verificar del lado servidor:

- **IMAGES:** mensajes al actualizar galería (reemplazo, limpieza, “Antes/Después”).
- **SYNC:** mensajes al hacer Sync WooCommerce (si se envían imágenes por URL o por ID, cantidad).

Si lo que envía el front no coincide con lo esperado, esos logs ayudan a ver qué recibió la API.

---

## 5. Resumen rápido

- **`images` = lista final de URLs** (reemplazo).
- **Guardar cambios:** enviar en `images` exactamente las URLs que deben quedar.
- **Después de guardar:** GET del producto y actualizar la UI con `data.images`.
- **Sync WooCommerce:** POST a sync-to-woocommerce; la API usa las `images` guardadas (y limpia `woocommerce_image_ids` al actualizar imágenes).

Si algo no coincide (por ejemplo, reaparecen imágenes borradas o el Sync no actualiza), revisar que el body del PUT tenga el array `images` correcto en la pestaña Network.

---

## 6. Problema: "Solo veo el archivo" o "Al editar con URL no se refleja en WooCommerce"

- **Causa:** Si el producto tenía una imagen por archivo (subida) y luego añades o cambias a una imagen por URL, el frontend debe enviar en **PUT /api/products/:id** el campo **`images`** con la **lista final** de URLs que quieres que tenga el producto (incluyendo la URL nueva). Si no envías `images`, la API no actualiza la galería y el próximo Sync seguirá usando solo los IDs del archivo.
- **Solución:** Al guardar desde el modal de imágenes (ya sea tras añadir una URL, borrar una, o combinar archivo + URL), enviar siempre **`images`** como array de strings con **todas** las URLs que deben quedar. Para "solo la URL externa", enviar `images: ["https://cdn.smart-gsm.com/..."]`. Para "archivo + URL", enviar `images: [urlDelArchivoSubido, "https://..."]` (la URL del archivo es la `source_url` que devuelve POST /api/woocommerce/media).
