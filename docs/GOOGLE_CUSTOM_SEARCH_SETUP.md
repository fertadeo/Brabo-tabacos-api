# Setup de Google Custom Search API

Esta guía explica cómo configurar Google Custom Search API para mejorar la cobertura de búsqueda de productos por código de barras.

---

**Para el equipo de frontend:** No tenés que integrar Google ni usar otra API. Seguís usando el mismo endpoint de código de barras: `GET /api/products/barcode/:code`. La API backend usa Google por detrás cuando los otros proveedores no encuentran resultados. Si querés mostrar el origen del dato, usá el campo `data.source` de la respuesta; cuando sea `"google"` podés mostrar *"Encontrado vía búsqueda web"*. Detalles en la sección **"Uso del buscador de código de barras (incluye Google)"** de `docs/AUTOCOMPLETADO_PRODUCTOS.md`.

---

## ⚠️ Cambio Importante de Google

**Google ha deshabilitado la función "Buscar en toda la Web"** en Custom Search Engine. Ahora es **obligatorio** especificar sitios específicos donde buscar.

**Impacto:**
- ✅ **Ventaja:** Resultados más relevantes y enfocados
- ⚠️ **Limitación:** Solo buscará en los sitios que configures
- 💡 **Solución:** Incluye `google.com/shopping` y `*.com.ar` para máxima cobertura

**Sitios recomendados para configurar:**
- `google.com/shopping` ⭐ **ESENCIAL** - Incluye resultados de Google Shopping
- `*.com.ar` - Todos los sitios argentinos
- `mercadolibre.com.ar` - MercadoLibre Argentina
- Tiendas locales específicas que uses frecuentemente

---

## 🎯 Objetivo

Integrar Google Custom Search API para encontrar productos que no están en las bases de datos tradicionales (UPCItemDB, Discogs), especialmente:
- Productos de limpieza
- Electrónica (cables, adaptadores, estaciones de carga)
- Decoración
- Iluminación
- Productos locales/regionales argentinos

---

## 📋 Paso 1: Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Nombra el proyecto (ej: "MFComputers Barcode Search")

---

## 🔑 Paso 2: Habilitar Custom Search API

1. En el menú lateral, ve a **APIs & Services** > **Library**
2. Busca "Custom Search API"
3. Haz clic en **Enable**

---

## 🔍 Paso 3: Crear Custom Search Engine

**⚠️ IMPORTANTE:** Google ha deshabilitado la opción "Buscar en toda la Web". Ahora debemos especificar sitios específicos.

1. Ve a [Programmable Search Engine](https://programmablesearchengine.google.com/)
2. Haz clic en **Add** para crear un nuevo motor de búsqueda
3. Configuración inicial:
   - **Sites to search:** Agrega los siguientes sitios (uno por línea):
     ```
     google.com/shopping
     *.com.ar
     mercadolibre.com.ar
     amazon.com
     ```
   - **Nota:** `*.com.ar` cubrirá todos los sitios argentinos (electrostore.com.ar, popinaimportacion.com.ar, etc.)
   - **Name:** "Barcode Product Search"
   - **Language:** Spanish (Español)
   - **Image search:** Habilitado
4. Haz clic en **Create**
5. Ve a **Setup** > **Basics**
6. **Configuración de sitios:**
   - En **Sites to search**, agrega más sitios específicos si lo deseas:
     - `electrostore.com.ar`
     - `popinaimportacion.com.ar`
     - `fravega.com.ar`
     - `garbarino.com.ar`
     - O cualquier otra tienda local que uses frecuentemente
7. **Habilitar búsqueda ampliada:**
   - Ve a **Setup** > **Advanced**
   - En **Search features**, habilita:
     - ✅ **Image search** (Búsqueda por imágenes)
     - ✅ **Safe search** (Búsqueda segura)
8. Guarda los cambios

**Nota:** Aunque no puedas buscar en "toda la web", al incluir `google.com/shopping` y `*.com.ar` obtendrás resultados de Google Shopping y sitios argentinos, que cubren la mayoría de productos locales.

---

## 🔐 Paso 4: Obtener Credenciales

### API Key

1. En Google Cloud Console, ve a **APIs & Services** > **Credentials**
2. Haz clic en **Create Credentials** > **API Key**
3. **Copia la API Key generada** (formato: `AIzaSy...`)
   - Haz clic en el ícono de copiar junto al campo de la API Key
   - Guárdala de forma segura (la necesitarás para el `.env`)

4. **🔒 RESTRINGIR LA API KEY (RECOMENDADO):**
   
   Google mostrará una advertencia amarilla indicando que la clave no tiene restricciones. Es **altamente recomendable** restringirla por seguridad.
   
   **Pasos para restringir:**
   
   a) **Haz clic en "Agregar restricciones"** (botón en la advertencia amarilla)
   
   O alternativamente:
   
   b) Haz clic en el nombre de la API Key creada para editarla
   
   c) En la sección **"Restricciones de API"**:
      - Selecciona **"Restringir clave"**
      - En el dropdown **"Seleccionar API"**, busca y selecciona solo:
        - ✅ **Custom Search API**
      - **NO selecciones otras APIs** (esto evitará uso no autorizado)
   
   d) (Opcional) En **"Restricciones de aplicación"**:
      - Puedes dejar **"Ninguna"** para desarrollo
      - O restringir por **Direcciones IP** si conoces las IPs de tus servidores
      - O restringir por **Referrers HTTP** si la API se usa desde un frontend específico
   
   e) Haz clic en **"Guardar"** al final de la página
   
   **⚠️ Nota:** Si restringes por IP o Referrer, asegúrate de incluir todas las ubicaciones desde donde usarás la API (servidor de producción, servidor de desarrollo, etc.)

