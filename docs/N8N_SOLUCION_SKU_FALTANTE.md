# 🔧 Solución: Error "SKU es requerido para cada producto" en N8N

## 📋 Problema

Al enviar productos desde WooCommerce al ERP FENEC a través del endpoint `/api/woocommerce/products/sync`, recibes un error 400 indicando que algunos productos no tienen SKU:

```
"SKU es requerido para cada producto"
Path: products[22].sku, products[42].sku, products[43].sku, etc.
```

## ✅ Solución: Filtrar Productos sin SKU

Antes de enviar los datos al endpoint del ERP, debes **filtrar los productos que no tienen SKU**. Aquí te muestro cómo hacerlo en N8N:

### Opción 1: Usando Nodo Code (Recomendado)

Agrega un nodo **Code** entre el nodo que obtiene los productos de WooCommerce y el nodo **HTTP Request** que envía al ERP.

#### Configuración del Nodo Code:

1. **Name**: `Filtrar Productos con SKU`
2. **Mode**: `Run Once for All Items`

#### Código JavaScript:

**IMPORTANTE:** Si tus datos vienen con la estructura `[{ "products": [...] }]`, usa este código:

```javascript
// Obtener todos los items del nodo anterior
const items = $input.all();

// Extraer todos los productos de todos los items
let todosLosProductos = [];
items.forEach(item => {
  // Si el item tiene un array "products", extraer esos productos
  if (item.json.products && Array.isArray(item.json.products)) {
    todosLosProductos = todosLosProductos.concat(item.json.products);
  } else if (Array.isArray(item.json)) {
    // Si el item.json es directamente un array de productos
    todosLosProductos = todosLosProductos.concat(item.json);
  } else if (item.json.sku) {
    // Si el item es directamente un producto
    todosLosProductos.push(item.json);
  }
});

// Filtrar productos que tengan SKU válido (no vacío ni null, y sin solo espacios)
const productosConSKU = todosLosProductos
  .filter(producto => {
    // Verificar que tenga SKU y que no esté vacío después de quitar espacios
    const sku = (producto.sku || producto.SKU || '').toString().trim();
    return sku !== '';
  })
  .map(producto => {
    // Limpiar SKU (quitar espacios al inicio y final)
    const sku = (producto.sku || producto.SKU || '').toString().trim();
    
    return {
      sku: sku,
      stock_quantity: producto.stock_quantity || producto.stock || 0,
      price: producto.price || producto.regular_price || 0,
      name: producto.name || '',
      status: producto.status || 'publish',
      description: producto.description || '',
      images: producto.images || []
    };
  });

// Preparar el body para el POST al ERP
return {
  json: {
    products: productosConSKU
  }
};
```

**Si tus datos vienen directamente como array de productos** `[{ "sku": "...", ... }, ...]`, usa este código más simple:

```javascript
// Obtener todos los items del nodo anterior
const items = $input.all();

// Filtrar productos que tengan SKU válido (no vacío ni null)
const productosConSKU = items
  .map(item => item.json)
  .filter(producto => {
    // Verificar que tenga SKU y que no esté vacío después de quitar espacios
    const sku = (producto.sku || producto.SKU || '').toString().trim();
    return sku !== '';
  })
  .map(producto => {
    // Limpiar SKU (quitar espacios al inicio y final)
    const sku = (producto.sku || producto.SKU || '').toString().trim();
    
    return {
      sku: sku,
      stock_quantity: producto.stock_quantity || producto.stock || 0,
      price: producto.price || producto.regular_price || 0,
      name: producto.name || '',
      status: producto.status || 'publish',
      description: producto.description || '',
      images: producto.images || []
    };
  });

// Preparar el body para el POST al ERP
return {
  json: {
    products: productosConSKU
  }
};
```

#### Nota sobre el Output:

El nodo Code devuelve un objeto con la estructura `{ json: { products: [...] } }`. 

Si tu nodo HTTP Request espera recibir directamente el array, ajusta el código para que devuelva:

```javascript
// ... (código anterior de filtrado)

// Si el nodo HTTP Request espera recibir directamente el objeto con products
return productosConSKU.map(producto => ({
  json: producto
}));
```

Y luego en el nodo HTTP Request, configura el body como:

```json
{
  "products": {{$json}}
}
```

O mejor aún, agrega otro nodo **Set** después del Code para formatear correctamente:

### Opción 2: Usando Nodo Set + Code (Más Completo)

#### Paso 1: Nodo Code (Filtrar)

**Name**: `Filtrar Productos con SKU`
**Mode**: `Run Once for All Items`

```javascript
// Obtener todos los items
const items = $input.all();

// Filtrar productos con SKU válido
const productosValidos = items
  .map(item => item.json)
  .filter(producto => {
    const sku = producto.sku || producto.SKU;
    return sku && sku.toString().trim() !== '';
  });

// Mapear a formato esperado por el ERP
return productosValidos.map(producto => ({
  json: {
    sku: producto.sku || producto.SKU,
    stock_quantity: producto.stock_quantity || producto.stock || 0,
    price: producto.price || producto.regular_price || 0,
    name: producto.name || '',
    status: producto.status || 'publish',
    description: producto.description || '',
    images: producto.images || []
  }
}));
```

