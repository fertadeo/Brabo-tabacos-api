# Implementación: Motor de Autocompletado por Código de Barras
Proyecto: Aurix ERP
Stack: Node.js + TypeScript + Express + MySQL
Arquitectura: controllers / services / routes / models

---

## 🎯 OBJETIVO

Implementar un motor de resolución de productos por código de barras (EAN / UPC / GTIN) que:

1. Reciba un código de barras.
2. Consulte primero una base interna (cache).
3. Si no existe, consulte múltiples proveedores externos.
4. Devuelva datos estructurados para **preview del usuario**:
   - title
   - description
   - brand
   - images[]
   - categoria recomendada. (opcional)
   - source
5. Guarde el resultado en cache.
6. Nunca consulte repetidamente APIs externas para el mismo código.
7. **Proporcione UX interactiva** con opciones: Aceptar | Modificar | Ignorar

---

## ⚙️ REGLAS IMPORTANTES

### HACER
- Implementar arquitectura modular y extensible.
- Usar patrón Provider para cada fuente externa.
- Priorizar APIs oficiales antes que scraping.
- Usar axios + cheerio para scraping liviano.
- Implementar sistema de cache en base de datos.
- Manejar errores silenciosamente (no romper flujo).

### NO HACER
- NO usar Playwright.
- NO usar Puppeteer.
- NO scrapear Google.
- NO scrapear Amazon.
- NO bloquear la request si un proveedor falla.
- NO hacer múltiples llamadas paralelas innecesarias.
- NO guardar múltiples veces el mismo barcode.

---

## ✨ MEJORAS PROPUESTAS (Revisión Técnica)

### 🔍 Integración con Tabla Products Existente

**Contexto:**
- La tabla `products` ya tiene campo `barcode` (VARCHAR(64))
- Existe `ProductService` y `ProductRepository` con funcionalidad completa

**Mejora:**
- **ANTES** de consultar `barcode_lookup_cache`, buscar primero en `products` por `barcode`
- Si existe producto con ese barcode → devolver datos del producto existente
- La tabla `barcode_lookup_cache` solo almacena datos de APIs externas (productos aún no creados)

**Flujo mejorado:**
```
1. Validar formato del código de barras
2. Buscar en tabla products por barcode (productos ya creados)
3. Si existe → devolver datos del producto + flag exists_as_product: true
4. Si no existe, buscar en barcode_lookup_cache
5. Si existe en cache → devolver resultado
6. Si no existe, consultar providers (en paralelo con Promise.allSettled)
7. Guardar resultado en cache
8. Devolver datos estructurados
```

### ⚡ Optimización de Performance

**Ejecución Paralela de Providers:**
- Usar `Promise.allSettled()` para ejecutar providers en paralelo
- Tomar el primer resultado válido que retorne
- Reducir tiempo de respuesta de ~3-5 segundos a ~1-2 segundos

**Implementación sugerida:**
```ts
export async function resolveProduct(barcode: string) {
  const providers: ProductProvider[] = [
    upcProvider,
    discogsProvider,
    serpapiProvider, // principal externo
    googleProvider,  // fallback externo
    tiendaProvider
  ];

  // Ejecutar todos en paralelo
  const results = await Promise.allSettled(
    providers.map(provider => provider.search(barcode))
  );

  // Tomar el primer resultado exitoso
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      return result.value;
    }
  }

  return null;
}
```

### ✅ Validación de Código de Barras

**Agregar validación de formato antes de consultar providers:**
- Validar formato EAN-13 (13 dígitos)
- Validar formato UPC-A (12 dígitos)
- Validar formato GTIN (8, 12, 13, 14 dígitos)
- Rechazar códigos con caracteres no numéricos (excepto casos especiales)

**Implementación:**
```ts
function validateBarcode(barcode: string): boolean {
  // Remover espacios y guiones
  const cleaned = barcode.replace(/[\s-]/g, '');
  
  // Validar que sea numérico y tenga longitud válida
  if (!/^\d+$/.test(cleaned)) return false;
  
  const length = cleaned.length;
  return length === 8 || length === 12 || length === 13 || length === 14;
}
```

### 🔒 Seguridad y Rate Limiting

**Consideraciones de seguridad:**
- Autenticación JWT requerida (como otros endpoints de productos)
- Rate limiting por usuario/IP para evitar abuso
- Validar que el código de barras no contenga caracteres maliciosos
- Sanitizar inputs antes de guardar en cache

**Rate Limiting sugerido:**
- Máximo 100 consultas por usuario por hora
- Máximo 10 consultas por IP por minuto
- Usar middleware `express-rate-limit` o similar

### 📊 Estructura de Respuesta Mejorada

**Respuesta del endpoint de búsqueda (Preview):**
```typescript
{
  success: true,
  message: "Product data retrieved successfully",
  data: {
    // Datos del producto encontrado
    title: string,
    description?: string,
    brand?: string,
    images?: string[],
    source: string, // "products", "cache", "upcitemdb", etc.
    
    // Campos adicionales útiles:
    suggested_price?: number,  // Si está disponible desde el provider
    category_suggestion?: string,
    
    // Estado del producto:
    exists_as_product?: boolean,  // true si ya existe en products
    product_id?: number,  // Si existe en products
    
    // Metadatos:
    cached_at?: string,  // Timestamp si viene de cache
    provider_response_time?: number,  // ms
    
    // UX: Mensaje para mostrar al usuario
    preview_message?: string,  // "Hemos encontrado: [nombre]"
    
    // UX: Acciones disponibles
    available_actions: {
      accept: boolean,  // Puede aceptar datos
      modify: boolean,  // Puede modificar antes de crear
      ignore: boolean   // Puede ignorar
    }
  },
  timestamp: string
}
```

**Ejemplo de respuesta real:**
```json
{
  "success": true,
  "message": "Product data retrieved successfully",
  "data": {
    "title": "Auricular Logitech G435",
    "description": "Auricular gaming inalámbrico con micrófono",
    "brand": "Logitech",
    "images": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "source": "upcitemdb",
    "suggested_price": 1500.00,
    "category_suggestion": "Audio",
    "exists_as_product": false,
    "preview_message": "Hemos encontrado: Auricular Logitech G435",
    "available_actions": {
      "accept": true,
      "modify": true,
      "ignore": true
    },
    "cached_at": "2026-02-19T10:30:00Z",
    "provider_response_time": 1200
  },
  "timestamp": "2026-02-19T10:30:05Z"
}
```

### 🔗 Integración con ProductService

**Agregar métodos en ProductService:**
```ts
// En ProductService.ts

// Buscar producto existente por barcode
async getProductByBarcode(barcode: string): Promise<ProductWithCategory | null> {
  return await this.productRepository.findByBarcode(barcode);
}

// Crear producto desde datos de barcode lookup
async createProductFromBarcodeLookup(
  barcode: string,
  lookupData: ProductResult,
  additionalData?: {
    code?: string;
    category_id?: number;
    price?: number;
    stock?: number;
  }
): Promise<Product> {
  // Mapear datos del lookup a CreateProductData
  const productData: CreateProductData = {
    code: additionalData?.code || this.generateCodeFromBarcode(barcode),
    name: lookupData.title,
    description: lookupData.description || null,
    brand: lookupData.brand || null,
    barcode: barcode,
    images: lookupData.images || null,
    category_id: additionalData?.category_id || null,
    price: additionalData?.price || lookupData.suggested_price || 0,
    stock: additionalData?.stock || 0,
    min_stock: 0,
    max_stock: 1000,
    is_active: true
  };

  return await this.createProduct(productData, false); // No sync a WooCommerce automáticamente
}

// Helper para generar código interno desde barcode
private generateCodeFromBarcode(barcode: string): string {
  // Lógica para generar código único (ej: usar últimos dígitos + prefijo)
  return `BC-${barcode.slice(-8)}`;
}
```