**¿Por qué restringir?**
- Previene uso no autorizado si la clave se filtra
- Reduce costos si alguien intenta usar tu clave
- Mejora la seguridad general del proyecto

### Search Engine ID

1. En [Programmable Search Engine](https://programmablesearchengine.google.com/)
2. Selecciona tu motor de búsqueda creado
3. Ve a **Setup** > **Basics**
4. Copia el **Search engine ID** (formato: `xxxxxxxxxxxxxxxxxxxxxxxxx:xxxxxxxxxx`)
5. **Verifica los sitios configurados:** Asegúrate de que tengas al menos:
   - `google.com/shopping` (para Google Shopping)
   - `*.com.ar` (para sitios argentinos)
   - Otros sitios de e-commerce que uses frecuentemente

---

## ⚙️ Paso 5: Configurar Variables de Entorno

### ¿Dónde van las variables?

**✅ En la API (backend)** — Las claves van **solo en el servidor de la API**, no en el frontend.

| Dónde | ¿Agregar las variables? |
|-------|---------------------------|
| **API** (`.env` del proyecto mfcomputers-API) | ✅ **SÍ** — Aquí es donde se usan |
| **Vercel / Frontend** (variables de entorno del sitio web) | ❌ **NO** — Nunca expongas estas claves en el cliente |

**Motivo:** El provider de Google Custom Search corre en el backend (`src/services/product-resolver/providers/google.provider.ts`). El frontend solo llama a `GET /api/products/barcode/:code`; quien llama a Google es la API. Si pusieras las claves en el frontend, quedarían expuestas en el navegador y cualquiera podría usarlas.

**Resumen:**
- **Desarrollo:** archivo `.env` en la raíz del proyecto de la **API** (mfcomputers-API)
- **Producción:** variables de entorno del **servicio donde corre la API** (Vercel Serverless, Railway, Render, etc.), no del proyecto frontend en Vercel

---

### Variables a configurar

En el **proyecto de la API** (no en el frontend), agrega:

**Archivo `.env` (desarrollo local):**
```env
# Google Custom Search API
GOOGLE_API_KEY=tu_api_key_aqui
GOOGLE_SEARCH_ENGINE_ID=tu_search_engine_id_aqui
```

**Ejemplo:**
```env
GOOGLE_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_SEARCH_ENGINE_ID=012345678901234567890:abcdefghijk
```

**Si desplegás la API en Vercel:** agregá estas mismas variables en **Project Settings > Environment Variables** del **proyecto de la API** en Vercel, no del proyecto del frontend.

---

## ✅ Paso 6: Verificar Configuración

1. Reinicia el servidor de la API
2. Prueba buscar un código de barras que no esté en otras bases de datos
3. Verifica en los logs que el provider de Google se ejecute:
   ```
   [ProductService] INFO: Producto resuelto por google en XXXXms
   ```

---

## 💰 Costos y Límites

### Cuota Gratuita
- **100 búsquedas por día** gratis
- Después de eso: **$5 USD por cada 1,000 búsquedas**

### Límites
- Máximo 10,000 búsquedas por día (con facturación habilitada)
- Rate limit: ~10 búsquedas por segundo

### Recomendaciones
- El sistema actual usa Google como **fallback** (solo si otros providers fallan)
- Esto minimiza el uso de la cuota
- Para producción, considera habilitar facturación para aumentar límites

---

## 🧪 Pruebas

### Test Manual con curl

```bash
curl "https://www.googleapis.com/customsearch/v1?key=TU_API_KEY&cx=TU_SEARCH_ENGINE_ID&q=723540563858"
```

### Test desde la API

```bash
GET /api/products/barcode/723540563858
Authorization: Bearer <token>
```

Deberías ver en la respuesta:
```json
{
  "source": "google",
  "title": "...",
  ...
}
```

---

## 🔧 Troubleshooting

### Error: "API key not valid"
- Verifica que la API Key esté correcta en `.env`
- Asegúrate de que Custom Search API esté habilitada en el proyecto
- **Si restringiste la API Key:**
  - Verifica que **Custom Search API** esté en la lista de APIs permitidas
  - Si restringiste por IP, asegúrate de que la IP del servidor esté en la lista
  - Si restringiste por Referrer, verifica que el dominio esté correcto
- **Solución temporal:** Puedes quitar temporalmente las restricciones para probar, pero **vuelve a agregarlas después**

### Error: "Custom Search Engine ID not found"
- Verifica que el Search Engine ID esté correcto
- Asegúrate de que el motor de búsqueda tenga sitios configurados (al menos `google.com/shopping` y `*.com.ar`)

### Error: "Quota exceeded"
- Has alcanzado el límite de 100 búsquedas/día
- Espera hasta el día siguiente o habilita facturación

### No encuentra resultados
- **Verifica los sitios configurados:** Asegúrate de tener `google.com/shopping` y `*.com.ar` en la lista
- Algunos códigos pueden no tener resultados en los sitios configurados
- Si un producto está en un sitio no configurado, no aparecerá en los resultados
- **Solución:** Agrega más sitios específicos a tu Custom Search Engine si encuentras productos en tiendas que no están incluidas
- El provider retorna `null` silenciosamente si no encuentra nada

---

## 📊 Monitoreo de Uso

### Ver uso en Google Cloud Console

1. Ve a **APIs & Services** > **Dashboard**
2. Selecciona **Custom Search API**
3. Revisa el gráfico de uso

### Ver en logs de la aplicación

El sistema registra cuando Google encuentra productos:
```
[ProductService] INFO: Producto resuelto por google en 1200ms
```

---

## 🎯 Optimización

### Mejorar resultados

1. **Configurar sitios específicos (OBLIGATORIO ahora):**
   - En el Custom Search Engine, agrega sitios específicos:
     - `google.com/shopping` ⭐ **ESENCIAL** - Incluye resultados de Google Shopping
     - `mercadolibre.com.ar` - MercadoLibre Argentina
     - `*.com.ar` - Todos los sitios argentinos
     - `amazon.com` - Amazon (si buscas productos internacionales)
     - Tiendas locales específicas que uses frecuentemente:
       - `electrostore.com.ar`
       - `popinaimportacion.com.ar`
       - `fravega.com.ar`
       - `garbarino.com.ar`
       - Cualquier otra tienda donde encuentres productos

2. **Agregar sitios dinámicamente:**
   - Si encuentras productos en una tienda nueva, agrega el dominio a tu Custom Search Engine
   - Ve a **Setup** > **Basics** > **Sites to search**
   - Agrega el nuevo dominio y guarda

2. **Ajustar parámetros en el provider:**
   - Modificar `num` (número de resultados)
   - Ajustar timeout
   - Priorizar ciertos dominios

---

## 📚 Recursos

- [Google Custom Search API Documentation](https://developers.google.com/custom-search/v1/overview)
- [Programmable Search Engine](https://programmablesearchengine.google.com/)
- [Google Cloud Console](https://console.cloud.google.com/)

---

## ✅ Checklist

- [ ] Proyecto creado en Google Cloud Console
- [ ] Custom Search API habilitada
- [ ] Custom Search Engine creado
- [ ] **Sitios configurados:** `google.com/shopping` y `*.com.ar` agregados
- [ ] Sitios adicionales agregados (tiendas locales conocidas)
- [ ] Image search habilitado
- [ ] Safe search habilitado
- [ ] API Key obtenida
- [ ] Search Engine ID obtenido
- [ ] Variables de entorno configuradas en `.env`
- [ ] Servidor reiniciado
- [ ] Prueba exitosa con código de barras

## ⚠️ Limitaciones Actuales

Debido a que Google deshabilitó "Buscar en toda la Web", el Custom Search Engine solo buscará en los sitios que especifiques. Esto significa:

**✅ Ventajas:**
- Resultados más relevantes y enfocados
- Mejor control sobre las fuentes
- Puedes priorizar tiendas locales

**❌ Limitaciones:**
- Si un producto está en un sitio no configurado, no aparecerá
- Necesitas agregar sitios manualmente si encuentras productos en nuevas tiendas
- La cobertura depende de qué sitios hayas configurado

**💡 Recomendación:**
- Incluye siempre `google.com/shopping` (cubre muchos productos)
- Agrega `*.com.ar` para sitios argentinos
- Agrega tiendas específicas que uses frecuentemente
- Revisa periódicamente y agrega nuevos sitios según necesidad

---

¡Listo! Google Custom Search API está configurado y funcionando. El sistema ahora buscará automáticamente en Google cuando otros providers no encuentren resultados.
