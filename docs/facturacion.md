# Contrato MF API ↔ Frontend — Facturación ARCA

El navegador **no** debe llamar al host público del facturador. Toda emisión pasa por **MF API** (`POST /api/sales/:id/facturar`).

## Variables solo en servidor

| Variable | Descripción |
|----------|-------------|
| `FACTURADOR_BASE_URL` | URL base HTTPS del facturador (ej. `https://api-facturador.fenecstudio.com`). |
| `FACTURADOR_API_KEY` | API key `mck_...` (recomendado en producción). |
| `FACTURADOR_TIMEOUT_MS` | Timeout HTTP (default `15000`). |
| `FACTURADOR_CUIT_EMISOR` | CUIT emisor por defecto si el body no envía `cuitEmisor`. |
| `FACTURADOR_PUNTO_VENTA` | Punto de venta por defecto si el body no envía `puntoVenta`. |
| `FACTURADOR_EMISOR_REGIMEN` | `responsable_inscripto` (default), `monotributo` o `exento`. Define si corresponde Factura B/C y valida el `tipo` antes de emitir. |
| `FACTURADOR_TIPO_DEFAULT` | Tipo WSFE por defecto si el body no envía `tipo` (sin variable: **6** si emisor RI, **11** si monotributo/exento). |
| `FACTURADOR_ALLOW_CLIENT_API_KEY` | `true` solo en dev/transición: permite usar cabecera `x-facturador-api-key`. En producción dejar **sin definir** o `false`. |

## Sugerencia de comprobante (frontend)

Antes de abrir el modal de facturación:

`GET /api/sales/:id/facturar/sugerencia`

Devuelve `sugerencia.tipo` (6 = Factura B, 11 = Factura C, 1 = Factura A), `defaults` y `emisorRegimen`. Usar esos valores como selección inicial del formulario.

Si se envía `tipo: 11` con emisor **Responsable Inscripto**, el `POST /facturar` responde **400** con mensaje claro y `data.suggestedTipo: 6` (no llama a ARCA).

## Nota de crédito (anulación fiscal)

`POST /api/sales/:id/nota-credito` — emite NC en MultiCUIT por una venta con `arca_status = success`.

Body mínimo:

```json
{
  "motivo": "error_emision",
  "confirmar": true
}
```

- Requiere factura original con tipo, PV y número (`arca_tipo`, `arca_punto_venta`, `arca_numero`); si faltan, el backend intenta completar desde MultiCUIT.
- `puntoVenta` de la NC: body → `FACTURADOR_PUNTO_VENTA` (ej. **5**) → PV de la factura original.
- Mapeo tipo: Factura B (6) → NC B (8); Factura C (11) → NC C (13); Factura A (1) → NC A (3).
- Idempotencia: `sale-{id}-nc-{motivo}`.
- Migración BD: `docs/migrations/2026-06-11_add_arca_nota_credito_fields_to_sales.sql`.
- **Guía frontend (integración Next.js):** [docs/nota-credito-frontend.md](nota-credito-frontend.md)

## Body `POST /api/sales/:id/facturar`

MF API usa `cuitEmisor` y `puntoVenta` del body si vienen; si no, `FACTURADOR_CUIT_EMISOR` y `FACTURADOR_PUNTO_VENTA`.

Campos habituales: `tipo`, `condicionIvaReceptor`, `concepto`, `docTipo`, `docNro`, `force`, fechas de servicio si `concepto` es 2 o 3.

## Cabecera opcional `x-facturador-api-key` (modo B — transición)

- Si **`FACTURADOR_ALLOW_CLIENT_API_KEY=true`**:
  - Usuario con JWT y rol **admin**, **gerencia** o **finanzas** puede enviar la key del facturador en esta cabecera; MF API la usa para **esa** llamada al facturador.
  - Sin JWT (solo `x-api-key` de MF API): la cabecera se **ignora** y se usa `FACTURADOR_API_KEY` del servidor.
- Si la variable **no** es `true` (producción recomendada): la cabecera se **ignora** y solo cuenta `FACTURADOR_API_KEY` en el servidor.

Enviar la key desde el browser **no es tan seguro** como guardarla solo en el servidor; la opción A (solo env) sigue siendo la recomendada para producción.

## Auditoría

En cada emisión, MF API registra en log del servidor: usuario (id, username, rol si hay JWT), `cuitEmisor` / `puntoVenta` y si vinieron de **body** o **env**, y si la API key del facturador fue **header**, **env** o ninguna.

## CORS

El servidor permite la cabecera `x-facturador-api-key` en preflight para el dominio del frontend configurado en `CORS_ORIGIN`.

## Logs de diagnóstico (`[FacturadorEnv]`)

Al **arrancar** la API se imprime un resumen de variables (presencia, problemas de formato en CUIT/PV, API key enmascarada).

En cada **`POST /api/sales/:id/facturar`**:

- `facturarVenta — uso de variables / fuentes`: de dónde sale la API key (header/env/nada), si hay `FACTURADOR_BASE_URL`, fuente de CUIT/PV (body vs env) y si `FACTURADOR_CUIT_EMISOR` está definido y con 11 dígitos válidos.
- Si faltan credenciales: warning **No hay credenciales suficientes**.
- Si el CUIT emisor es inválido: warning **CUIT emisor inválido** con dígitos normalizados y fuente.
- Si `/ping` falla: warning con la URL base configurada.

Los mensajes **`[FacturadorArca]`** siguen detallando la llamada HTTP al facturador (Bearer enmascarado).

## Modelo híbrido (BD + MultiCUIT)

Migración: `docs/migrations/2026-05-19_add_arca_comprobante_fields_to_sales.sql` (incluye backfill desde `arca_response_json`).

| Momento | Acción |
|---------|--------|
| Emisión | `POST /api/sales/:id/facturar` persiste `arca_numero`, `arca_punto_venta`, `arca_tipo`, `arca_cae_vto`, `arca_qr_url`, `arca_factura_id`, etc. |
| Listado / detalle venta | `GET /api/sales/:id` incluye columnas `arca_*` y objeto `arca_comprobante` |
| Vista / PDF | `GET /api/sales/:id/comprobante` — sin query lee BD; `?refresh=true` completa desde MultiCUIT |

Campos para PDF en frontend: `comprobante.numero`, `puntoVenta`, `tipo`, `cae`, `caeVtoIso`, `qrUrl`. Si `data.pdfReady === false`, llamar con `refresh=true`.