**Agregar método en ProductRepository:**
```ts
// En ProductRepository.ts
async findByBarcode(barcode: string): Promise<ProductWithCategory | null> {
  const query = `
    SELECT 
      p.*,
      c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.barcode = ?
    AND p.is_active = 1
    LIMIT 1
  `;
  
  const results = await executeQuery<ProductWithCategory[]>(query, [barcode]);
  return results.length > 0 ? results[0] : null;
}
```

**Nota sobre sincronización con WooCommerce:**
- Los endpoints `accept` y `create` pueden incluir parámetro `sync_to_woocommerce: boolean`
- Por defecto: `false` (no sincronizar automáticamente)
- El usuario puede elegir sincronizar después de crear el producto

### 🗄️ Mejoras en Tabla de Cache

**Agregar campos adicionales:**
```sql
ALTER TABLE barcode_lookup_cache
  ADD COLUMN suggested_price DECIMAL(10,2) NULL,
  ADD COLUMN category_suggestion VARCHAR(100) NULL,
  ADD COLUMN last_used_at TIMESTAMP NULL COMMENT 'Última vez que se consultó',
  ADD COLUMN hit_count INT DEFAULT 0 COMMENT 'Cantidad de veces consultado',
  ADD INDEX idx_barcode_lookup_last_used (last_used_at);
```

**TTL sugerido:**
- Considerar TTL de 30 días para refrescar datos antiguos
- Implementar limpieza automática de registros no usados en 90 días

### 📡 Endpoint Alternativo

**Considerar también:**
- `GET /api/products?barcode=xxx` para mantener consistencia con otros filtros
- Mantener `GET /api/products/barcode/:code` como endpoint principal

**Autorización:**
- Mismo patrón que otros endpoints de productos
- Roles autorizados: `gerencia`, `ventas`, `logistica`, `finanzas`

---

## 🧱 ESTRUCTURA DE CARPETAS A CREAR

src/services/product-resolver/
index.ts
types.ts
providers/
upc.provider.ts
discogs.provider.ts
tienda.provider.ts


---

## 🧠 DISEÑO DE ARQUITECTURA

### 1️⃣ Definir interfaz común

Archivo: types.ts

```ts
export interface ProductResult {
  title: string;
  description?: string;
  brand?: string;
  images?: string[];
  source: string;
  suggested_price?: number; // Precio sugerido si está disponible
  category_suggestion?: string; // Categoría sugerida
}

export interface ProductProvider {
  name: string;
  search(barcode: string): Promise<ProductResult | null>;
}
2️⃣ Crear providers individuales
Cada provider debe:

Implementar ProductProvider

Retornar null si no encuentra resultados

No lanzar excepción si falla

Ejemplo conceptual:

export const upcProvider: ProductProvider = {
  name: "upcitemdb",
  async search(barcode: string) {
    try {
      // llamada axios
      // mapear respuesta a ProductResult
      return mappedResult;
    } catch (error) {
      return null;
    }
  }
};
3️⃣ Crear resolver principal
Archivo: index.ts

**Implementación MEJORADA (Paralela):**

```ts
const providers: ProductProvider[] = [
  upcProvider,
  discogsProvider,
  tiendaProvider
];

export async function resolveProduct(barcode: string) {
  // Ejecutar todos los providers en paralelo
  const results = await Promise.allSettled(
    providers.map(provider => provider.search(barcode))
  );

  // Tomar el primer resultado exitoso
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      return result.value;
    }
  }

  return null;
}
```

**Reglas:**
- ✅ Ejecutar providers en paralelo (MEJORA)
- ✅ Tomar el primer resultado válido que retorne
- ✅ Si todos fallan, retornar null sin lanzar excepción

🗄 CACHE EN BASE DE DATOS

**Crear tabla:**

```sql
CREATE TABLE IF NOT EXISTS `barcode_lookup_cache` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `barcode` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `brand` VARCHAR(100) NULL,
  `images` JSON NULL COMMENT 'Array de URLs de imágenes',
  `source` VARCHAR(50) NOT NULL COMMENT 'Nombre del provider que encontró el dato',
  `raw_json` JSON NULL COMMENT 'Respuesta completa del provider (para debugging)',
  `suggested_price` DECIMAL(10,2) NULL COMMENT 'Precio sugerido si está disponible',
  `category_suggestion` VARCHAR(100) NULL COMMENT 'Categoría sugerida',
  `ignored` TINYINT(1) DEFAULT 0 COMMENT 'Flag si el usuario ignoró estos datos',
  `ignored_at` TIMESTAMP NULL COMMENT 'Fecha en que se ignoró',
  `ignored_by_user_id` INT NULL COMMENT 'ID del usuario que ignoró',
  `last_used_at` TIMESTAMP NULL COMMENT 'Última vez que se consultó',
  `hit_count` INT DEFAULT 0 COMMENT 'Cantidad de veces consultado',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_barcode_unique` (`barcode`),
  INDEX `idx_barcode_lookup_last_used` (`last_used_at`),
  INDEX `idx_barcode_lookup_source` (`source`),
  INDEX `idx_barcode_lookup_ignored` (`ignored`),
  FOREIGN KEY (`ignored_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci 
