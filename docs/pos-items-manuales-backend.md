# Ítems manuales en Punto de venta — Especificación para MF API (backend)

**Audiencia:** equipo backend / MF API  
**Estado frontend:** implementado en `mfcomputers-nextjs` (envía líneas con `description` sin `product_id`)  
**Migración BD:** `docs/migrations/2026-05-20_add_manual_items_to_sale_items.sql`

---

## Contrato `POST /api/sales`

Cada elemento de `items` debe ser **exactamente uno** de:

**Catálogo:** `{ "product_id": 42, "quantity": 2, "unit_price": 15000 }`  
**Manual:** `{ "description": "Instalación puntual", "quantity": 1, "unit_price": 8500 }`

Validación: XOR (`product_id` presente) ⊕ (`description` no vacío). Sin crear filas en `products`.

| Regla | Catálogo | Manual |
|--------|----------|--------|
| Stock ERP | Sí | No |
| WooCommerce | Si aplica | No |
| `product_id` en GET | entero | `null` |
| Nombre visible | `product_name` | `product_name` y/o `description` |

## Facturación `POST /api/sales/:id/facturar`

Payload al facturador incluye `detalle[]` por línea: manual usa `codigo: "0"` y `descripcion` de la línea.

## Prueba curl

```bash
curl -X POST "http://localhost:8086/api/sales" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d "{\"items\":[{\"description\":\"Servicio puntual POS\",\"quantity\":1,\"unit_price\":5000}],\"payment_method\":\"efectivo\"}"
```

Respuesta esperada: `201` con `data.items[0].product_id: null` y texto en `product_name` / `description`.
