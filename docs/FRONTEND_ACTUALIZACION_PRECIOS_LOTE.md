# Actualización de precios por lote – Guía para el frontend

Guía para integrar en el ERP las dos modalidades de ajuste masivo de precios: **por porcentaje según categorías** y **por variación del dólar (Argentina, ARS)**.

---

## Requisitos previos

1. **Migración SQL** (una sola vez en el servidor de BD):

   Ejecutar `docs/migrations/2026-06-02_add_products_pricing_config.sql`.

2. **Autenticación:** JWT Bearer en todas las peticiones.

3. **Rol:** solo usuarios con rol `gerencia` pueden usar estos endpoints.

4. **Variable opcional en el servidor** (`.env` de la API):

   | Variable | Valores | Default |
   |----------|---------|---------|
   | `USD_ARS_DOLLAR_TYPE` | `oficial`, `blue`, `bolsa`, `contadoconliqui`, `mayorista`, `tarjeta`, `cripto` | `oficial` |

   Define qué cotización USD→ARS muestra la API (siempre moneda **ARS**, país **Argentina**).

---

## Resumen de endpoints

| Acción | Método | URL |
|--------|--------|-----|
| Listar categorías con conteo de productos | GET | `/api/products/pricing/categories` |
| Cotización dólar + variación vs última aplicación | GET | `/api/products/pricing/dollar-rate` |
| Vista previa ajuste por % y categorías | POST | `/api/products/pricing/category-adjustment/preview` |
| Aplicar ajuste por % y categorías | POST | `/api/products/pricing/category-adjustment` |
| Vista previa ajuste por dólar | POST | `/api/products/pricing/dollar-adjustment/preview` |
| Aplicar ajuste por dólar (acción manual) | POST | `/api/products/pricing/dollar-adjustment` |

Base URL: la misma que el resto del ERP (`NEXT_PUBLIC_API_URL` o equivalente).

---

## Flujo 1: Actualización por porcentaje y categoría

### Objetivo de negocio

El usuario elige un **porcentaje** (positivo = aumento, negativo = descuento) y una o más **categorías**. Puede marcar “seleccionar todas” y destildar las que no quiera. Opcionalmente puede incluir productos **sin categoría**.

### Paso 1 – Cargar categorías

```http
GET /api/products/pricing/categories
Authorization: Bearer <token>
```

**Respuesta `data.categories`:**

```json
[
  { "category_id": 1, "category_name": "Notebooks", "product_count": 42, "is_active": true },
  { "category_id": null, "category_name": "Sin categoría", "product_count": 3, "is_active": true }
]
```

**UI recomendada:**

- Checkbox por fila + “Seleccionar todas”.
- Mostrar `product_count` junto al nombre.
- Fila `category_id: null` → enviar `include_uncategorized: true` si está tildada (no va en `category_ids`).

### Paso 2 – Vista previa (opcional pero recomendado)

```http
POST /api/products/pricing/category-adjustment/preview
Content-Type: application/json
Authorization: Bearer <token>

{
  "category_ids": [1, 3, 5],
  "include_uncategorized": false,
  "percentage": 15,
  "preview_limit": 10
}
```

**Respuesta relevante:**

```json
{
  "success": true,
  "data": {
    "percentage": 15,
    "category_ids": [1, 3, 5],
    "include_uncategorized": false,
    "products_affected": 120,
    "multiplier": 1.15,
    "sample": [
      {
        "id": 10,
        "code": "NB-001",
        "name": "Notebook X",
        "category_id": 1,
        "category_name": "Notebooks",
        "current_price": 100000,
        "new_price": 115000
      }
    ]
  }
}
```

Mostrar: cantidad total afectada, tabla con muestra `current_price` → `new_price`, y el % ingresado.

### Paso 3 – Confirmar y aplicar

```http
POST /api/products/pricing/category-adjustment
```

Mismo body que la preview, más flags opcionales:

