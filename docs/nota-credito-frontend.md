# Notas de crédito ARCA — Guía para el frontend

**Audiencia:** equipo `mfcomputers-nextjs`  
**Estado backend:** implementado en MF API (`POST /api/sales/:id/nota-credito`)  
**Prerequisito servidor:** migración `docs/migrations/2026-06-11_add_arca_nota_credito_fields_to_sales.sql` y `FACTURADOR_PUNTO_VENTA=5` (o el PV del cliente) en el entorno de la API.

---

## Mensaje corto para copiar al equipo frontend

**Asunto:** Notas de crédito — integrar `POST /api/sales/:id/nota-credito`

MF API ya expone emisión de nota de crédito por venta facturada. El frontend debe:

1. Llamar **solo** a MF API (nunca al facturador directo).
2. Habilitar el botón **«Emitir nota de crédito»** en el modal «¿Fue un error?».
3. Leer **PV y número** de la factura desde `GET /api/sales/:id` (`arca_punto_venta`, `arca_numero`, `arca_tipo`), no solo desde caché de sesión.
4. Tras éxito, mostrar `arca_nc_cae` y refrescar la fila de facturación.

Especificación completa: `docs/nota-credito-frontend.md` en **mfcomputers-API** (este archivo).

---

## Regla de arquitectura

Igual que la factura: el navegador **no** llama a `api-facturador.fenecstudio.com`. Toda NC pasa por:

```http
POST {MF_API}/api/sales/:id/nota-credito
Authorization: Bearer <jwt>
Content-Type: application/json
```

Opcional (mismo criterio que facturar): `x-facturador-api-key` si el deploy lo permite.

---

## Cuándo mostrar la acción «¿Fue un error?»

| Condición | Mostrar acción |
|-----------|----------------|
| `arca_status === 'success'` y hay `arca_cae` | Sí |
| `arca_nc_status === 'success'` | No (ya anulada por NC); mostrar badge «Anulada por NC» |
| `arca_status !== 'success'` | No (no hubo factura fiscal autorizada) |

No usar `POST /facturar` con `force: true` para «deshacer» una factura con CAE.

---

## Endpoint

### `POST /api/sales/:id/nota-credito`

**Body mínimo (caso «fue un error» — anulación total):**

```json
{
  "motivo": "error_emision",
  "confirmar": true
}
```

**Body recomendado (con PV de configuración local):**

