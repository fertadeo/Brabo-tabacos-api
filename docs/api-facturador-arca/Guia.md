# Guía de integración para clientes Aurix (API Facturación Multi-CUIT)

Documento orientado a equipos que integran su propio backend (por ejemplo **api.sistema.mfcomputers.com.ar**) contra el **API de facturación electrónica** operado por Aurix/Fenec Studio.

---

## 1. Arquitectura recomendada

| Componente | Rol |
|------------|-----|
| Front del cliente (ej. `sistema.mfcomputers.com.ar`) | UI; no debe guardar la API key del facturador en el navegador. |
| API del cliente (ej. `api.sistema.mfcomputers.com.ar`) | Orquesta negocio propio y llama al API de facturación **desde el servidor** con HTTPS + API key. |

**No necesitás configurar CORS** en el API de facturación si todas las llamadas al facturador las hace **solo tu backend** (Node, .NET, etc.). CORS aplica cuando JavaScript en el **navegador** del usuario llama directamente a otro dominio (origen distinto).

Si en algún caso el **browser** llamara directo al API de facturación, Aurix debe declarar tu origen en `CORS_ORIGINS` en el servidor del facturador; para integraciones típicas ERP→API **no hace falta**.

---

## 2. URL base y entorno

Sustituí `BASE` por la URL que te indique Aurix (ejemplo de producción):

```text
BASE = https://api-facturador.fenecstudio.com
```

Convenciones:

- Solo **HTTPS** en producción.
- Todas las rutas de negocio bajo **`/api/...`** salvo utilitarios raíz (`/ping`).
- Cuerpos JSON: **`Content-Type: application/json`** en `POST`/`PATCH`.

---

## 3. Autenticación

### 3.1 API key (integraciones ERP / servidor)

Aurix crea una **API key** por organización en la base del facturador. El formato visible suele comenzar con **`mck_`**.

En producción el servidor suele tener **`REQUIRE_API_KEY=true`**: sin credencial válida, las rutas protegidas responden **401**.

Podés enviar la key de **una** de estas formas (equivale a la otra):

| Cabecera | Valor |
|----------|--------|
| `Authorization` | `Bearer mck_xxxxxxxx` |
| `X-API-Key` | `mck_xxxxxxxx` |

Si pegás por error `Bearer mck_...` dentro de `X-API-Key`, el servidor suele normalizarlo; lo importante es que el token final sea la key completa.

### 3.2 JWT de sesión (solo Dashboard web)

Los tokens de **`POST /api/auth/login`** (tres segmentos tipo JWT, **sin** prefijo `mck_`) también pueden usarse en `Authorization: Bearer ...` en rutas que comparten el mismo middleware de autenticación. Sirven para usuarios humanos en el panel; **las integraciones servidor a servidor usan API key**.

### 3.3 Alcance de la key

La API key está ligada a una **organización**. Solo podés operar sobre **CUIT emisores** dados de alta para esa organización en el facturador. Si el CUIT no corresponde a tu org, verás errores de autorización (p. ej. `CUIT_NO_AUTORIZADO` según reglas del servicio).

---

## 4. Formato unificado de errores

Respuestas de error (salvo detalles menores) siguen este esquema:

```json
{
  "ok": false,
  "error": {
    "code": "CODIGO_DE_NEGOCIO",
    "message": "Texto legible",
    "details": {}
  },
  "requestId": "uuid-opcional"
}
```

Códigos frecuentes (no exhaustivo): `AUTH_MISSING_KEY`, `AUTH_INVALID_KEY`, `VALIDATION_ERROR`, `CUIT_NO_AUTORIZADO`, `ARCA_ERROR`, `429` con rate limit, `IDEMPOTENCY_CONFLICT`, etc.

---

## 5. Cabeceras útiles

| Cabecera | Uso |
|----------|-----|
| `Authorization: Bearer mck_...` o `X-API-Key: mck_...` | Autenticación (si está exigida). |
| `Content-Type: application/json` | Obligatorio en cuerpos JSON. |
| `Idempotency-Key` | Opcional en **`POST /api/facturas`**: misma clave + mismo cuerpo → misma respuesta; mismo key + cuerpo distinto → **409**. Entre 1 y 256 caracteres tras normalizar espacios. Requiere base de datos activa en el facturador para deduplicar. |

---

## 6. Rate limiting

El facturador puede limitar solicitudes por ventana de tiempo (por API key autenticada). Variables típicas en el servidor Aurix:

- `API_RATE_LIMIT_PER_MINUTE` (por defecto orden 60).
- `API_RATE_LIMIT_FACTURAS_PER_MINUTE` para emisión (`POST /api/facturas`).

Si superás el límite, respuesta **429** y cabecera **`Retry-After`** (segundos).