```json
{
  "category_ids": [1, 3, 5],
  "include_uncategorized": false,
  "percentage": 15,
  "sync_to_woocommerce": true
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `category_ids` | `number[]` | IDs de categorías seleccionadas (sin incluir `null`) |
| `include_uncategorized` | `boolean` | Si `true`, también actualiza productos sin `category_id` |
| `percentage` | `number` | Ej: `10` = +10%, `-5` = -5% |
| `active_only` | `boolean` | Default `true`: solo productos activos |
| `sync_to_woocommerce` | `boolean` | Si `true` y WooCommerce está configurado, actualiza `regular_price` en WC |
| `dry_run` | `boolean` | Si `true`, no persiste (equivale a preview vía endpoint apply) |

**Respuesta exitosa:**

```json
{
  "success": true,
  "message": "Precios actualizados en 120 producto(s) (+15%)",
  "data": {
    "products_updated": 120,
    "percentage": 15,
    "category_ids": [1, 3, 5],
    "woocommerce_sync": { "synced": 80, "failed": 0 }
  }
}
```

### Validaciones en frontend

- Al menos una categoría en `category_ids` **o** `include_uncategorized: true`.
- Confirmación modal antes de aplicar (“Se actualizarán N productos con +X%”).
- Deshabilitar botón Aplicar si `products_affected === 0` en la preview.

### Ejemplo TypeScript

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL!;

export async function getPricingCategories(token: string) {
  const res = await fetch(`${API_BASE}/api/products/pricing/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || json.error);
  return json.data.categories as Array<{
    category_id: number | null;
    category_name: string;
    product_count: number;
  }>;
}