```json
{
  "motivo": "error_emision",
  "confirmar": true,
  "observaciones": "Factura emitida por error operativo",
  "puntoVenta": 5
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `confirmar` | boolean | **Sí** | Debe ser `true` |
| `motivo` | string | No (default `error_emision`) | `error_emision` \| `devolucion` \| `descuento` \| `otro` |
| `observaciones` | string | No | Máx. 500 caracteres (auditoría) |
| `importe` | number \| null | No | Omitir o `null` = NC por **100 %** del comprobante original |
| `puntoVenta` | number | No | Si no se envía: `FACTURADOR_PUNTO_VENTA` del servidor (ej. **5**) |
| `cuitEmisor` | number | No | Solo si difiere del configurado en servidor |

### Respuesta exitosa (HTTP 200)

```json
{
  "success": true,
  "message": "Nota de crédito emitida correctamente en ARCA",
  "data": {
    "sale": {
      "id": 55,
      "arca_status": "success",
      "arca_cae": "86249294836837",
      "arca_tipo": 6,
      "arca_punto_venta": 5,
      "arca_numero": 12,
      "arca_nc_status": "success",
      "arca_nc_cae": "74996052728746",
      "arca_nc_tipo": 8,
      "arca_nc_punto_venta": 5,
      "arca_nc_numero": 3
    },
    "notaCredito": {
      "cae": "74996052728746",
      "vencimientoCae": "20260715",
      "vencimientoCaeIso": "2026-07-15",
      "tipo": 8,
      "puntoVenta": 5,
      "numero": 3,
      "facturaId": "uuid-nc",
      "cbtesAsoc": [{ "tipo": 6, "ptoVta": 5, "nro": 12 }],
      "idempotencyKey": "sale-55-nc-error_emision"
    }
  }
}
```

### Errores frecuentes

| HTTP | `data.code` | UX sugerida |
|------|-------------|-------------|
| 400 | `CONFIRMACION_REQUERIDA` | Pedir confirmación explícita en el modal |
| 400 | `VENTA_SIN_FACTURA` | Ocultar acción NC |
| 400 | `FACTURA_ORIGINAL_INCOMPLETA` | «Faltan PV o número AFIP»; sugerir refrescar venta o contactar soporte |
| 409 | `NOTA_CREDITO_YA_EMITIDA` | Mostrar CAE de la NC existente |
| 502/503 | `WSFE_NO_CAE`, `FACTURADOR_UNAVAILABLE` | Reintentar más tarde; no marcar como anulada |

Reutilizar el mismo manejo de errores que `facturarSale` (`extractFacturacionErrorFromPayload`, `formatFacturacionErrorForUi`).

---

## Campos en `Sale` (GET listado y detalle)

### Factura original (ya existían)

| Campo API | Uso en UI |
|-----------|-----------|
| `arca_status` | `success` = facturada |
| `arca_cae` | CAE factura |
| `arca_tipo` | 6 = Factura B, 11 = Factura C, 1 = Factura A |
| `arca_punto_venta` | PV AFIP (ej. **5**) |
| `arca_numero` | Número de comprobante |
| `arca_comprobante` | Snapshot `{ puntoVenta, tipo, numero, cae, qrUrl, ... }` |

### Nota de crédito (nuevos)

| Campo API | Uso en UI |
|-----------|-----------|
| `arca_nc_status` | `null` \| `pending` \| `success` \| `error` |
| `arca_nc_cae` | CAE de la NC |
| `arca_nc_cae_vto` | Vencimiento CAE NC |
| `arca_nc_tipo` | 8 = NC B, 13 = NC C, 3 = NC A |
| `arca_nc_punto_venta` | PV de la NC emitida |
| `arca_nc_numero` | Número NC |
| `arca_nc_factura_id` | UUID MultiCUIT (PDF / consulta) |
| `arca_nc_motivo` | Motivo enviado al emitir |
| `arca_nc_error_message` | Último error si `arca_nc_status === 'error'` |

Ampliar el tipo `Sale` en `lib/api.ts` con estos campos opcionales.

---

## Mapeo tipo factura → NC (solo preview; el backend lo aplica al emitir)

Ya existe en `lib/facturacion-comprobantes.ts` (`getNotaCreditoTipoForFactura`):

| Factura | Tipo WSFE | NC | Tipo WSFE |
|---------|-----------|-----|-----------|
| Factura A | 1 | NC A | 3 |
| Factura B | 6 | NC B | 8 |
| Factura C | 11 | NC C | 13 |

---

## Corrección importante: preview del modal «¿Fue un error?»

Hoy `creditNotePreview` en `app/facturacion/page.tsx` usa **solo** `getCachedFacturacionEmision(saleId)`. Eso hace que, tras recargar la página o facturar en otra sesión, `facturaRef` quede vacío aunque la API tenga los datos.

**Cambio requerido:** armar el preview con la misma prioridad que `fetchSaleArcaEmision`:

1. Caché de sesión (si existe).
2. Columnas de la venta: `arca_tipo`, `arca_punto_venta`, `arca_numero`.
3. `sale.arca_comprobante` si viene en el JSON.
4. Opcional: `await getSale(id)` al abrir el modal si faltan PV/número.

Ejemplo de referencia de comprobante:

```typescript
const tipoFactura =
  sale.arca_tipo ??
  cached?.emision.tipo ??
  sale.arca_comprobante?.tipo ??
  6

const puntoVenta =
  sale.arca_punto_venta ??
  cached?.emision.puntoVenta ??
  sale.arca_comprobante?.puntoVenta ??
  getStoredFacturacionPuntoVenta()

const numero =
  sale.arca_numero ??
  cached?.emision.numero ??
  sale.arca_comprobante?.numero ??
  null

const facturaRef =
  numero != null
    ? formatComprobanteAfipReferencia(tipoFactura, puntoVenta, numero)
    : null
```

Solo mostrar el alerta «Faltan datos del comprobante original» si, tras `getSale(id)`, siguen faltando `arca_numero` o `arca_punto_venta`.

---

## Cliente API sugerido (`lib/api.ts`)

Patrón paralelo a `facturarSale`:

```typescript
export type NotaCreditoMotivo = 'error_emision' | 'devolucion' | 'descuento' | 'otro'

export interface EmitirNotaCreditoRequest {
  motivo?: NotaCreditoMotivo
  observaciones?: string
  importe?: number | null
  confirmar: true
  puntoVenta?: number
  cuitEmisor?: number
}

export interface EmitirNotaCreditoResponse {
  success: boolean
  message?: string
  data?: {
    sale?: Sale
    notaCredito?: {
      cae?: string
      vencimientoCae?: string
      vencimientoCaeIso?: string
      tipo?: number
      puntoVenta?: number
      numero?: number
      facturaId?: string
      cbtesAsoc?: Array<{ tipo: number; ptoVta: number; nro: number }>
      idempotencyKey?: string
    }
  }
}