COMMENT='Cache de búsquedas de códigos de barras desde APIs externas';
```

**Nota:** Esta tabla almacena datos de APIs externas. Los productos ya creados se buscan primero en la tabla `products` existente.

**Comportamiento del flag `ignored`:**
- Si `ignored = 1`: No mostrar preview automáticamente, pero permitir búsqueda manual
- Opcional: Filtrar resultados ignorados en búsquedas normales (solo mostrar si se busca explícitamente)

🔄 FLUJO COMPLETO (MEJORADO CON UX)

### Fase 1: Búsqueda y Preview

**Paso 1:** Cliente escanea código de barras → `GET /api/products/barcode/:code`

**Paso 2:** Validar formato del código de barras (EAN-13, UPC-A, GTIN).

**Paso 3:** Buscar en tabla `products` por `barcode`.
- Si existe → devolver datos del producto + `exists_as_product: true`
- Actualizar `last_used_at` si existe campo en products
- **UX:** Mostrar "Producto ya existe: [nombre]" con opción de ver detalles

**Paso 4:** Si no existe en products, buscar en tabla `barcode_lookup_cache`.
- Si existe → devolver resultado + actualizar `last_used_at` y `hit_count`
- **UX:** Mostrar preview con datos encontrados

**Paso 5:** Si no existe en cache:
- Ejecutar `resolveProduct()` con providers en paralelo (Promise.allSettled)
- Si algún provider devuelve resultado:
  - Guardar en `barcode_lookup_cache`
  - Actualizar `last_used_at` y `hit_count`
  - Devolver respuesta con datos de preview
  - **UX:** Mostrar "Hemos encontrado: [nombre], [descripción], [imagen]"

**Paso 6:** Si todos los providers fallan o retornan null:
- Devolver 404 controlado con mensaje claro
- **UX:** Mostrar "No se encontraron datos para este código de barras"

### Fase 2: Acción del Usuario

**Opción A: ACEPTAR** → `POST /api/products/barcode/:code/accept`
- Crear producto con datos encontrados tal cual
- Asignar categoría y precio si se proporcionan en body
- Retornar producto creado

**Opción B: MODIFICAR** → `POST /api/products/barcode/:code/create`
- Usuario edita campos en el frontend
- Enviar datos modificados en body
- Crear producto con datos editados
- Retornar producto creado

**Opción C: IGNORAR** → `POST /api/products/barcode/:code/ignore`
- Marcar como ignorado (opcional: guardar en cache con flag)
- Retornar confirmación
- No crear producto

📡 ENDPOINTS A CREAR

### 1️⃣ Endpoint de Búsqueda (Preview)

**Ruta principal:**
- `GET /api/products/barcode/:code`

**Ruta alternativa (para consistencia):**
- `GET /api/products?barcode=xxx`

**Propósito:**
- Buscar datos del código de barras
- Devolver datos para **preview** (no crea producto aún)
- Mostrar al usuario: "Hemos encontrado: [nombre], [descripción], [imagen], etc."

**Controller:**
- No contener lógica de scraping.
- Solo orquestar flujo (llamar a ProductService).
- Manejar status codes correctamente:
  - `200`: Datos encontrados (preview disponible)
  - `404`: Código de barras no encontrado
  - `400`: Código de barras inválido
  - `429`: Rate limit excedido
  - `500`: Error interno del servidor

**Autenticación y Autorización:**
- Requiere JWT Bearer Token
- Roles autorizados: `gerencia`, `ventas`, `logistica`, `finanzas`
- Rate limiting: 100 requests/usuario/hora, 10 requests/IP/minuto

### 2️⃣ Endpoint de Aceptar Datos

**Ruta:**
- `POST /api/products/barcode/:code/accept`

**Propósito:**
- Crear o actualizar producto con los datos encontrados
- Usar datos tal cual fueron encontrados (sin modificaciones)

**Body (opcional):**
```json
{
  "category_id": 5,  // Opcional: asignar categoría específica
  "price": 1500.00,  // Opcional: precio inicial
  "stock": 0         // Opcional: stock inicial
}
```

**Response:**
- `200`: Producto creado/actualizado exitosamente
- `400`: Datos inválidos
- `404`: Código de barras no encontrado (debe buscar primero)

### 3️⃣ Endpoint de Modificar y Crear

**Ruta:**
- `POST /api/products/barcode/:code/create`

**Propósito:**
- Crear producto permitiendo modificar los datos encontrados
- El usuario puede editar campos antes de crear

**Body (requerido):**
```json
{
  "name": "Auricular Logitech G435",  // Modificado por usuario
  "description": "Auricular gaming...", // Modificado por usuario
  "brand": "Logitech",
  "images": ["url1", "url2"],
  "category_id": 5,
  "price": 1500.00,
  "stock": 10,
  "barcode": "1234567890123",  // Debe coincidir con :code
  "code": "AUR-LOG-G435"  // Código interno del producto
}
```

**Response:**
- `200`: Producto creado exitosamente
- `400`: Datos inválidos o código ya existe
- `404`: Código de barras no encontrado en cache (debe buscar primero)

### 4️⃣ Endpoint de Ignorar

**Ruta:**
- `POST /api/products/barcode/:code/ignore`

**Propósito:**
- Marcar que el usuario descartó los datos encontrados
- Guardar en cache con flag `ignored: true` para tracking
- Registrar usuario y timestamp de la acción

**Body (opcional):**
```json
{
  "reason": "Datos incorrectos"  // Opcional: razón por la que se ignora
}
```

**Response:**
- `200`: Operación completada
- `404`: Código de barras no encontrado en cache

**Nota:** Este endpoint es útil para analytics y evitar mostrar datos que el usuario ya rechazó.

---

## 🎨 EXPERIENCIA DE USUARIO (UX)

### Flujo Visual en el Frontend

#### 1. Escaneo de Código de Barras

**Pantalla inicial:**
```
┌─────────────────────────────────────┐
│  Escanear Código de Barras          │
│  [________________] [Escanear]      │
│                                     │
│  O usar lector de código de barras  │
└─────────────────────────────────────┘
```

#### 2. Búsqueda en Progreso

**Loading state:**
```
┌─────────────────────────────────────┐
│  🔍 Buscando información...         │
│                                     │
│  [████████░░░░░░░░] 60%            │
└─────────────────────────────────────┘
```

#### 3. Preview de Datos Encontrados

**Cuando se encuentran datos:**
```
┌─────────────────────────────────────┐
│  ✅ Hemos encontrado:                │
│                                     │
│  📦 Auricular Logitech G435         │
│                                     │
│  📝 Descripción:                    │
│  Auricular gaming inalámbrico con   │
│  micrófono                          │
│                                     │
│  🏷️ Marca: Logitech                 │
│  💰 Precio sugerido: $1,500.00      │
│                                     │
│  🖼️ [Imagen del producto]            │
│                                     │
│  ┌─────────┬─────────┬─────────┐   │
│  │ Aceptar │ Modificar│ Ignorar │   │
│  └─────────┴─────────┴─────────┘   │
└─────────────────────────────────────┘
```

#### 4. Opción: Aceptar

**Al hacer clic en "Aceptar":**
- Mostrar modal de confirmación:
```
┌─────────────────────────────────────┐
│  ¿Crear producto con estos datos?   │
│                                     │
│  Nombre: Auricular Logitech G435    │
│  Código interno: [____] (opcional)  │
│  Categoría: [Seleccionar ▼]        │
│  Precio: [$1,500.00]                │
│  Stock inicial: [0]                  │
│                                     │
│  [Cancelar]  [Crear Producto]      │
└─────────────────────────────────────┘
```

- Al confirmar → `POST /api/products/barcode/:code/accept`
- Mostrar mensaje de éxito: "✅ Producto creado exitosamente"

#### 5. Opción: Modificar

**Al hacer clic en "Modificar":**
- Abrir formulario editable con datos prellenados:
```
┌─────────────────────────────────────┐
│  Editar Datos del Producto           │
│                                     │
│  Nombre*:                            │
│  [Auricular Logitech G435        ]  │
│                                     │
│  Descripción:                        │
│  [Auricular gaming inalámbrico...]  │
│  [                                 ] │
│                                     │
│  Marca:                              │
│  [Logitech                        ]  │
│                                     │
│  Código interno*:                   │
│  [AUR-LOG-G435                    ]  │
│                                     │
│  Categoría:                          │
│  [Audio ▼]                          │
│                                     │
│  Precio*:                            │
│  [$1,500.00]                        │
│                                     │
│  Stock inicial:                      │
│  [0]                                │
│                                     │
│  Imágenes:                           │
│  [🖼️ Imagen 1] [🖼️ Imagen 2]        │
│  [+ Agregar imagen]                 │
│                                     │
│  [Cancelar]  [Guardar Producto]    │
└─────────────────────────────────────┘
```

- Al guardar → `POST /api/products/barcode/:code/create`
- Mostrar mensaje de éxito: "✅ Producto creado exitosamente"

#### 6. Opción: Ignorar

**Al hacer clic en "Ignorar":**
- Mostrar confirmación rápida:
```
┌─────────────────────────────────────┐
│  ¿Descartar estos datos?             │
│                                     │
│  [Cancelar]  [Sí, Descartar]        │
└─────────────────────────────────────┘
```

- Al confirmar → `POST /api/products/barcode/:code/ignore`
- Cerrar preview y volver a pantalla de escaneo

#### 7. Producto Ya Existe

**Si el producto ya existe en la base de datos:**
```
┌─────────────────────────────────────┐
│  ℹ️ Este producto ya existe          │
│                                     │
│  📦 Auricular Logitech G435         │
│  Código: AUR-LOG-G435               │
│  Stock: 15 unidades                 │
│                                     │
│  [Ver Detalles]  [Cerrar]          │
└─────────────────────────────────────┘
```

#### 8. No Se Encontraron Datos

**Si no se encuentran datos:**
```
┌─────────────────────────────────────┐
│  ❌ No se encontraron datos         │
│                                     │
│  El código de barras "1234567890123"│
│  no está registrado en nuestras     │
│  bases de datos.                    │
│                                     │
│  Puedes crear el producto            │
│  manualmente:                        │
│                                     │
│  [Crear Manualmente]  [Cerrar]     │
└─────────────────────────────────────┘
```

### Componentes Frontend Sugeridos

**React/Vue/Angular:**
- `BarcodeScanner`: Componente para escanear código
- `BarcodePreview`: Componente para mostrar preview
- `ProductForm`: Formulario editable para modificar datos
- `ActionButtons`: Botones Aceptar/Modificar/Ignorar

### Estados de la Aplicación

```typescript
enum BarcodeSearchState {
  IDLE = 'idle',              // Listo para escanear
  SEARCHING = 'searching',     // Buscando datos
  FOUND = 'found',            // Datos encontrados (mostrar preview)
  EXISTS = 'exists',          // Producto ya existe
  NOT_FOUND = 'not_found',    // No se encontraron datos
  CREATING = 'creating',      // Creando producto (aceptar/modificar)
  SUCCESS = 'success',        // Producto creado exitosamente
  ERROR = 'error'             // Error en la operación
}
```

### Manejo de Errores en UX

**Errores comunes y cómo mostrarlos:**

1. **Código inválido:**
   ```
   ⚠️ El código de barras ingresado no es válido.
   Por favor, verifica el formato (EAN-13, UPC-A, etc.)
   ```

2. **Rate limit excedido:**
   ```
   ⚠️ Has realizado muchas consultas.
   Por favor, espera unos minutos antes de intentar nuevamente.
   ```

3. **Error de red:**
   ```
   ⚠️ Error de conexión.
   Verifica tu conexión a internet e intenta nuevamente.
   ```

4. **Error al crear producto:**
   ```
   ❌ Error al crear el producto.
   El código interno ya existe o hay datos inválidos.
   ```

🛡 CONTROL DE ERRORES

**Manejo de errores en providers:**
- Si un provider falla → continuar con siguiente (usar Promise.allSettled)
- Nunca lanzar error 500 por fallo externo
- Loguear errores en consola o sistema de logs con nivel `warn` o `error`
- Incluir información del provider que falló para debugging

**Validación de entrada:**
- Validar formato del código de barras antes de cualquier consulta
- Rechazar códigos inválidos con error 400 y mensaje claro
- Sanitizar inputs antes de guardar en cache

**Manejo de errores en controller:**
- Errores de validación → 400 Bad Request
- Código no encontrado → 404 Not Found
- Rate limit excedido → 429 Too Many Requests
- Errores internos → 500 Internal Server Error (solo para errores críticos)

🚀 PERFORMANCE

**Ejecución de Providers:**
- ✅ Ejecutar providers en paralelo usando `Promise.allSettled()` (MEJORA)
- Tomar el primer resultado válido que retorne
- Reducir tiempo de respuesta de ~3-5 segundos a ~1-2 segundos

**Optimizaciones:**
- Evitar múltiples requests simultáneas al mismo barcode (implementar lock/mutex)
- Implementar índice UNIQUE en campo `barcode` en ambas tablas (`products` y `barcode_lookup_cache`)
- Índice adicional en `barcode_lookup_cache.last_used_at` para limpieza automática
- Cache en memoria (opcional) para códigos consultados frecuentemente (TTL corto: 5 minutos)

🔮 FUTURO (NO IMPLEMENTAR AHORA)
Clasificación automática por categoría.

Microservicio scraper externo.

Sistema de prioridades por rubro.

Configuración de proveedores por cliente.

📌 CRITERIOS DE ÉXITO

**Funcionalidad:**
- El sistema resuelve correctamente al menos 50–70% de los códigos comunes
- Prioriza productos existentes en la base de datos antes de consultar APIs externas
- Cache funciona correctamente y evita llamadas repetidas

**Performance:**
- Tiempo de respuesta promedio < 2 segundos (con providers en paralelo)
- No genera bloqueos en Vercel o servidor de producción
- No genera consumo excesivo de memoria
- Rate limiting funciona correctamente

**Calidad:**
- Validación de códigos de barras funciona correctamente
- Manejo de errores robusto y no rompe el flujo
- Logs adecuados para debugging
- Es extensible para agregar nuevos providers

**Seguridad:**
- Autenticación JWT requerida
- Rate limiting implementado y funcionando
- Inputs sanitizados antes de guardar en cache

---

## 📋 RESUMEN DE MEJORAS IMPLEMENTADAS

### ✅ Mejoras Principales

1. **Integración con tabla `products` existente**
   - Buscar primero en productos creados antes de consultar APIs externas
   - Reducir llamadas innecesarias a providers

2. **Ejecución paralela de providers**
   - Usar `Promise.allSettled()` en lugar de secuencial
   - Reducir tiempo de respuesta de ~3-5s a ~1-2s

3. **Validación de código de barras**
   - Validar formato antes de consultar providers
   - Soporte para EAN-13, UPC-A, GTIN

4. **Seguridad y rate limiting**
   - Autenticación JWT requerida
   - Rate limiting por usuario e IP
   - Sanitización de inputs

5. **Estructura de respuesta mejorada**
   - Incluir flag `exists_as_product`
   - Agregar `suggested_price` y `category_suggestion`
   - Metadatos de cache y performance

6. **Tabla de cache mejorada**
   - Campos adicionales: `suggested_price`, `category_suggestion`
   - Tracking de uso: `last_used_at`, `hit_count`
   - Flag `ignored` para datos descartados por usuarios
   - Índices optimizados

7. **Manejo de errores robusto**
   - Códigos de estado HTTP apropiados
   - Logging estructurado
   - Validación de entrada

8. **✨ Experiencia de Usuario (UX) Interactiva** ⭐ NUEVO
   - Preview de datos encontrados con mensaje claro
   - Tres acciones disponibles: **Aceptar | Modificar | Ignorar**
   - Endpoints específicos para cada acción
   - Flujo visual completo documentado
   - Manejo de estados y errores en frontend

### 🔄 Cambios en el Flujo Original

**ANTES:**
```
Barcode → Cache → Providers (secuencial) → Resultado → Crear producto
```

**DESPUÉS (con UX):**
```
Barcode → Validación → Products → Cache → Providers (paralelo) 
  → Preview con datos encontrados 
  → Usuario elige: Aceptar | Modificar | Ignorar
  → Crear producto (si acepta/modifica) o descartar (si ignora)