export async function applyCategoryPriceAdjustment(
  token: string,
  body: {
    category_ids: number[];
    include_uncategorized?: boolean;
    percentage: number;
    sync_to_woocommerce?: boolean;
  }
) {
  const res = await fetch(`${API_BASE}/api/products/pricing/category-adjustment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || json.error);
  return json.data;
}
```

---

## Flujo 2: Ajuste por variación del dólar (manual)

> **Importante:** No es automático. El frontend debe mostrar la cotización y el incremento estimado; el usuario confirma con un botón que llama a `POST .../dollar-adjustment`.

### Paso 1 – Pantalla informativa (al abrir el modal o sección)

```http
GET /api/products/pricing/dollar-rate
Authorization: Bearer <token>
```

**Respuesta `data` (campos clave para la UI):**

```json
{
  "quote": {
    "currency": "ARS",
    "country": "AR",
    "dollar_type": "oficial",
    "dollar_label": "Dólar oficial",
    "buy": 1180,
    "sell": 1220,
    "rate": 1220,
    "source": "dolarapi.com",
    "fetched_at": "2026-06-02T12:00:00.000Z"
  },
  "reference_rate": 1100,
  "current_rate": 1220,
  "variation_percent": 10.91,
  "increment_percent": 10.91,
  "price_multiplier": 1.1091,
  "products_affected_estimate": 450,
  "is_first_adjustment": false,
  "sample_preview": [
    {
      "id": 1,
      "code": "PROD-1",
      "name": "Ejemplo",
      "current_price": 10000,
      "new_price": 11091
    }
  ]
}
```

**Qué mostrar al usuario:**

| Dato | Origen |
|------|--------|
| Tipo de dólar | `quote.dollar_label` |
| Cotización actual (venta) | `current_rate` o `quote.sell` (en ARS) |
| Última cotización usada | `reference_rate` (null si primera vez) |
| Incremento / variación % | `increment_percent` o `variation_percent` |
| Productos estimados | `products_affected_estimate` |
| Muestra de precios | `sample_preview` |

**Primera vez (`is_first_adjustment: true`):**

- `reference_rate` es `null`, `variation_percent` es `0`.
- Texto sugerido: “La primera vez que confirmes solo se guardará la cotización de referencia; los precios no cambiarán.”
- El botón puede decir “Establecer referencia” en lugar de “Aplicar incremento”.

### Paso 2 – Vista previa ampliada (opcional)

```http
POST /api/products/pricing/dollar-adjustment/preview
Content-Type: application/json

{ "preview_limit": 15 }
```

Devuelve la misma información que el GET más una muestra más grande en `sample_preview`.

### Paso 3 – Aplicar (acción explícita del usuario)

```http
POST /api/products/pricing/dollar-adjustment
Content-Type: application/json

{
  "sync_to_woocommerce": false
}
```

**Comportamiento del backend:**

1. **Primera aplicación:** guarda `current_rate` como referencia; `products_updated: 0`.
2. **Sin variación** (cotización igual a la referencia): no modifica precios.
3. **Con variación:** `nuevo_precio = precio_actual × (cotización_actual / cotización_referencia)` en todos los productos activos; luego actualiza la referencia a la cotización actual.

**Respuesta típica con ajuste:**

```json
{
  "success": true,
  "message": "Precios ajustados por variación del dólar (+10.91%) en 450 producto(s)",
  "data": {
    "reference_rate": 1100,
    "current_rate": 1220,
    "variation_percent": 10.91,
    "increment_percent": 10.91,
    "products_updated": 450,
    "new_reference_rate": 1220
  }
}
```

Tras aplicar, volver a llamar `GET /api/products/pricing/dollar-rate` para refrescar (la variación debería quedar en ~0 hasta que el dólar vuelva a moverse).

### Ejemplo de componente (pseudológica React)

```tsx
function DollarPriceAdjustmentPanel({ token }: { token: string }) {
  const [info, setInfo] = useState<DollarRateData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/products/pricing/dollar-rate`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => j.success && setInfo(j.data));
  }, [token]);

  const handleApply = async () => {
    if (!info) return;
    const msg = info.is_first_adjustment
      ? '¿Guardar la cotización actual como referencia? Los precios no se modificarán.'
      : `¿Aplicar un incremento del ${info.increment_percent}% a ${info.products_affected_estimate} productos?`;
    if (!confirm(msg)) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/products/pricing/dollar-adjustment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sync_to_woocommerce: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      alert(json.message);
      // recargar cotización
    } finally {
      setLoading(false);
    }
  };

  if (!info) return <Spinner />;

  return (
    <div>
      <h3>Ajuste por dólar ({info.quote.dollar_label})</h3>
      <p>Cotización actual: <strong>${info.current_rate.toLocaleString('es-AR')} ARS</strong></p>
      {info.reference_rate != null && (
        <p>Última referencia: ${info.reference_rate.toLocaleString('es-AR')} ARS</p>
      )}
      <p>Incremento estimado: <strong>{info.increment_percent}%</strong></p>
      <p>Productos afectados: {info.products_affected_estimate}</p>
      <button onClick={handleApply} disabled={loading}>
        {info.is_first_adjustment ? 'Establecer referencia' : 'Aplicar ajuste por dólar'}
      </button>
    </div>
  );
}
```

---

## Ubicación sugerida en la UI

Crear una sección **“Actualización de precios”** (o ítem en menú Gerencia → Productos):

1. **Pestaña / card “Por categoría”** – checkboxes + input % + preview + aplicar.
2. **Pestaña / card “Por dólar”** – panel informativo + botón de confirmación manual.

Ambas deben mostrar resultado (toast) con `products_updated` y errores de `woocommerce_sync.failed` si aplica.

---

## Manejo de errores

| HTTP | Causa típica | Acción UI |
|------|----------------|-----------|
| 400 | Sin categorías seleccionadas, % inválido | Mostrar mensaje del `error` |
| 401/403 | Token o rol | Redirigir login o “Sin permisos” |
| 503 | API de cotización caída | “No se pudo obtener el dólar; reintentar” |
| 500 | BD sin migración `products_config` | Avisar al administrador |

---

## Sincronización WooCommerce

- Flag `sync_to_woocommerce: true` en los POST de aplicación.
- Solo actualiza productos con `woocommerce_id` en el ERP.
- Procesamiento en lotes de 5; puede tardar con muchos SKU.
- Mostrar progreso o mensaje final: `woocommerce_sync.synced` / `failed`.

---

## Checklist de integración frontend

- [ ] Ejecutada migración `products_config` en BD
- [ ] Pantalla accesible solo para rol `gerencia`
- [ ] Listado de categorías con selección múltiple y “todas”
- [ ] Preview antes de aplicar % por categoría
- [ ] Modal de confirmación con conteo de productos
- [ ] Panel dólar: cotización ARS, referencia, % incremento
- [ ] Botón explícito para aplicar dólar (no en background ni cron)
- [ ] Mensaje especial primera vez (`is_first_adjustment`)
- [ ] Opción “Sincronizar con WooCommerce”
- [ ] Refrescar listado de productos tras aplicar

---

## Notas de negocio

- Los precios se redondean a **2 decimales** en BD.
- Solo productos **activos** por defecto (`active_only: true`).
- La referencia del dólar se actualiza **después** de cada aplicación exitosa con variación; el próximo ajuste compara contra esa nueva base.
- La API **no** programa jobs automáticos de dólar: todo disparo es desde el frontend.