---

## 7. Utilitarios sin prefijo `/api`

### `GET /ping`

Comprobación mínima de proceso HTTP.

**Respuesta 200:**

```json
{ "pong": true }
```

No exige API key (según despliegue puede igualmente enviar CORS genérico).

### `GET /api/version`

Metadatos de versión, Node, modo ARCA, directorio de certificados, etc.

### `GET /api/readyz`

Salud del servicio: base de datos, directorio de certificados, opcionalmente prueba ARCA si está configurada. **200** si todo OK acorde reglas del deploy; **503** si algo crítico falla.

---

## 8. Tablas de referencia (payload de comprobante)

### 8.1 `tipo` — tipo de comprobante WSFE

| Valor | Comprobante |
|-------|-------------|
| 1 | Factura A |
| 2 | Nota de débito A |
| 3 | Nota de crédito A |
| 6 | Factura B |
| 7 | Nota de débito B |
| 8 | Nota de crédito B |
| 11 | Factura C |

### 8.2 `docTipo` — documento del receptor

| Valor | Significado |
|-------|-------------|
| 80 | CUIT |
| 86 | CUIL |
| 96 | DNI |
| 99 | Sin identificar / mostrador (podés omitir `docNro`; el backend puede enviar `0` a WSFE) |

### 8.3 `condicionIvaReceptor` (obligatorio normativa ARCA)

| Valor | Significado |
|-------|-------------|
| 1 | Responsable inscripto |
| 4 | Exento |
| 5 | Consumidor final |
| 6 | Monotributo |
| 7 | No categorizado |
| 8 | No responsable |
| 9 | Monotributo social |
| 10 | Monotributo trabajador independiente |

### 8.4 `concepto`

| Valor | Significado |
|-------|-------------|
| 1 | Productos |
| 2 | Servicios |
| 3 | Productos y servicios |

Si `concepto` es **2** o **3**, son obligatorias **`fechaServicioDesde`** y **`fechaServicioHasta`** (`YYYY-MM-DD`).

### 8.5 `iva` (Factura A / B / notas A-B)

Para tipos **1, 2, 3, 6, 7, 8** el arreglo **`iva`** es obligatorio. Cada elemento:

```json
{
  "id": 5,
  "base": 100.0,
  "cuota": 21.0
}
```

`id` = alícuota ARCA: **3** exento · **4** 10,5% · **5** 21% · **6** 27% · **8** 5% · **9** 2,5%.

El **`importe`** total debe coincidir con **suma(bases) + suma(cuotas)** (tolerancia interna ~0.01).

### 8.6 Factura C (`tipo` = 11)

No incluyas `iva`. El `importe` es el total según reglas Factura C.

### 8.7 Campos opcionales adicionales (emisión)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `omitirPdf` | boolean | Si `true`, no genera/persiste PDF en emisión (solo ARCA + DB según política). |
| `consultarSugerenciaCondicionIva` | boolean | Si `true`, la respuesta puede incluir sugerencia desde padrón (no bloquea validación). |
| `webhookUrl` | string (http/https) | URL POST que recibirá aviso tras emisión. |
| `webhookSecret` | string (≤512) | Si se envía, el facturador POST incluye cabecera **`X-Webhook-Secret`** con ese valor. |
| `leyendaComprobante` | string (≤500) | Texto libre para PDF generado por la plataforma (no es “concepto” ARCA). |
| `fechaVencimientoPago` | `YYYY-MM-DD` | Solo concepto 2 o 3; no anterior a “hoy” Argentina. |

---

## 9. Emisión y consulta de facturas

### `POST /api/facturas`

Emite un comprobante electrónico para el **`cuitEmisor`** indicado en el cuerpo.

**Headers:** autenticación si aplica; opcional `Idempotency-Key`.

**Cuerpo mínimo ejemplo Factura B (tipo 6) con IVA 21%:**

```json
{
  "cuitEmisor": 20123456789,
  "tipo": 6,
  "puntoVenta": 1,
  "docTipo": 80,
  "docNro": "27946239735",
  "condicionIvaReceptor": 1,
  "concepto": 1,
  "importe": 121.0,
  "iva": [
    { "id": 5, "base": 100.0, "cuota": 21.0 }
  ]
}
```

**Ejemplo Factura C (tipo 11):**

```json
{
  "cuitEmisor": 20123456789,
  "tipo": 11,
  "puntoVenta": 1,
  "docTipo": 80,
  "docNro": "27946239735",
  "condicionIvaReceptor": 5,
  "concepto": 1,
  "importe": 1500.0
}
```

**Ejemplo servicios (concepto 2) con período:**

