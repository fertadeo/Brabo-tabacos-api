# Frontend: Borrado de productos y sincronización con WooCommerce

Indicaciones para que el frontend use correctamente el borrado de productos y entienda cómo se refleja en WooCommerce.

---

## 1. Comportamiento de la API (resumen)

- **DELETE /api/products/:id** (soft delete): Desactiva el producto en el ERP (`is_active = 0`) y **envía el producto a la papelera de WooCommerce** si el producto está vinculado (`woocommerce_id`). En la tienda el producto deja de estar visible y pasa a la papelera; no se borra definitivamente en WC.
- **DELETE /api/products/:id/permanent**: Borra el producto **definitivamente** en el ERP y en WooCommerce (si estaba vinculado). En WC se hace un borrado permanente (no solo papelera).

No hace falta llamar a ningún endpoint extra de sync al borrar: la API ya sincroniza con WooCommerce en el mismo DELETE.

---

## 2. Endpoints

| Acción en la UI | Método | Endpoint | Efecto en ERP | Efecto en WooCommerce |
|-----------------|--------|----------|----------------|------------------------|
| “Eliminar” / “Borrar” producto | DELETE | `/api/products/:id` | Producto desactivado (no se lista con `active_only=true`) | Producto movido a la **papelera** (recuperable en WC) |
| “Eliminar permanentemente” | DELETE | `/api/products/:id/permanent` | Producto borrado de la base de datos | Producto **borrado definitivamente** en WC (si estaba vinculado) |

---

## 3. Indicaciones para el frontend

### Botón “Eliminar” / “Borrar” producto

1. Llamar **DELETE /api/products/:id** (sin body).
2. No es necesario llamar a sync-to-woocommerce ni a ningún otro endpoint después del borrado.
3. Tras un 200:
   - Quitar el producto de la lista en la UI (o refrescar la lista).
   - Opcional: mostrar un mensaje del tipo “Producto eliminado. En WooCommerce se ha enviado a la papelera si estaba vinculado.” (la API devuelve un mensaje similar en `message`).

### Botón “Eliminar permanentemente”

1. Usar solo cuando la acción sea explícitamente “borrado permanente” (por ejemplo, desde papelera o con confirmación fuerte).
2. Llamar **DELETE /api/products/:id/permanent**.
3. Tras un 200, quitar el producto de la UI y, si aplica, indicar que se ha borrado también en WooCommerce.

### Listados de productos

- Por defecto la API suele filtrar por `active_only=true`, así que los productos “borrados” (soft delete) no aparecen en el listado normal. Si en la UI se muestra una “papelera” o “productos eliminados”, usar el parámetro que incluya inactivos (por ejemplo `active_only=false` o `all=true` según la API de listado).

### Recuperar producto en el ERP

- Si el producto solo se ha hecho soft delete (`is_active = 0`), se puede “reactivar” con **PUT /api/products/:id** enviando `is_active: true`. La API no recupera automáticamente el producto de la papelera de WooCommerce; si se quiere que vuelva a estar publicado en la tienda, después de reactivar se puede llamar a **POST /api/products/:id/sync-to-woocommerce** (el producto en WC puede restaurarse antes desde la papelera de WordPress/WooCommerce, o el sync puede volver a publicarlo según la lógica del backend).

---

## 4. Respuestas de la API (ejemplo)

### DELETE /api/products/:id (200)

```json
{
  "success": true,
  "message": "Producto \"Nombre del producto\" eliminado correctamente. En WooCommerce se ha enviado a la papelera si estaba vinculado.",
  "data": { "id": 123, "name": "Nombre del producto" },
  "timestamp": "2025-02-08T..."
}
```

### DELETE /api/products/:id/permanent (200)

```json
{
  "success": true,
  "message": "Producto \"Nombre del producto\" eliminado permanentemente (ERP y WooCommerce si estaba vinculado).",
  "data": { "id": 123, "name": "Nombre del producto" },
  "timestamp": "2025-02-08T..."
}
```

### Producto no encontrado (404)

Si el `id` no existe, la API responde con 404 y `message: "Product not found"`.

---

## 5. Resumen rápido

- **Eliminar (soft delete):** DELETE `/api/products/:id` → ERP: desactivado; WooCommerce: a la papelera.
- **Eliminar permanentemente:** DELETE `/api/products/:id/permanent` → ERP: borrado; WooCommerce: borrado definitivo.
- No hace falta llamar a sync después de borrar; la API ya actualiza WooCommerce en el mismo DELETE.
