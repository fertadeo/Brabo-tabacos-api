# Propuesta de diseño: Clientes, Proveedores y Artículos

Este documento resume la propuesta de información que guardaremos en el sistema para su negocio: **ventas por prospección** (llamadas, correo, visitas, referidos, etc.) **sin tienda online** y un catálogo que incluye tanto **productos** como **servicios** (artículos).

**Leyenda de “Completar”:**
- **Sí (obligatorio)** → El cliente debe cargar este dato para dar de alta o usar el registro.
- **Sí (opcional)** → Se puede cargar si lo tiene; no es obligatorio.
- **No (sistema)** → Lo genera o actualiza el sistema; no lo completa el usuario.

---

## 1. Información de **Clientes** (prospección: teléfono, mail, etc.)

Pensado para llevar el seguimiento de cada contacto: de dónde vino, quién lo atiende y cuándo dar seguimiento (llamada, mail, visita, etc.). No hay ecommerce: los contactos se cargan y siguen desde el sistema.

### Datos que recomendamos guardar

| Nombre del campo | Qué guarda | Completar |
|------------------|------------|-----------|
| **Identificación** | | |
| `id` | Identificador interno (numérico, automático). | No (sistema) |
| `codigo` | Código único del cliente (ej. CLI001, PRO-2025-001). Se puede generar automáticamente. | No (sistema) o Sí (opcional) si quieren cargarlo a mano |
| **Origen del contacto** | | |
| `origen` | Cómo llegó el contacto: llamada entrante, llamada saliente, email, referido, web, visita u otro. | Sí (obligatorio) |
| `asignado_a` | Usuario del sistema que hace el seguimiento (vendedor responsable). | Sí (obligatorio) o No (sistema) si hay un solo usuario |
| **Datos de contacto** | | |
| `nombre` | Nombre del cliente o razón social. | Sí (obligatorio) |
| `nombre_contacto` | Nombre de la persona de contacto (si es empresa). | Sí (opcional) |
| `email` | Correo electrónico. | Sí (opcional)* |
| `telefono` | Teléfono principal. | Sí (opcional)* |
| `telefono_alt` | Teléfono alternativo. | Sí (opcional) |
| **Datos fiscales / facturación** | | |
| `tipo_cliente_fiscal` | Tipo para facturar: consumidor final, monotributista, responsable inscripto, empresa u otro. | Sí (opcional) |
| `tipo_documento` | CUIT, CUIL, DNI, pasaporte u otro. | Sí (opcional) |
| `numero_documento` | Número de CUIT/CUIL/DNI. | Sí (opcional) |
| `razon_social` | Razón social (si aplica). | Sí (opcional) |
| **Ubicación** | | |
| `domicilio` | Dirección. | Sí (opcional) |
| `ciudad` | Ciudad. | Sí (opcional) |
| `provincia` | Provincia. | Sí (opcional) |
| `codigo_postal` | Código postal. | Sí (opcional) |
| `pais` | País (por defecto: Argentina). | Sí (opcional) |
| **Seguimiento** | | |
| `estado` | Etapa en el proceso: prospecto, contactado, calificado, negociación, cliente activo, inactivo o no interesado. | Sí (obligatorio) |
| `primera_contactacion` | Fecha y hora del primer contacto. | Sí (opcional) |
| `ultima_contactacion` | Fecha y hora de la última interacción. | No (sistema) |
| `proximo_seguimiento` | Fecha sugerida para el próximo contacto (llamada, mail, visita). | Sí (opcional) |
| `notas` | Notas libres sobre el cliente. | Sí (opcional) |
| `detalle_origen` | Detalle del origen (ej.: "Llamada 09/02 - interesado en servicio X"). | Sí (opcional) |
| **Control comercial** | | |
| `limite_credito` | Límite de crédito si vende a cuenta (0 si solo contado). | Sí (opcional) |
| `dias_pago` | Días de pago (0 = contado). | Sí (opcional) |
| `activo` | Si el registro está activo (sí/no). | Sí (obligatorio) |
| `fecha_creacion`, `fecha_actualizacion` | Fechas de alta y última modificación. | No (sistema) |
| `creado_por` | Usuario que dio de alta el cliente. | No (sistema) |

\* Conviene tener al menos **teléfono o email** para poder hacer seguimiento; se puede marcar uno de los dos como obligatorio según su forma de trabajo.

### Historial de contactos (cada llamada, mail o visita)