#### Paso 2: Nodo Set (Agrupar en Array)

**Name**: `Agrupar Productos para POST`
**Mode**: `Run Once for All Items`
**Keep Only Set Fields**: `false`

**JavaScript Code** (en "Options" → "Keep Only Set Fields" = false, luego usa JavaScript):

```javascript
const items = $input.all();
const products = items.map(item => item.json);

return {
  json: {
    products: products
  }
};
```

O simplemente en el nodo HTTP Request, configura el body usando:

**Body Content Type**: `JSON`
**Specify Body**: `Using JSON`
**JSON**:
```json
{
  "products": {{JSON.stringify($input.all().map(item => item.json))}}
}
```

#### Paso 3: Nodo HTTP Request (Enviar al ERP)

**Method**: `POST`
**URL**: `{{$credentials.Norte_ERP_API.baseUrl}}/woocommerce/products/sync`
**Authentication**: `Header Auth` → `Norte ERP API`
**Body Content Type**: `JSON`
**Specify Body**: `Using JSON`
**JSON**: 
```json
{{$json}}
```

### Opción 3: Agregar Logging para Debug

Si quieres ver qué productos se están filtrando, agrega logging:

```javascript
// Obtener todos los items
const items = $input.all();
const totalProductos = items.length;

// Filtrar productos con SKU válido
const productosConSKU = [];
const productosSinSKU = [];

items.forEach(item => {
  const producto = item.json;
  const sku = producto.sku || producto.SKU;
  
  if (sku && sku.toString().trim() !== '') {
    productosConSKU.push({
      sku: sku,
      stock_quantity: producto.stock_quantity || producto.stock || 0,
      price: producto.price || producto.regular_price || 0,
      name: producto.name || '',
      status: producto.status || 'publish',
      description: producto.description || '',
      images: producto.images || []
    });
  } else {
    productosSinSKU.push({
      name: producto.name || 'Sin nombre',
      id: producto.id || 'N/A'
    });
  }
});

// Log para debugging (aparece en Execution Log de n8n)
console.log(`Total productos: ${totalProductos}`);
console.log(`Productos con SKU: ${productosConSKU.length}`);
console.log(`Productos sin SKU (filtrados): ${productosSinSKU.length}`);

if (productosSinSKU.length > 0) {
  console.log('Productos filtrados por falta de SKU:', JSON.stringify(productosSinSKU, null, 2));
}

// Preparar resultado
return {
  json: {
    products: productosConSKU,
    _metadata: {
      total_recibidos: totalProductos,
      total_enviados: productosConSKU.length,
      total_filtrados: productosSinSKU.length
    }
  }
};
```

## 🔍 Verificar Estructura de Datos

Antes de aplicar el filtro, verifica qué estructura tienen tus datos. Agrega un nodo **Set** temporal para ver los datos:

**Name**: `Debug - Ver Estructura`
**Keep Only Set Fields**: `false`

Luego ejecuta manualmente el workflow y revisa el **Execution Log** para ver la estructura exacta de los datos que llegan de WooCommerce.

## 📝 Formato Esperado por el Endpoint

El endpoint `/api/woocommerce/products/sync` espera:

```json
{
  "products": [
    {
      "sku": "6950376778369",           // REQUERIDO - No puede estar vacío
      "stock_quantity": 10,              // Opcional - Numérico
      "price": 99.99,                    // Opcional
      "name": "Nombre del producto",     // Opcional
      "status": "publish",               // Opcional
      "description": "Descripción",      // Opcional
      "images": ["url1", "url2"]         // Opcional
    }
  ]
}
```

## ⚠️ Posibles Causas de Productos sin SKU

1. **Productos creados en WooCommerce sin SKU**: Algunos productos pueden haberse creado manualmente sin SKU
2. **Productos variables**: Los productos variables en WooCommerce pueden no tener SKU a nivel padre
3. **Importación masiva**: Si importaste productos masivamente, algunos pueden no tener SKU asignado
4. **Transformación incorrecta**: La expresión `{{$json}}` puede no estar extrayendo correctamente el SKU

## ✅ Verificación Post-Solución

Después de aplicar el filtro:

1. ✅ **Ejecuta el workflow manualmente** y verifica que no haya errores 400
2. ✅ **Revisa el Execution Log** para ver cuántos productos se filtraron
3. ✅ **Verifica en el ERP** que los productos se hayan sincronizado correctamente
4. ✅ **Monitorea los primeros días** para asegurarte de que todos los productos válidos se procesen

## 🎯 Recomendación Final

**Usa la Opción 1 (Nodo Code)** porque:
- ✅ Es simple y directa
- ✅ Filtra automáticamente productos inválidos
- ✅ Normaliza el formato de datos
- ✅ Fácil de mantener y debuggear

## 📞 Si el Problema Persiste

Si después de aplicar el filtro sigues teniendo problemas:

1. Revisa el **Execution Log** en n8n para ver exactamente qué datos se están enviando
2. Verifica en **WooCommerce** qué productos tienen SKU vacío
3. Revisa los **logs del ERP** para ver el error exacto
4. Compara el formato de los datos enviados con el formato esperado por el endpoint