```json
{
  "cuitEmisor": 20123456789,
  "tipo": 6,
  "puntoVenta": 1,
  "docTipo": 80,
  "docNro": "27946239735",
  "condicionIvaReceptor": 1,
  "concepto": 2,
  "importe": 121.0,
  "fechaServicioDesde": "2026-05-01",
  "fechaServicioHasta": "2026-05-31",
  "iva": [
    { "id": 5, "base": 100.0, "cuota": 21.0 }
  ]
}
```

**Respuesta exitosa típica (201):**

```json
{
  "ok": true,
  "data": {
    "cae": "...",
    "vencimientoCae": "...",
    "numero": 123,
    "tipo": 6,
    "puntoVenta": 1,
    "cuitEmisor": 20123456789,
    "fechaEmision": "...",
    "qrUrl": "...",
    "verificacionWsfe": {
      "ok": true,
      "intentos": 1,
      "mensaje": "..."
    }
  },
  "persistencia": {
    "guardada": true,
    "facturaId": "uuid-de-la-fila-en-bd"
  },
  "pdf": {
    "generado": true,
    "pdfId": "...",
    "descarga": "/api/facturas/<facturaId>/pdf?cuitEmisor=20123456789"
  }
}
```

Los campos exactos de `data` vienen de ARCA/WSFE; `persistencia` y `pdf` dependen de configuración del servidor (modo PDF on_emit vs on_demand, éxito de verificación WSFE, `omitirPdf`, etc.).

Si mandás **`webhookUrl`**, la respuesta puede incluir un objeto **`webhook`** con si se entregó el POST, código HTTP, error o encolado de reintento.

**Webhook enviado por el facturador (POST a tu URL):**

```json
{
  "event": "factura_emitida",
  "cuitEmisor": 20123456789,
  "facturaId": "uuid-o-null",
  "data": {},
  "timestamp": "2026-05-04T12:00:00.000Z"
}
```

Cabeceras: `Content-Type: application/json`; si definiste `webhookSecret`, también `X-Webhook-Secret: <tu-secreto>`.

---

### `POST /api/facturas/preview`

Mismo cuerpo que **`POST /api/facturas`**, pero **no emite**: devuelve previsualización del payload WSFE y número sugerido. Útil para validar antes de facturar.

**Respuesta 200:** incluye `ok`, `preview: true`, `data` con detalle de previsualización; opcionalmente bloque `sugerenciaCondicionIva` si pedís `consultarSugerenciaCondicionIva: true`.

---

### `GET /api/facturas/health/:cuit`

**`:cuit`** = 11 dígitos del emisor. Comprueba conectividad ARCA/WSFE para ese CUIT (certificados, TA, etc.).

**Respuesta 200:**

```json
{
  "ok": true,
  "status": "...",
  "components": {}
}
```

---

### `GET /api/facturas/:facturaId?cuitEmisor=XXXXXXXXXXX`

**`facturaId`**: UUID devuelto en `persistencia.facturaId` al emitir.

**Query obligatorio:** `cuitEmisor` (11 dígitos, sin guiones).

**Respuesta 200:** `{ "ok": true, "data": { ... } }` con detalle persistido; si hay PDF asociado puede venir `pdf_descarga` con ruta relativa.

---

### `GET /api/facturas/:facturaId/pdf?cuitEmisor=XXXXXXXXXXX`

Devuelve el **PDF** (`Content-Type: application/pdf`) si existe o puede generarse on-demand según política del servidor.

---

### `GET /api/facturas/:facturaId/events?cuitEmisor=XXXXXXXXXXX&limit=100`

Timeline de eventos API relacionados a la factura. `limit` opcional (default 100, máx 500).

---

## 10. Emisión por lotes (asíncrona)

### `POST /api/facturas/batch`

**Cuerpo:**

```json
{
  "items": [
    { "cuitEmisor": 20123456789, "tipo": 11, "puntoVenta": 1, "...": "..." },
    { "cuitEmisor": 20123456789, "tipo": 11, "puntoVenta": 1, "...": "..." }
  ]
}
```

Cada elemento de **`items`** debe ser un payload compatible con lo que acepta **`POST /api/facturas`** (la validación detallada ocurre al procesar cada ítem en background).

Límite de ítems: configurable en servidor (`BATCH_MAX_ITEMS`, tope duro típico 1000).

**Respuesta 202:**

```json
{
  "ok": true,
  "data": {
    "batchId": "uuid",
    "status": "pending",
    "totalItems": 2
  }
}
```

### `GET /api/facturas/batch/:batchId`

Estado agregado del job (`pending`, contadores, fechas).

### `GET /api/facturas/batch/:batchId/items?limit=20&offset=0`

Lista ítems del batch con estado por línea, `factura_id` si OK, `error_code` / `error_message` si falló.

`limit` por defecto 20, máximo 100; `offset` default 0.