```

### 📊 Impacto Esperado

- **Performance:** ⬆️ 50-60% más rápido (paralelismo)
- **Eficiencia:** ⬆️ Menos llamadas a APIs (priorizar products)
- **UX:** ⬆️⬆️⬆️ Experiencia interactiva mejorada significativamente
  - Usuario tiene control total sobre los datos
  - Preview claro antes de crear producto
  - Opción de modificar datos incorrectos
  - Reducción de errores al crear productos
- **Seguridad:** ⬆️ Rate limiting y validación robusta
- **Adopción:** ⬆️ Mayor facilidad de uso → más usuarios usarán la funcionalidad

### 🎯 Endpoints Implementados

1. `GET /api/products/barcode/:code` - Buscar y obtener preview
2. `POST /api/products/barcode/:code/accept` - Aceptar datos y crear producto
3. `POST /api/products/barcode/:code/create` - Modificar datos y crear producto
4. `POST /api/products/barcode/:code/ignore` - Descartar datos encontrados

---

## 📱 GUÍA DE IMPLEMENTACIÓN PARA FRONTEND

Esta sección contiene toda la información necesaria para que el equipo de frontend implemente correctamente la funcionalidad de autocompletado por código de barras.

---

### 🔍 Uso del buscador de código de barras (incluye Google)

**Importante para el frontend:** El frontend **no llama nunca** a la API de Google. Solo se usa **un único endpoint** de nuestra API:

```
GET /api/products/barcode/:code
```

La API backend consulta en este orden:
1. Productos ya cargados en el sistema  
2. Cache interno  
3. Bases externas (UPCItemDB, Discogs)  
4. **Búsqueda web (Google Custom Search)** — si está configurado en el backend  

Todo eso es transparente: el frontend envía el código y recibe una sola respuesta. No hace falta lógica distinta para “usar Google”.

**Qué hacer en el frontend:**
- Seguir usando solo `GET /api/products/barcode/:code` con el código escaneado o ingresado.
- Leer `data.source` en la respuesta para mostrar de dónde vino el dato (opcional).
- Mostrar `data.preview_message` y el resto de campos como hasta ahora.

**Valores posibles de `data.source`:**
- `"products"` — El producto ya existe en nuestro sistema.
- `"cache"` — Dato obtenido del cache (búsqueda anterior).
- `"upcitemdb"` — Base de datos UPC.
- `"discogs"` — Base Discogs (música).
- `"google"` — **Encontrado vía búsqueda web (Google).** Podés mostrar un texto tipo: *"Encontrado vía búsqueda web"* o *"Datos obtenidos de búsqueda en internet"*.

**Ejemplo de UI según `source`:**
```ts
const sourceLabels: Record<string, string> = {
  products: 'Producto en el sistema',
  cache: 'Datos en caché',
  upcitemdb: 'Base de datos de productos',
  discogs: 'Base de datos de música',
  google: 'Encontrado vía búsqueda web'
};

