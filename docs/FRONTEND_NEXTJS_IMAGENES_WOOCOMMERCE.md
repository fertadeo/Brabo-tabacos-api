# Imágenes de productos y WooCommerce desde Next.js

Guía para subir imágenes desde el frontend (Next.js) a la galería de WordPress/WooCommerce y asociarlas al producto en el ERP.

## 1. Variables de entorno (API ERP)

En el servidor de la API, además de las de WooCommerce, configurá:

```env
# WooCommerce (ya existentes)
WOOCOMMERCE_URL=https://tutienda.com
WOOCOMMERCE_CONSUMER_KEY=ck_xxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxx

# WordPress Media (nuevas, para subir archivos a la galería)
WP_APPLICATION_USER=tu_usuario_wordpress
WP_APPLICATION_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

**Application Password:** En WordPress: Usuarios → Tu perfil → “Contraseñas de aplicación”. Crear una nueva; usá ese valor en `WP_APPLICATION_PASSWORD`.

## 2. Migración de base de datos

Ejecutá la migración para agregar la columna de IDs de medios:

```bash
mysql -u usuario -p nombre_bd < docs/migrations/2026-02-01_add_woocommerce_image_ids_to_products.sql
```

(O ejecutá el contenido del archivo desde tu cliente MySQL.)

## 3. Flujo en el frontend (Next.js)

### Paso A: Subir imagen(es) a la galería de WordPress

**Endpoint:** `POST /api/woocommerce/media`  
**Auth:** Header `X-API-Key: <tu API key>`  
**Body:** `multipart/form-data` con campo **`files`** (array de archivos).  
**Límite:** 10 archivos por request, 10 MB por archivo. Formatos: jpeg, png, gif, webp.

**Ejemplo con `fetch` (App Router o Client Component):**

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8086';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

async function uploadImagesToWordPress(files: File[]): Promise<{ id: number; source_url: string }[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const res = await fetch(`${API_BASE}/api/woocommerce/media`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY!,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Error subiendo imágenes');
  }

  const data = await res.json();
  return data.data.uploads; // [{ id, source_url }, ...]
}
```

**Ejemplo con un solo input file (varios archivos):**

```tsx
'use client';

import { useState } from 'react';

export function ProductImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<{ id: number; source_url: string }[]>([]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/woocommerce/media`, {
        method: 'POST',
        headers: { 'X-API-Key': process.env.NEXT_PUBLIC_API_KEY! },
        body: formData,
      });

      if (!res.ok) throw new Error('Error subiendo imágenes');
      const data = await res.json();
      setUploads(data.data.uploads);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && <p>Subiendo...</p>}
      {uploads.length > 0 && (
        <ul>
          {uploads.map((u) => (
            <li key={u.id}>
              ID: {u.id} – <a href={u.source_url} target="_blank" rel="noreferrer">Ver</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Paso B: Crear o actualizar el producto en el ERP con esas imágenes

Usá los `id` y `source_url` devueltos por `/api/woocommerce/media`:

- **`images`:** array de URLs para mostrar en el ERP (por ejemplo `source_url`).
- **`woocommerce_image_ids`:** array de IDs de medios para que, al sincronizar a WooCommerce, se usen por ID y no se dupliquen.

**Crear producto (POST /api/products):**

```ts
// Después de uploadImagesToWordPress(files) → uploads
const uploads = await uploadImagesToWordPress(selectedFiles);

await fetch(`${API_BASE}/api/products`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`, // JWT de tu auth
  },
  body: JSON.stringify({
    code: 'PROD-001',
    name: 'Mi producto',
    price: 99.99,
    stock: 10,
    images: uploads.map((u) => u.source_url),
    woocommerce_image_ids: uploads.map((u) => u.id),
    sync_to_woocommerce: true, // opcional: sincronizar a WooCommerce al crear
  }),
});
```

**Actualizar producto (PUT /api/products/:id):**

```ts
await fetch(`${API_BASE}/api/products/${productId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    images: uploads.map((u) => u.source_url),
    woocommerce_image_ids: uploads.map((u) => u.id),
    sync_to_woocommerce: true, // opcional
  }),
});
```

### Paso C: Sincronizar producto a WooCommerce (si no usaste `sync_to_woocommerce`)

**Endpoint:** `POST /api/products/:id/sync-to-woocommerce`  
**Auth:** JWT (mismo que productos).

Si el producto tiene `woocommerce_image_ids`, la API enviará esas imágenes a WooCommerce por ID (sin duplicar en la galería). Si no, usará las URLs de `images` y WooCommerce las descargará.

## 4. Resumen del flujo en Next.js

1. Usuario selecciona una o más imágenes (input `type="file"` multiple).
2. Frontend llama a `POST /api/woocommerce/media` con `files` en `FormData` y `X-API-Key`.
3. API sube cada archivo a WordPress `/wp/v2/media` y devuelve `[{ id, source_url }, ...]`.
4. Frontend crea/actualiza el producto con:
   - `images`: `uploads.map(u => u.source_url)`
   - `woocommerce_image_ids`: `uploads.map(u => u.id)`
5. Opcional: enviar `sync_to_woocommerce: true` en create/update, o llamar después a `POST /api/products/:id/sync-to-woocommerce`.

## 5. Errores frecuentes

- **“WordPress Media no está configurado”:** Faltan `WP_APPLICATION_USER` o `WP_APPLICATION_PASSWORD` en el `.env` de la API.
- **“No tienes permisos con este usuario para crear entradas” (500):** El usuario de WordPress usado en `WP_APPLICATION_USER` no tiene permiso para subir a la galería. Debe tener rol **Administrador** o **Editor** (capacidad "Subir archivos"). Revisar en WordPress → Usuarios el rol de ese usuario.
- **401 en /api/woocommerce/media:** Revisar que el header `X-API-Key` sea el correcto.
- **Solo se permiten imágenes (jpeg, png, gif, webp):** El archivo no es una imagen o tiene otra extensión; usar `accept` en el input y validar en el cliente.
- **Producto en WooCommerce sin imagen:** Verificar que el producto en el ERP tenga `woocommerce_image_ids` (o `images` con URLs públicas) y que hayas llamado a sync.