export async function emitirNotaCreditoSale(
  id: number,
  body: EmitirNotaCreditoRequest
): Promise<EmitirNotaCreditoResponse> {
  const apiUrl = getApiUrl()
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...getAuthHeaders() }
  // mismas cabeceras opcionales que facturarSale (x-api-key, x-facturador-api-key)

  const payload: EmitirNotaCreditoRequest = {
    motivo: body.motivo ?? 'error_emision',
    confirmar: true,
    ...(body.observaciones ? { observaciones: body.observaciones } : {}),
    ...(body.puntoVenta != null ? { puntoVenta: body.puntoVenta } : {}),
    ...(body.cuitEmisor != null ? { cuitEmisor: body.cuitEmisor } : {}),
  }

  const response = await fetch(`${apiUrl}sales/${id}/nota-credito`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  // mismo parseo / errores que facturarSale
}
```

Al armar el body, incluir `puntoVenta: getStoredFacturacionPuntoVenta() ?? 5` si el usuario tiene PV guardado en configuración local.

---

## Cambios de UI (`app/facturacion/page.tsx`)

### 1. Habilitar el botón

Reemplazar el botón deshabilitado por uno que llame a `emitirNotaCreditoSale`:

```typescript
async function onSubmitNotaCredito() {
  if (!creditNoteSale) return
  setNcLoading(true)
  try {
    const res = await emitirNotaCreditoSale(creditNoteSale.id, {
      motivo: 'error_emision',
      confirmar: true,
      puntoVenta: getStoredFacturacionPuntoVenta() ?? undefined,
    })
    if (res.success && res.data?.notaCredito?.cae) {
      toast.success(`NC emitida — CAE ${res.data.notaCredito.cae}`)
      // actualizar fila en billables con res.data.sale
      setCreditNoteSale(null)
      void refetchBillables()
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Error al emitir NC')
  } finally {
    setNcLoading(false)
  }
}
```

### 2. Quitar el bloque informativo «Próximo paso: backend»

Una vez integrado, eliminar el `Alert` que pide implementar el endpoint.

### 3. Estados en la tabla de facturación

| Estado | Badge / texto |
|--------|----------------|
| `arca_status === 'success'` y sin NC | «Facturado» + acción «¿Fue un error?» |
| `arca_nc_status === 'success'` | «Anulada por NC» + mostrar `arca_nc_cae` |
| `arca_nc_status === 'error'` | «Error NC» + reintentar (mismo `motivo` es idempotente) |
| `arca_nc_status === 'pending'` | «Emitiendo NC…» |

### 4. PDF / QR de la NC (fase 2)

El backend envía `omitirPdf: true` en la emisión. Para PDF de NC, reutilizar el flujo de comprobante cuando exista endpoint de consulta NC o ampliar `GET /api/sales/:id/comprobante` en el futuro. Por ahora basta con mostrar CAE, tipo, PV-número y `cbtesAsoc` de la respuesta.

---

## Checklist de integración frontend

| # | Tarea |
|---|--------|
| 1 | Tipos `Sale` con `arca_nc_*` y factura `arca_punto_venta` / `arca_numero` |
| 2 | Función `emitirNotaCreditoSale` en `lib/api.ts` |
| 3 | Preview NC desde API + caché (no solo caché) |
| 4 | Habilitar botón «Emitir nota de crédito» con `confirmar: true` |
| 5 | Enviar `puntoVenta` desde configuración (ej. **5**) si aplica |
| 6 | Refrescar listado tras éxito; badge «Anulada por NC» |
| 7 | Manejo de errores 409 / `FACTURA_ORIGINAL_INCOMPLETA` |
| 8 | Quitar alertas «pendiente backend» |

---

## Prueba manual (staging)

1. Venta con `arca_status: success` y CAE visible.
2. Abrir «¿Fue un error?» → debe verse referencia tipo `B 00005-00000012` (si hay datos en API).
3. Confirmar → `POST /api/sales/:id/nota-credito` → 200 con `arca_nc_cae`.
4. Recargar página → la venta sigue con factura original y `arca_nc_status: success`.
5. Segundo intento de NC → 409 `NOTA_CREDITO_YA_EMITIDA`.

```bash
curl -X POST "https://api.sistema.mfcomputers.com.ar/api/sales/55/nota-credito" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"motivo":"error_emision","confirmar":true,"puntoVenta":5}'
```

---

## Referencias en MF API

- Contrato resumido: [docs/facturacion.md](facturacion.md)
- Migración BD: [docs/migrations/2026-06-11_add_arca_nota_credito_fields_to_sales.sql](migrations/2026-06-11_add_arca_nota_credito_fields_to_sales.sql)
- Especificación backend original: `mfcomputers-nextjs/docs/nota-credito-arca-backend.md`