---

## 11. Rutas bajo `/api/emisores/:cuitEmisor/...`

Todas requieren la misma autenticación que `/api/facturas` si el servidor exige API key.

### `GET /api/emisores/:cuitEmisor/facturas`

Lista comprobantes persistidos del emisor.

**Query (todos opcionales salvo reglas de validación):**

| Parámetro | Descripción |
|-----------|-------------|
| `limit` | 1–100 (default 20) |
| `offset` | ≥ 0 (default 0) |
| `estado` | `emitida` \| `error` \| `anulada` |
| `tipoCbte` | entero tipo comprobante |
| `desde` / `hasta` | `YYYY-MM-DD` |
| `cae` | filtro por CAE |
| `docNro` | documento receptor |
| `q` | búsqueda libre |
| `conCae` | `true` solo con CAE, `false` solo sin |
| `arcaErrorCode` | filtro por código en respuesta ARCA |
| `sortBy` | `created_at` \| `fecha_cbte` \| `importe_total` \| `numero` |
| `order` | `asc` \| `desc` |

**Respuesta:** incluye `data`, `paginacion`, `resumen`, `filtros`.

### `GET /api/emisores/:cuitEmisor/facturas/export`

Mismos filtros que el listado; respuesta **CSV** (descarga archivo).

---

### Padrón ARCA (receptor)

- **`GET /api/emisores/:cuitEmisor/contribuyentes/:cuitReceptor/padron?alcance=five`**  
  Consulta datos de padrón (alcance configurable: `four`, `five`, `ten`, `thirteen`, `inscription_proof`, etc.).

- **`GET /api/emisores/:cuitEmisor/contribuyentes/:cuitReceptor/padron-completo`**  
  Consulta combinada (A13 + constancia).

- **`GET /api/emisores/:cuitEmisor/contribuyentes/:cuitReceptor/sugerencia-condicion-iva?alcance=five`**  
  Sugerencia orientativa de condición IVA del receptor.

### Tablas y cotización ARCA

- **`GET /api/emisores/:cuitEmisor/arca/tablas/:nombreTabla`** — ej. `voucher-types`.
- **`GET /api/emisores/:cuitEmisor/arca/cotizacion?monedaId=DOL`**
- **`GET /api/emisores/:cuitEmisor/arca/capabilities?cuitReceptor=...`**

### Certificados digitales del emisor

Rutas bajo **`/api/emisores/:cuitEmisor/certificados/...`** (estado, health, CSR, importación, validación, export P12, etc.). Uso típico: operadores humanos o procesos de alta de CUIT; detalle en código y otras guías internas.

---

## 12. Autenticación humana (Dashboard) — referencia breve

| Método | Ruta | Cuerpo / notas |
|--------|------|----------------|
| POST | `/api/auth/login` | Credenciales dashboard → JWT de sesión |
| GET | `/api/auth/memberships` | Requiere sesión |
| POST | `/api/auth/switch-organizacion` | Requiere sesión |
| POST | `/api/auth/logout` | Requiere sesión |

Las integraciones **MF Computers → facturador** no suelen usar estas rutas; usan **API key**.

---

## 13. Ambiente ARCA (homologación vs producción)

El servidor Aurix define si las facturas pegan contra **homologación** o **producción** (`AFIP_ENV`, certificados por carpeta, etc.). Confirmá con Aurix en qué ambiente está apuntado el `BASE` que te entregan antes de facturar comprobantes reales.

---

## 14. Documentación adicional en el repo

- Payload detallado y schema JSON: `multicuit/backend/facturas/README.md` y `facturas/factura-payload.schema.json`.
- Despliegue y variables de entorno del servidor: documentación en `multicuit/docs/`.

---

## 15. Checklist para el equipo MfComputers (ejemplo)

1. Obtener **URL base** HTTPS del facturador y **API key** (`mck_...`) para la organización correspondiente.
2. Implementar llamadas **solo desde** `api.sistema.mfcomputers.com.ar` (no desde el bundle Next del navegador).
3. Guardar la API key en **secretos del servidor** (variables de entorno, vault), nunca en el front.
4. Usar **`POST /api/facturas`** con payload validado; opcional **`Idempotency-Key`** para no duplicar comprobantes ante reintentos de red.
5. Persistir localmente `facturaId` y CAE devueltos; descargar PDF con **`GET .../pdf`** si lo necesitan usuarios o archivo digital.
6. Opcional: **`webhookUrl`** apuntando a un endpoint en vuestra API para recibir **`factura_emitida`** sin polling.
7. Tratar **429** con backoff según `Retry-After`.

Si necesitán **nuevo CUIT emisor** o rotación de certificados, coordinar con Aurix (altas en DB + certificados ARCA).
