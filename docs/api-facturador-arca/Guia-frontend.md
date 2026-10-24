# Implementacion para Frontend: Facturacion ARCA via MF API

## Regla principal de arquitectura

El frontend **NO** debe consumir `api-facturador.fenecstudio.com` directamente.

El frontend debe consumir **solo** esta API (`mfcomputers-api`) y dejar que el backend:

- gestione credenciales (`FACTURADOR_API_KEY`);
- arme el payload de facturacion;
- maneje idempotencia y errores de ARCA;
- persista trazabilidad (CAE, facturaId, estado, errores).

Esto evita exponer secretos en navegador y centraliza la logica fiscal en backend.

---

## Flujo funcional para frontend

1. El usuario crea/selecciona una venta en MF API.
2. Desde UI se dispara la accion "Facturar".
3. Frontend llama a `POST /api/sales/:id/facturar` en MF API.
4. MF API emite en facturador ARCA de forma servidor-servidor.
5. Frontend recibe estado final + datos de trazabilidad para mostrar.

---

## Endpoint que debe usar frontend

### `POST /api/sales/:id/facturar`

Emite comprobante ARCA para una venta ya existente.

### Autenticacion

Usa la autenticacion habitual de MF API:

- `Authorization: Bearer <jwt>` (recomendado en frontend autenticado)
- o `x-api-key` en integraciones internas (no para browser publico)

### Body soportado (frontend)

```json
{
  "tipo": 11,
  "condicionIvaReceptor": 5,
  "concepto": 1,
  "force": false
}
```

Campos opcionales:

- `cuitEmisor`: si no se envia, backend usa `FACTURADOR_CUIT_EMISOR`.
- `puntoVenta`: si no se envia, backend usa `FACTURADOR_PUNTO_VENTA`.
- `docTipo`, `docNro`: override manual si hace falta.
- `tipo`: default `11` (Factura C).
- `condicionIvaReceptor`: default `5` (Consumidor final).
- `concepto`: `1`, `2` o `3`.
- `fechaServicioDesde`, `fechaServicioHasta`: obligatorias cuando `concepto` es `2` o `3`.
- `force`: `true` solo para reintento explicito si ya habia facturacion previa.

---

## Respuestas esperadas por frontend

### Caso exitoso (HTTP 200)

```json
{
  "success": true,
  "message": "Factura emitida correctamente en ARCA",
  "data": {
    "sale": {
      "id": 123,
      "arca_status": "success",
      "arca_factura_id": "uuid-o-id-remoto",
      "arca_cae": "12345678901234"
    },
    "arca": {
      "facturaId": "uuid-o-id-remoto",
      "cae": "12345678901234",
      "idempotencyKey": "sale-123-...",
      "response": {}
    }
  },
  "timestamp": "2026-05-05T..."
}
```

### Caso error funcional (4xx/5xx)

```json
{
  "success": false,
  "message": "Error al facturar venta en ARCA",
  "error": "Detalle legible",
  "data": {
    "status": 401,
    "code": "AUTH_INVALID_KEY",
    "retryAfter": null
  },
  "timestamp": "2026-05-05T..."
}
```

---

## Estados de facturacion que puede mostrar frontend

El backend persiste en `sales`:

- `arca_status`: `pending` | `success` | `error`
- `arca_factura_id`
- `arca_cae`
- `arca_last_attempt_at`
- `arca_error_code`
- `arca_error_message`

Recomendacion UI:

- `pending`: "Procesando facturacion..."
- `success`: "Facturado" + mostrar CAE
- `error`: "Error de facturacion" + mensaje corto + opcion "Reintentar"

---

## Reglas importantes para UX

- Si la venta ya esta facturada (`arca_status=success`), backend bloquea segunda emision salvo `force=true`.
- Si el backend responde codigo `429`, respetar `retryAfter` y reintentar luego.
- Para concepto `2` o `3`, pedir fechas de servicio en formulario antes de enviar.
- No guardar ni manejar API keys del facturador en frontend.

---

## Que hace MF API internamente (resumen tecnico)

Cuando recibe `POST /api/sales/:id/facturar`, MF API:

1. valida venta y items;
2. valida configuracion de facturador;
3. arma payload ARCA en backend;
4. genera `Idempotency-Key` estable (`saleId + hash payload`);
5. hace `ping` al facturador;
6. emite comprobante (`POST /api/facturas` remoto);
7. guarda request/response/errores en `sales`;
8. devuelve respuesta normalizada al frontend.

---

## Contrato frontend recomendado

- Boton "Facturar" en detalle de venta.
- Modal con campos minimos: `tipo`, `condicionIvaReceptor`, `concepto`.
- Campos condicionales para servicios (`fechaServicioDesde`, `fechaServicioHasta`).
- Mostrar resultado con `arca_cae` cuando `success`.
- Boton "Reintentar" enviando `{ "force": true }` solo si usuario confirma.

---

## Notas de crédito (anulación fiscal)

Guía completa para el equipo Next.js: **[docs/nota-credito-frontend.md](../nota-credito-frontend.md)**

Resumen:

- `POST /api/sales/:id/nota-credito` con `{ "motivo": "error_emision", "confirmar": true }`.
- Solo ventas con `arca_status === 'success'`; no usar `force` en facturar para deshacer.
- Leer PV y número de la factura desde `arca_punto_venta` / `arca_numero` (no solo caché de sesión).
- Tras éxito, mostrar `arca_nc_cae` y `arca_nc_status === 'success'`.
- PV de emisión: configuración local o `FACTURADOR_PUNTO_VENTA` del servidor (ej. **5**).

---

## Mensaje final para el equipo frontend

El frontend integra facturacion **solo** contra MF API.
No debe existir ninguna llamada desde browser hacia `api-facturador.fenecstudio.com`.