const label = sourceLabels[data.source] ?? 'Datos encontrados';
// Mostrar junto al preview: "Fuente: Encontrado vía búsqueda web"
```

**Resumen:** Mismo flujo de siempre (un request al buscador de código de barras). La API ya integra Google en el backend; el frontend solo consume la respuesta y puede usar `source` para etiquetar el origen si lo desea.

---

### ⏱️ ¿En qué momento entra Google en la búsqueda?

Cuando usás el buscador de código de barras, la API sigue siempre el mismo flujo. **Google solo se usa si se llega al Paso 3 y los otros proveedores no devuelven resultado.**

| Paso | Qué hace la API | ¿Se llama a Google? |
|------|----------------------------------|----------------------|
| **1** | Busca el código en la tabla **productos** (productos ya cargados en el sistema). | ❌ No. Si encuentra, responde y termina. |
| **2** | Busca el código en la **cache** (búsquedas anteriores). | ❌ No. Si encuentra, responde y termina. |
| **3** | Si no encontró en 1 ni 2, consulta **proveedores externos** (UPCItemDB, Discogs, **Google**, Tienda) **en paralelo**. | ✅ Sí. Google se llama aquí, junto con el resto. |
| **Resultado** | De los que contestan con datos, se toma **uno** (prioridad: UPCItemDB → Discogs → Google → Tienda). Ese resultado se guarda en cache y se devuelve. | El resultado que ves puede ser de Google si los otros no encontraron nada. |

**En la práctica:**

- **Código ya cargado en el sistema** → Respuesta en Paso 1. Google no se usa.
- **Código buscado antes** (está en cache) → Respuesta en Paso 2. Google no se usa.
- **Código nuevo** que no está en productos ni en cache → Se ejecuta Paso 3: se consultan todos los proveedores (incluido Google). Si UPCItemDB o Discogs encuentran algo, se usa ese; si no, se usa el de Google (o el de Tienda) si devuelve resultado.

Por tanto: **Google entra a funcionar solo cuando la búsqueda llega al Paso 3** (ni el producto existe en tu base ni en cache) y, dentro de ese paso, su resultado se usa si los proveedores con mayor prioridad no devolvieron datos.

---

### 🔗 Endpoints Disponibles

#### Base URL
```
http://localhost:8087/api/products/barcode
```
*(Ajustar según el entorno: desarrollo, staging, producción)*

#### Autenticación
Todos los endpoints requieren **JWT Bearer Token** en el header:
```
Authorization: Bearer <token>
```

---

### 1️⃣ Buscar por Código de Barras (Preview)

**Endpoint:** `GET /api/products/barcode/:code`

**Descripción:** Busca datos del producto por código de barras y retorna información para preview.

**Parámetros:**
- `code` (path): Código de barras a buscar (EAN-13, UPC-A, GTIN)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Ejemplo de Request:**
```javascript
GET /api/products/barcode/1234567890123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Datos encontrados exitosamente",
  "data": {
    "title": "Auricular Logitech G435",
    "description": "Auricular gaming inalámbrico con micrófono",
    "brand": "Logitech",
    "images": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "source": "upcitemdb",
    "suggested_price": 1500.00,
    "category_suggestion": "Audio",
    "exists_as_product": false,
    "preview_message": "Hemos encontrado: Auricular Logitech G435",
    "available_actions": {
      "accept": true,
      "modify": true,
      "ignore": true
    },
    "provider_response_time": 1200,
    "cached_at": "2026-02-19T10:30:00Z"
  },
  "timestamp": "2026-02-19T10:30:05.000Z"
}
```

**Respuesta si Producto Ya Existe (200):**
```json
{
  "success": true,
  "message": "Datos encontrados exitosamente",
  "data": {
    "title": "Producto Existente",
    "description": "...",
    "source": "products",
    "exists_as_product": true,
    "product_id": 123,
    "preview_message": "Producto ya existe: Producto Existente",
    "available_actions": {
      "accept": false,
      "modify": false,
      "ignore": false
    }
  }
}
```

**Respuesta si No Encuentra (404):**
```json
{
  "success": false,
  "message": "No se encontraron datos para este código de barras",
  "timestamp": "2026-02-19T10:30:05.000Z"
}
```

**Respuesta si Código Inválido (400):**
```json
{
  "success": false,
  "message": "Formato de código de barras inválido",
  "error": "Formato de código de barras inválido",
  "timestamp": "2026-02-19T10:30:05.000Z"
}
```

---

### 2️⃣ Aceptar Datos y Crear Producto

**Endpoint:** `POST /api/products/barcode/:code/accept`

**Descripción:** Crea un producto usando los datos encontrados tal cual, sin modificaciones.

**Parámetros:**
- `code` (path): Código de barras

**Body (opcional):**
```json
{
  "category_id": 5,
  "price": 1500.00,
  "stock": 10,
  "code": "PROD-001"
}
```

**Campos del Body:**
- `category_id` (number, opcional): ID de categoría a asignar
- `price` (number, opcional): Precio inicial (si no se proporciona, usa `suggested_price` o 0)
- `stock` (number, opcional): Stock inicial (default: 0)
- `code` (string, opcional): Código interno del producto (si no se proporciona, se genera automáticamente)

**Ejemplo de Request:**
```javascript
POST /api/products/barcode/1234567890123/accept
Authorization: Bearer <token>
Content-Type: application/json