Para no perder el detalle de cada contacto (llamada, correo, visita, etc.):

| Nombre del campo | Qué guarda | Completar |
|------------------|------------|-----------|
| `id` | Identificador del registro. | No (sistema) |
| `id_cliente` | A qué cliente corresponde. | No (sistema) |
| `tipo_contacto` | Llamada entrante, llamada saliente, email, visita u otro. | Sí (obligatorio) |
| `fecha_contacto` | Cuándo fue el contacto. | Sí (obligatorio) |
| `id_usuario` | Quién registró el contacto. | No (sistema) |
| `resumen` | Resumen de la conversación o del contacto. | Sí (obligatorio) |
| `proximo_seguimiento` | Próxima fecha sugerida de seguimiento. | Sí (opcional) |
| `fecha_creacion` | Cuándo se cargó el registro. | No (sistema) |

Así podrá ver en un solo lugar todo el historial de contactos con cada cliente.

---

## 2. Información de **Proveedores**

El sistema ya contempla una estructura completa de proveedores, pensada para uso en Argentina (datos fiscales, contacto, cuenta corriente, etc.). **No hace falta cambiarla**: puede reutilizarse tal cual. A continuación, la información completa que se puede guardar y qué debe completar el cliente.

### Datos que recomendamos guardar

| Nombre del campo | Qué guarda | Completar |
|------------------|------------|-----------|
| **Identificación** | | |
| `id` | Identificador interno (numérico, automático). | No (sistema) |
| `codigo` | Código único del proveedor (ej. PROV001, S0001). | Sí (obligatorio) |
| **Tipo y nombre** | | |
| `tipo_proveedor` | Tipo: productivo, no productivo u otro pasivo (para clasificación contable). | Sí (opcional) |
| `nombre` | Nombre del proveedor. | Sí (obligatorio) |
| `razon_social` | Razón social (para facturas y registros formales). | Sí (opcional) |
| `nombre_fantasia` | Nombre de fantasía o comercial. | Sí (opcional) |
| **Datos fiscales** | | |
| `frecuencia_compra` | Frecuencia de compra: diaria, semanal, mensual, etc. | Sí (opcional) |
| `tipo_documento` | Tipo de identificación: CUIT, CUIL, DNI, pasaporte u otro. | Sí (opcional) |
| `numero_documento` | Número de CUIT/CUIL/DNI. | Sí (opcional) |
| `ingresos_brutos` | Ingresos brutos (clasificación fiscal). | Sí (opcional) |
| `condicion_iva` | Condición frente al IVA: Responsable inscripto, Monotributista, Exento, IVA exento, No responsable, Consumidor final. | Sí (opcional) |
| **Cuenta contable (si aplica)** | | |
| `descripcion_cuenta_contable` | Descripción de la cuenta contable del proveedor. | Sí (opcional) |
| `producto_servicio_provee` | Producto o servicio que provee (resumen). | Sí (opcional) |
| `cuenta_resumen_integral` | Cuenta de resumen integral. | Sí (opcional) |
| `costo_asociado` | Costo asociado al proveedor (referencia). | Sí (opcional) |
| **Contacto** | | |
| `nombre_contacto` | Nombre de la persona de contacto. | Sí (opcional) |
| `email` | Correo electrónico de contacto. | Sí (opcional)* |
| `telefono` | Teléfono de contacto. | Sí (opcional)* |
| **Ubicación** | | |
| `domicilio` | Dirección. | Sí (opcional) |
| `ciudad` | Ciudad. | Sí (opcional) |
| `pais` | País (por defecto: Argentina). | Sí (opcional) |
| **Cuenta corriente y pagos** | | |
| `tiene_cuenta_corriente` | Si tiene cuenta corriente habilitada (sí/no). | Sí (opcional) o No (sistema por defecto) |
| `dias_pago` | Términos de pago en días (ej. 30, 60). | Sí (opcional) |
| **Control** | | |
| `activo` | Si el registro está activo (sí/no). | Sí (obligatorio) |
| `fecha_creacion`, `fecha_actualizacion` | Fechas de alta y última modificación. | No (sistema) |

\* Conviene tener al menos **teléfono o email** para poder contactar al proveedor; según su forma de trabajo puede fijar uno como obligatorio.

No se necesita una estructura especial por tipo de prospección; el flujo de compras (órdenes, facturas, pagos) puede seguir igual que en el sistema actual.

