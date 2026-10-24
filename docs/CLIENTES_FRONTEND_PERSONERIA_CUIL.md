# Instrucciones Frontend: Personería y CUIL/CUIT en Clientes

## Resumen

Se agregaron dos campos al módulo de clientes para facturación:

- **`personeria`**: tipo de persona (persona física, persona jurídica, consumidor final).
- **`cuil_cuit`**: número de CUIL o CUIT (11 dígitos), opcional cuando es consumidor final.
- **`tax_condition`**: condición frente al IVA en el ERP (`consumidor_final`, `inscripto`, `monotributo`, `responsable_inscripto`, `exento`).
- **`condicion_iva_receptor`**: código AFIP WSFE (1–10) para facturación.

---

## 1. Ejecutar migraciones en la base de datos

```sql
-- docs/migrations/2026-02-24_add_personeria_cuil_cuit_to_clients.sql (si aún no corrió)
-- docs/migrations/2026-06-02_add_tax_condition_to_clients.sql
ALTER TABLE `clients`
  ADD COLUMN `tax_condition` varchar(30) NULL DEFAULT 'consumidor_final'
    COMMENT 'inscripto|consumidor_final|monotributo|responsable_inscripto|exento'
    AFTER `cuil_cuit`,
  ADD COLUMN `condicion_iva_receptor` tinyint unsigned NULL
    COMMENT 'Código AFIP WSFE condicionIvaReceptor (1-10)'
    AFTER `tax_condition`;
```

---

## 2. Valores de `personeria`

| Valor              | Uso en UI                    |
|--------------------|-------------------------------|
| `persona_fisica`   | Persona física                |
| `persona_juridica` | Persona jurídica              |
| `consumidor_final` | Consumidor final (default)    |

---

## 3. API

### GET `/api/clients` y GET `/api/clients/:id`

La respuesta de cada cliente incluye:

```json
{
  "id": 1,
  "code": "MIN001",
  "client_type": "minorista",
  "sales_channel": "manual",
  "name": "Cliente Ejemplo",
  "email": "cliente@ejemplo.com",
  "phone": "+54 11 1234-5678",
  "address": "Calle Falsa 123",
  "city": "CABA",
  "country": "Argentina",
  "personeria": "consumidor_final",
  "cuil_cuit": null,
  "tax_condition": "consumidor_final",
  "condicion_iva_receptor": 5,
  "is_active": true,
  "created_at": "...",
  "updated_at": "..."
}
```

### POST `/api/clients` (crear cliente)

Body opcional para los nuevos campos:

| Campo       | Tipo   | Requerido | Descripción |
|------------|--------|-----------|-------------|
| `personeria` | string | No (default: `consumidor_final`) | `persona_fisica` \| `persona_juridica` \| `consumidor_final` |
| `cuil_cuit`  | string | No        | 11 dígitos (con o sin guiones); opcional si es consumidor final |
| `tax_condition` | string | No | Ver tabla abajo; default según personería |
| `condicion_iva_receptor` | number | No | Código AFIP 1–10; si falta se deriva de `tax_condition` |

**Valores `tax_condition`:**

| Valor | Código AFIP |
|-------|-------------|
| `responsable_inscripto` | 1 |
| `inscripto` | 1 |
| `exento` | 4 |
| `consumidor_final` | 5 |
| `monotributo` | 6 |

**Aliases aceptados en body:** `person_type` → `personeria`, `primary_tax_id` → `cuil_cuit`, `taxCondition`, `condicionIvaReceptor`.

**GET `/api/clients/padron/:cuit`:** incluye `tax_condition` sugerido además de `condicionIvaSugerida`.

Ejemplo:

```json
{
  "name": "Juan Pérez",
  "client_type": "minorista",
  "personeria": "persona_fisica",
  "cuil_cuit": "20123456789",
  "tax_condition": "inscripto",
  "condicion_iva_receptor": 1
}
```

### PUT `/api/clients/:id` (editar cliente)

Se pueden enviar solo los campos a actualizar, por ejemplo:

```json
{
  "personeria": "persona_juridica",
  "cuil_cuit": "30123456789",
  "email": "nuevo@mail.com",
  "phone": "+54 11 9999-8888",
  "address": "Av. Corrientes 1234",
  "city": "CABA",
  "country": "Argentina"
}
```

---

## 4. Validaciones (API)

- **personeria**: debe ser uno de: `persona_fisica`, `persona_juridica`, `consumidor_final`.
- **cuil_cuit**: si se envía, debe tener exactamente 11 dígitos (se pueden ignorar guiones/espacios para el conteo). Si es consumidor final puede ir `null` o vacío.

- **tax_condition**: debe ser coherente con `personeria` (consumidor final → solo `consumidor_final`; jurídica → `responsable_inscripto` o `exento`; física → `inscripto`, `monotributo` o `consumidor_final`).
- **condicion_iva_receptor**: entero 1–10 si se envía explícitamente.

---

## 5. Sugerencias para el frontend

### Detalle / formulario de cliente

1. **Selector de personería**
   - Control (select o radio): "Persona física", "Persona jurídica", "Consumidor final".
   - Valores a enviar: `persona_fisica`, `persona_juridica`, `consumidor_final`.
   - Valor por defecto al crear: `consumidor_final`.

2. **Campo CUIL/CUIT**
   - Mostrar siempre, pero:
     - Si personería = **Consumidor final**: campo opcional (y opcionalmente ocultar o deshabilitar).
     - Si personería = **Persona física** o **Persona jurídica**: recomendable requerirlo en el formulario y validar 11 dígitos en el frontend.
   - Aceptar con o sin guiones (ej. `20-12345678-9` o `20123456789`); la API acepta ambos y valida por cantidad de dígitos.
   - Opcional: formatear en pantalla como `XX-XXXXXXXX-X`.

3. **Resto de datos**
   - Siguen igual: nombre, email, teléfono, dirección, ciudad, país, y si aplica código, tipo de cliente, canal de venta, estado activo. Para edición usar **PUT** `/api/clients/:id` con los campos que se quieran actualizar.

### Listado de clientes

- Opcional: mostrar una columna "Personería" o "Tipo" con la etiqueta (Física / Jurídica / Consumidor final) y, si quieren, la columna CUIL/CUIT.

### Errores de validación

- Si la API devuelve 400 con mensaje tipo "CUIL/CUIT must be 11 digits" o "Personeria must be one of: ...", mostrar el mensaje al usuario junto al campo correspondiente.

---

## 6. Resumen de endpoints afectados

| Método | Ruta               | Cambio |
|--------|--------------------|--------|
| GET    | `/api/clients`     | Incluye `personeria` y `cuil_cuit` en cada cliente |
| GET    | `/api/clients/:id` | Incluye `personeria` y `cuil_cuit` |
| GET    | `/api/clients/padron/:cuit` | Incluye `tax_condition` sugerido desde ARCA |
| POST   | `/api/clients`     | Acepta `tax_condition` y `condicion_iva_receptor` |
| PUT    | `/api/clients/:id` | Acepta `tax_condition` y `condicion_iva_receptor` |

---

**Última actualización:** Junio 2026