{
  "category_id": 5,
  "price": 1500.00,
  "stock": 10
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Producto creado exitosamente",
  "data": {
    "id": 123,
    "code": "BC-89012345",
    "name": "Auricular Logitech G435",
    "description": "Auricular gaming inalámbrico con micrófono",
    "barcode": "1234567890123",
    "price": 1500.00,
    "stock": 10,
    "category_id": 5,
    "images": ["https://example.com/image1.jpg"],
    ...
  },
  "timestamp": "2026-02-19T10:30:05.000Z"
}
```

**Errores Posibles:**
- `400`: Código interno ya existe
- `404`: No se encontraron datos para este código de barras
- `500`: Error interno del servidor

---

### 3️⃣ Modificar Datos y Crear Producto

**Endpoint:** `POST /api/products/barcode/:code/create`

**Descripción:** Crea un producto permitiendo modificar los datos encontrados antes de guardar.

**Parámetros:**
- `code` (path): Código de barras

**Body (requerido):**
```json
{
  "code": "PROD-001",
  "name": "Auricular Logitech G435",
  "description": "Descripción editada por el usuario",
  "price": 1500.00,
  "stock": 10,
  "category_id": 5,
  "barcode": "1234567890123",
  "images": ["https://example.com/image1.jpg"]
}
```

**Campos del Body:**
- `code` (string, **requerido**): Código interno del producto
- `name` (string, **requerido**): Nombre del producto
- `price` (number, **requerido**): Precio del producto
- `description` (string, opcional): Descripción
- `category_id` (number, opcional): ID de categoría
- `stock` (number, opcional): Stock inicial (default: 0)
- `barcode` (string, opcional): Debe coincidir con el parámetro de la URL
- `images` (string[], opcional): Array de URLs de imágenes

**Ejemplo de Request:**
```javascript
POST /api/products/barcode/1234567890123/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "AUR-LOG-G435",
  "name": "Auricular Logitech G435 Gaming",
  "description": "Auricular gaming inalámbrico con micrófono retráctil",
  "price": 1500.00,
  "stock": 10,
  "category_id": 5,
  "barcode": "1234567890123",
  "images": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Producto creado exitosamente",
  "data": {
    "id": 124,
    "code": "AUR-LOG-G435",
    "name": "Auricular Logitech G435 Gaming",
    ...
  }
}
```

**Errores Posibles:**
- `400`: Código interno ya existe o datos inválidos
- `404`: No se encontraron datos para este código de barras (debe buscar primero)
- `500`: Error interno del servidor

---

### 4️⃣ Ignorar Datos Encontrados

**Endpoint:** `POST /api/products/barcode/:code/ignore`

**Descripción:** Marca los datos encontrados como ignorados (para tracking/analytics).

**Parámetros:**
- `code` (path): Código de barras

**Ejemplo de Request:**
```javascript
POST /api/products/barcode/1234567890123/ignore
Authorization: Bearer <token>
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Datos descartados exitosamente",
  "timestamp": "2026-02-19T10:30:05.000Z"
}
```

---

### 📊 Tipos TypeScript para Frontend

```typescript
// Respuesta de búsqueda de barcode
interface BarcodeLookupResponse {
  success: boolean;
  message: string;
  data?: {
    title: string;
    description?: string;
    brand?: string;
    images?: string[];
    source: string;
    suggested_price?: number;
    category_suggestion?: string;
    exists_as_product: boolean;
    product_id?: number;
    preview_message?: string;
    available_actions: {
      accept: boolean;
      modify: boolean;
      ignore: boolean;
    };
    provider_response_time?: number;
    cached_at?: string;
  };
  error?: string;
  timestamp: string;
}

// Request para aceptar datos
interface AcceptBarcodeRequest {
  category_id?: number;
  price?: number;
  stock?: number;
  code?: string;
}

// Request para crear producto con modificaciones
interface CreateProductFromBarcodeRequest {
  code: string;
  name: string;
  description?: string;
  price: number;
  stock?: number;
  category_id?: number;
  barcode?: string;
  images?: string[];
}