---

## 3. Información de **Artículos** (productos y servicios)

Una sola lista de “artículos” donde cada uno puede ser **producto** o **servicio**. Los productos pueden tener stock; los servicios no. Sin datos de tienda online.

### Datos que recomendamos guardar por artículo

| Nombre del campo | Qué guarda | Completar |
|------------------|------------|-----------|
| **Identificación** | | |
| `id` | Identificador interno (automático). | No (sistema) |
| `codigo` | Código único (ej. ART001, SVC-INSTALACION). | Sí (obligatorio) |
| **Tipo** | | |
| `tipo_articulo` | Si es **producto** o **servicio**. | Sí (obligatorio) |
| **Descripción** | | |
| `nombre` | Nombre del artículo. | Sí (obligatorio) |
| `descripcion` | Descripción o detalle. | Sí (opcional) |
| `id_categoria` | Categoría (misma lista para productos y servicios). | Sí (opcional) |
| **Precio** | | |
| `precio` | Precio de venta (lista o por defecto). | Sí (obligatorio) |
| `moneda` | Moneda (por defecto: pesos argentinos). | Sí (opcional) o No (sistema) |
| **Solo para productos** | | |
| `stock` | Cantidad en stock. | Sí (obligatorio para productos) o No (sistema) si se lleva por movimientos |
| `stock_minimo` | Cantidad mínima para alertas. | Sí (opcional) |
| `stock_maximo` | Cantidad máxima. | Sí (opcional) |
| `codigo_barras` | Código de barras. | Sí (opcional) |
| `peso` | Peso (para envíos, si aplica). | Sí (opcional) |
| **Solo para servicios** | | |
| `duracion_estimada_horas` | Duración estimada del servicio en horas. | Sí (opcional) |
| `unidad_servicio` | Cómo se cobra: por hora, por visita, por unidad u otro. | Sí (opcional) |
| **General** | | |
| `activo` | Si el artículo está disponible (sí/no). | Sí (obligatorio) |
| `fecha_creacion`, `fecha_actualizacion` | Fechas de alta y última modificación. | No (sistema) |

Las **categorías** pueden ser una sola lista (productos y servicios) o marcarse por tipo (“producto”, “servicio” o “ambos”) para filtrar en pantalla. Cada categoría: nombre **obligatorio**; descripción **opcional**; el resto lo puede completar el cliente según necesidad.

Este diseño **no incluye** datos de tienda online. Si más adelante agrega venta por web, se puede sumar una capa aparte sin cambiar esta información base.

---

## 4. Cómo se usa en el día a día

- **Pedidos y ventas:** Cada pedido se asocia a un **cliente**. Cada línea del pedido apunta a un **artículo** (producto o servicio). Así puede armar presupuestos y ventas con productos y servicios en la misma orden, sin depender de un ecommerce.

- **Compras:** Siguen vinculadas a **proveedores**. Si compra artículos (para revender o para ejecutar servicios), esas líneas pueden referenciar el mismo catálogo de artículos.

- **Stock:** Solo los artículos tipo “producto” tendrán stock; los servicios no. Los movimientos de entrada y salida se registran sobre esos productos.

De esta forma, clientes, proveedores y artículos quedan alineados con un flujo de ventas por prospección (teléfono, mail, visita, etc.) y un catálogo unificado, sin tienda online.

---

## 5. Resumen de la propuesta

| Área | Qué proponemos |
|------|----------------|
| **Clientes** | Una ficha por cliente con origen del contacto (llamada, mail, visita, referido, etc.), vendedor asignado, estado en el proceso (prospecto → cliente activo), fechas de contacto y próxima acción. Más un **historial de contactos** por cada llamada, mail o visita. Sin ecommerce. |
| **Proveedores** | Usar la estructura actual de proveedores del sistema, con datos fiscales, contacto y cuenta corriente si la utilizan. Campos obligatorios y opcionales como se indica arriba. |
| **Artículos** | Una sola lista de artículos (productos y servicios), con tipo, precio, stock solo para productos y datos opcionales para servicios (duración, unidad). Sin datos de tienda online. |
| **Pedidos** | Pedidos por cliente, con ítems que referencian artículos (productos o servicios), listos para su flujo de ventas por prospección. |

Si desea agregar, quitar o marcar más campos como obligatorios u opcionales, se puede ajustar esta propuesta según lo que necesite en el día a día.