// Producto creado
interface Product {
  id: number;
  code: string;
  name: string;
  description?: string;
  barcode?: string;
  price: number;
  stock: number;
  category_id?: number;
  images?: string[];
  created_at: string;
  updated_at: string;
}
```

---

### 🎨 Estados de la Aplicación

```typescript
enum BarcodeSearchState {
  IDLE = 'idle',              // Listo para escanear
  SEARCHING = 'searching',     // Buscando datos
  FOUND = 'found',            // Datos encontrados (mostrar preview)
  EXISTS = 'exists',          // Producto ya existe
  NOT_FOUND = 'not_found',    // No se encontraron datos
  CREATING = 'creating',      // Creando producto (aceptar/modificar)
  SUCCESS = 'success',        // Producto creado exitosamente
  ERROR = 'error'             // Error en la operación
}
```

---

### 🔄 Flujo Completo de Implementación

#### Paso 1: Escanear Código de Barras
```typescript
const handleBarcodeScan = async (barcode: string) => {
  setState(BarcodeSearchState.SEARCHING);
  
  try {
    const response = await fetch(
      `/api/products/barcode/${barcode}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data: BarcodeLookupResponse = await response.json();
    
    if (!response.ok) {
      if (response.status === 404) {
        setState(BarcodeSearchState.NOT_FOUND);
      } else {
        setState(BarcodeSearchState.ERROR);
      }
      return;
    }
    
    if (data.data?.exists_as_product) {
      setState(BarcodeSearchState.EXISTS);
      setProductData(data.data);
    } else if (data.data) {
      setState(BarcodeSearchState.FOUND);
      setPreviewData(data.data);
    }
  } catch (error) {
    setState(BarcodeSearchState.ERROR);
  }
};
```

#### Paso 2: Mostrar Preview y Opciones
```typescript
const PreviewComponent = ({ data }: { data: BarcodeLookupResponse['data'] }) => {
  if (!data) return null;
  
  return (
    <div className="barcode-preview">
      <h3>✅ {data.preview_message}</h3>
      
      <div className="product-info">
        <h4>{data.title}</h4>
        {data.description && <p>{data.description}</p>}
        {data.brand && <p><strong>Marca:</strong> {data.brand}</p>}
        {data.suggested_price && (
          <p><strong>Precio sugerido:</strong> ${data.suggested_price}</p>
        )}
        {data.images && data.images.length > 0 && (
          <img src={data.images[0]} alt={data.title} />
        )}
      </div>
      
      {data.available_actions.accept && (
        <button onClick={handleAccept}>Aceptar</button>
      )}
      {data.available_actions.modify && (
        <button onClick={handleModify}>Modificar</button>
      )}
      {data.available_actions.ignore && (
        <button onClick={handleIgnore}>Ignorar</button>
      )}
    </div>
  );
};
```

#### Paso 3: Aceptar Datos
```typescript
const handleAccept = async (barcode: string, additionalData?: AcceptBarcodeRequest) => {
  setState(BarcodeSearchState.CREATING);
  
  try {
    const response = await fetch(
      `/api/products/barcode/${barcode}/accept`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(additionalData || {})
      }
    );
    
    const result = await response.json();
    
    if (response.ok) {
      setState(BarcodeSearchState.SUCCESS);
      setCreatedProduct(result.data);
      // Mostrar mensaje de éxito y redirigir o limpiar formulario
    } else {
      setState(BarcodeSearchState.ERROR);
      setError(result.message);
    }
  } catch (error) {
    setState(BarcodeSearchState.ERROR);
  }
};
```

#### Paso 4: Modificar y Crear
```typescript
const handleCreateWithModifications = async (
  barcode: string,
  productData: CreateProductFromBarcodeRequest
) => {
  setState(BarcodeSearchState.CREATING);
  
  try {
    const response = await fetch(
      `/api/products/barcode/${barcode}/create`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...productData,
          barcode: barcode // Asegurar que coincida
        })
      }
    );
    
    const result = await response.json();
    
    if (response.ok) {
      setState(BarcodeSearchState.SUCCESS);
      setCreatedProduct(result.data);
    } else {
      setState(BarcodeSearchState.ERROR);
      setError(result.message);
    }
  } catch (error) {
    setState(BarcodeSearchState.ERROR);
  }
};
```

#### Paso 5: Ignorar Datos
```typescript
const handleIgnore = async (barcode: string) => {
  try {
    await fetch(
      `/api/products/barcode/${barcode}/ignore`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Cerrar preview y volver a estado inicial
    setState(BarcodeSearchState.IDLE);
    setPreviewData(null);
  } catch (error) {
    console.error('Error al ignorar:', error);
  }
};
```

---

### ⚠️ Manejo de Errores

```typescript
const handleError = (error: any, response?: Response) => {
  if (!response) {
    // Error de red
    return {
      type: 'network',
      message: 'Error de conexión. Verifica tu conexión a internet.'
    };
  }
  
  switch (response.status) {
    case 400:
      return {
        type: 'validation',
        message: 'Datos inválidos. Verifica el formato del código de barras.'
      };
    case 401:
      return {
        type: 'auth',
        message: 'Sesión expirada. Por favor, inicia sesión nuevamente.'
      };
    case 404:
      return {
        type: 'not_found',
        message: 'No se encontraron datos para este código de barras.'
      };
    case 429:
      return {
        type: 'rate_limit',
        message: 'Has realizado muchas consultas. Espera unos minutos.'
      };
    case 500:
      return {
        type: 'server',
        message: 'Error del servidor. Intenta nuevamente más tarde.'
      };
    default:
      return {
        type: 'unknown',
        message: 'Error desconocido. Contacta al soporte.'
      };
  }
};
```

---

### 🎯 Validación de Código de Barras en Frontend

```typescript
const validateBarcode = (barcode: string): boolean => {
  if (!barcode || typeof barcode !== 'string') {
    return false;
  }
  
  // Remover espacios y guiones
  const cleaned = barcode.replace(/[\s-]/g, '');
  
  // Validar que sea numérico
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }
  
  // Validar longitud (EAN-8, UPC-A, EAN-13, GTIN-14)
  const length = cleaned.length;
  return length === 8 || length === 12 || length === 13 || length === 14;
};

// Usar antes de hacer la búsqueda
const handleBarcodeInput = (barcode: string) => {
  if (!validateBarcode(barcode)) {
    setError('Código de barras inválido. Debe tener 8, 12, 13 o 14 dígitos.');
    return;
  }
  
  handleBarcodeScan(barcode);
};
```

### ⚠️ Manejo Seguro de Valores Opcionales

**IMPORTANTE:** Los campos opcionales pueden ser `null`, `undefined` o venir como strings desde el API. Siempre validar antes de usar métodos como `.toFixed()`:

```typescript
// ❌ INCORRECTO - Causa error si suggested_price es null/undefined
const price = previewData.suggested_price.toFixed(2);

// ✅ CORRECTO - Validar antes de usar
const formatPrice = (price?: number | null): string => {
  if (price == null || typeof price !== 'number') {
    return 'N/A';
  }
  return price.toFixed(2);
};

// Uso:
const displayPrice = formatPrice(previewData.suggested_price);

// O más simple:
const displayPrice = previewData.suggested_price 
  ? Number(previewData.suggested_price).toFixed(2) 
  : 'N/A';

// Para imágenes:
const firstImage = previewData.images && previewData.images.length > 0 
  ? previewData.images[0] 
  : '/placeholder-image.png';

// Para descripción:
const description = previewData.description || 'Sin descripción disponible';
```

---

### 🎨 Componentes Sugeridos

#### 1. BarcodeScanner
```typescript
interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onError }) => {
  // Implementar escáner de código de barras
  // Puede usar librerías como:
  // - html5-qrcode
  // - quagga2
  // - zxing-js
};
```

#### 2. BarcodePreview
```typescript
interface BarcodePreviewProps {
  data: BarcodeLookupResponse['data'];
  onAccept: () => void;
  onModify: () => void;
  onIgnore: () => void;
}

const BarcodePreview: React.FC<BarcodePreviewProps> = ({
  data,
  onAccept,
  onModify,
  onIgnore
}) => {
  if (!data) return null;
  
  return (
    <div className="preview-card">
      <h3>{data.preview_message}</h3>
      {/* Mostrar datos del producto */}
      <div className="actions">
        {data.available_actions.accept && (
          <button onClick={onAccept}>Aceptar</button>
        )}
        {data.available_actions.modify && (
          <button onClick={onModify}>Modificar</button>
        )}
        {data.available_actions.ignore && (
          <button onClick={onIgnore}>Ignorar</button>
        )}
      </div>
    </div>
  );
};
```

#### 3. ProductForm (para Modificar)
```typescript
interface ProductFormProps {
  initialData: BarcodeLookupResponse['data'];
  onSubmit: (data: CreateProductFromBarcodeRequest) => void;
  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({
  initialData,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    code: '',
    name: initialData?.title || '',
    description: initialData?.description || '',
    price: initialData?.suggested_price || 0,
    stock: 0,
    category_id: undefined,
    images: initialData?.images || []
  });
  
  // Formulario editable con campos prellenados
  // ...
};
```

---

### 📱 Consideraciones de UX/UI

1. **Loading States:**
   - Mostrar spinner mientras busca (`SEARCHING`)
   - Mostrar progreso si la búsqueda tarda más de 2 segundos

2. **Feedback Visual:**
   - ✅ Verde para éxito
   - ⚠️ Amarillo para advertencias
   - ❌ Rojo para errores
   - ℹ️ Azul para información

3. **Mensajes al Usuario:**
   - "Buscando información..." (mientras busca)
   - "Hemos encontrado: [nombre]" (cuando encuentra)
   - "Este producto ya existe" (si existe)
   - "No se encontraron datos" (si no encuentra)
   - "Producto creado exitosamente" (después de crear)

4. **Accesibilidad:**
   - Labels descriptivos en botones
   - Mensajes de error claros
   - Soporte para teclado (Enter para buscar, Esc para cancelar)

5. **Performance:**
   - Debounce en input de código de barras (300-500ms)
   - Cache local de resultados recientes
   - Lazy loading de imágenes

---

### 🔐 Seguridad

1. **Tokens:**
   - Guardar token en localStorage o httpOnly cookies
   - Renovar token antes de expirar
   - Manejar logout cuando token expire

2. **Validación:**
   - Validar código de barras antes de enviar
   - Sanitizar inputs antes de crear producto
   - Validar formato de URLs de imágenes

3. **Rate Limiting:**
   - Mostrar mensaje si se excede límite
   - Implementar retry con backoff exponencial

---

### 📚 Recursos Adicionales

- **Documentación de Postman:** Ver `docs/POSTMAN_BARCODE_LOOKUP.md`
- **Guía de Testing:** Ver `docs/BARCODE_LOOKUP_TESTING.md`
- **Setup Backend:** Ver `docs/BARCODE_LOOKUP_SETUP.md`

---

### ✅ Checklist de Implementación Frontend

- [ ] Componente de escáner de código de barras
- [ ] Validación de formato de código de barras
- [ ] Componente de preview con datos encontrados
- [ ] Manejo de estados (IDLE, SEARCHING, FOUND, etc.)
- [ ] Botones de acción (Aceptar, Modificar, Ignorar)
- [ ] Formulario editable para modificar datos
- [ ] Manejo de errores y mensajes al usuario
- [ ] Loading states y feedback visual
- [ ] Integración con autenticación JWT
- [ ] Manejo de productos existentes
- [ ] Manejo seguro de valores opcionales (suggested_price, images, etc.)
- [ ] Pruebas de flujo completo

---

## 🔍 ESTRATEGIAS PARA MEJORAR COBERTURA DE PRODUCTOS NO ENCONTRADOS

### 📊 Situación Actual

El sistema actual tiene limitaciones para productos:
- **Limpieza** (detergentes, desinfectantes, etc.)
- **Electrónica** (cables, adaptadores, estaciones de carga)
- **Decoración** (artículos decorativos, accesorios)
- **Iluminación** (lámparas, focos LED)
- **Productos locales/regionales** (marcas argentinas, productos de importación)

**Problema:** Muchos productos no están en las bases de datos de UPCItemDB o Discogs, pero **sí aparecen en Google Shopping** o tiendas locales cuando se busca por código.

---

### 🎯 Estrategias Propuestas

#### 1️⃣ **Google Custom Search API** (Recomendado)

**Ventajas:**
- ✅ Acceso oficial a resultados de Google
- ✅ Incluye Google Shopping
- ✅ Alta cobertura de productos
- ✅ API oficial (no scraping)

**Implementación:**
```typescript
// Nuevo provider: google.provider.ts
export const googleProvider: ProductProvider = {
  name: 'google',
  
  async search(barcode: string): Promise<ProductResult | null> {
    try {
      const apiKey = process.env.GOOGLE_API_KEY;
      const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
      
      if (!apiKey || !searchEngineId) {
        return null;
      }

      // Buscar en Google Shopping
      const response = await axios.get(
        'https://www.googleapis.com/customsearch/v1',
        {
          params: {
            key: apiKey,
            cx: searchEngineId,
            q: barcode,
            searchType: 'image', // También buscar imágenes
            num: 5
          },
          timeout: 5000
          }
      );

      if (response.data?.items?.length > 0) {
        const item = response.data.items[0];
        return {
          title: item.title,
          description: item.snippet,
          images: [item.link], // Imagen del resultado
          source: 'google',
          // Extraer precio si está disponible en el snippet
          suggested_price: extractPriceFromSnippet(item.snippet)
        };
      }

      return null;
    } catch (error) {
      logger.product.warn(`Error en googleProvider:`, error);
      return null;
    }
  }
};
```

**Setup requerido:**
1. Crear proyecto en Google Cloud Console
2. Habilitar Custom Search API
3. Crear Custom Search Engine (incluir google.com/shopping)
4. Agregar variables de entorno:
   ```
   GOOGLE_API_KEY=tu_api_key
   GOOGLE_SEARCH_ENGINE_ID=tu_search_engine_id
   ```

**Costo:** 100 búsquedas gratis/día, luego $5 por 1000 búsquedas

**Estrategia operativa recomendada (actual):**
- `SERPAPI_KEY` como buscador principal (menos fricción de setup).
- `GOOGLE_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID` como fallback cuando SerpApi falle por cuota/autenticación.

**Variables de entorno sugeridas:**
```env
# Principal
SERPAPI_KEY=tu_serpapi_key

# Fallback opcional
GOOGLE_API_KEY=tu_api_key_google
GOOGLE_SEARCH_ENGINE_ID=tu_search_engine_id
```

---

#### 2️⃣ **Scraping Controlado de Tiendas Locales** (Argentina)

**Tiendas objetivo:**
- `electrostore.com.ar`
- `popinaimportacion.com.ar`
- `mercadolibre.com.ar` (usar API oficial si está disponible)
- Otras tiendas locales conocidas

**Implementación:**
```typescript
// provider: tienda-local.provider.ts
export const tiendaLocalProvider: ProductProvider = {
  name: 'tienda-local',
  
  async search(barcode: string): Promise<ProductResult | null> {
    try {
      // Lista de tiendas a consultar
      const tiendas = [
        'https://electrostore.com.ar',
        'https://popinaimportacion.com.ar'
      ];

      for (const tienda of tiendas) {
        try {
          const response = await axios.get(`${tienda}/buscar`, {
            params: { q: barcode },
            timeout: 3000,
            headers: {
              'User-Agent': 'Mozilla/5.0...'
            }
          });

          const $ = cheerio.load(response.data);
          // Extraer datos del HTML
          const title = $('.product-title').first().text();
          const price = $('.product-price').first().text();
          
          if (title) {
            return {
              title: title.trim(),
              suggested_price: parsePrice(price),
              source: `tienda-local:${tienda}`,
              images: [$('.product-image img').attr('src')].filter(Boolean)
            };
          }
        } catch (error) {
          // Continuar con siguiente tienda
          continue;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }
};
```

**Consideraciones:**
- ⚠️ Respetar `robots.txt`
- ⚠️ Rate limiting (no más de 1 request/segundo por tienda)
- ⚠️ Manejar cambios en estructura HTML
- ⚠️ Solo usar como fallback cuando otros providers fallan

---

#### 3️⃣ **Sistema de Aprendizaje Manual**

**Concepto:** Cuando un producto no se encuentra, permitir al usuario agregar datos manualmente que se guardan en cache para futuras búsquedas.

**Flujo:**
1. Usuario busca código → No encuentra
2. Sistema muestra: "No encontrado. ¿Quieres agregar datos manualmente?"
3. Usuario completa formulario con datos del producto
4. Se guarda en `barcode_lookup_cache` con `source: 'manual'`
5. Próxima búsqueda del mismo código retorna datos manuales

**Endpoint adicional:**
```typescript
// POST /api/products/barcode/:code/manual-add
// Permite agregar datos manualmente cuando no se encuentra
```

**Ventajas:**
- ✅ Mejora progresivamente la base de datos
- ✅ Los usuarios contribuyen con productos locales
- ✅ Sin costo adicional
- ✅ Datos verificados por usuarios

---

#### 4️⃣ **Integración con APIs de E-commerce Argentinas**

**Opciones:**
- **MercadoLibre API:** Si tienen API oficial para búsqueda por código
- **Tienda Nube API:** Para tiendas que usen esta plataforma
- **WooCommerce API:** Para tiendas WooCommerce locales

**Implementación similar a providers existentes**

---

#### 5️⃣ **Fallback: Sugerencia de Búsqueda Manual**

Cuando ningún provider encuentra resultados:

**Respuesta mejorada:**
```json
{
  "success": false,
  "message": "No se encontraron datos para este código de barras",
  "data": {
    "suggestions": {
      "google_search_url": "https://www.google.com/search?q=723540563858",
      "manual_add_available": true,
      "message": "Puedes buscar este código en Google o agregar los datos manualmente"
    }
  }
}
```

**En el frontend:**
```typescript
if (response.status === 404 && response.data.suggestions) {
  // Mostrar botón: "Buscar en Google" que abre nueva pestaña
  // Mostrar botón: "Agregar Manualmente" que abre formulario
}
```

---

### 📋 Plan de Implementación Recomendado

#### Fase 1: Quick Wins (1-2 días)
1. ✅ Agregar manejo seguro de valores opcionales en frontend
2. ✅ Implementar fallback con sugerencia de búsqueda manual
3. ✅ Agregar endpoint para datos manuales

#### Fase 2: Google Custom Search (3-5 días)
1. ✅ Configurar Google Custom Search API
2. ✅ Implementar `google.provider.ts`
3. ✅ Agregar al resolver principal
4. ✅ Testing y ajustes

#### Fase 3: Tiendas Locales (5-7 días)
1. ✅ Identificar tiendas objetivo
2. ✅ Implementar scraping controlado
3. ✅ Agregar rate limiting
4. ✅ Testing con productos reales

#### Fase 4: Sistema de Aprendizaje (3-5 días)
1. ✅ Endpoint para agregar datos manuales
2. ✅ UI para formulario manual
3. ✅ Validación y moderación
4. ✅ Analytics de productos agregados manualmente

---

### 🎯 Priorización

**Alta Prioridad:**
1. **Google Custom Search API** - Mayor cobertura, API oficial
2. **Fallback con sugerencias** - Mejora UX inmediatamente

**Media Prioridad:**
3. **Sistema de aprendizaje manual** - Mejora progresiva
4. **Scraping de tiendas locales** - Requiere mantenimiento

**Baja Prioridad:**
5. **APIs de e-commerce** - Depende de disponibilidad

---

### 💡 Recomendación Inmediata

**Para mejorar la cobertura rápidamente:**

1. **Implementar Google Custom Search API** (mayor impacto)
2. **Agregar fallback con link a Google** (mejora UX)
3. **Permitir agregar datos manualmente** (aprendizaje progresivo)

Esto debería cubrir la mayoría de casos donde Google encuentra el producto pero nuestro sistema no.

---

FIN DEL DOCUMENTO