# Crear API Key para n8n

Este documento explica cómo crear una API Key genérica para usar con n8n y traer productos desde WooCommerce.

## ¿Por qué necesito esto?

Las rutas para crear API Keys (`POST /api/api-keys`) requieren autenticación JWT con roles `admin` o `gerencia`. Si no puedes crear la API Key desde Postman, este script te permite crearla directamente en la base de datos.

## Opción 1: Script Automático (Recomendado)

Ejecuta el script que crea automáticamente la API Key si no existe:

```bash
npm run init:n8n-key
```

Este script:
- ✅ Verifica si ya existe una API Key activa para n8n
- ✅ Si no existe, crea una nueva automáticamente
- ✅ Muestra la API Key generada (⚠️ guárdala de forma segura, solo se muestra una vez)

### Ejemplo de salida:

```
🚀 Script para crear API Key de n8n

✅ Conexión a la base de datos establecida

⚠️  No se encontró ninguna API Key activa para n8n.
🔨 Creando API Key para n8n...
✅ API Key para n8n creada exitosamente!
📋 API Key generada:
   fnec_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz

=== ✅ API KEY GENERADA EXITOSAMENTE ===

API Key:
fnec_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz

=== IMPORTANTE ===
⚠️  Guarda esta API Key de forma segura.
📝 Usa esta API Key en n8n para sincronizar productos desde WooCommerce.
🔗 Esta API Key se puede usar en el header X-API-Key de tus peticiones HTTP.
```

## Opción 2: Desde TypeScript directamente

Si prefieres ejecutar el script directamente con ts-node:

```bash
npx ts-node scripts/create-n8n-api-key.ts
```

## Usar la API Key en n8n

Una vez que tengas la API Key, úsala en n8n de la siguiente manera:

### En peticiones HTTP de n8n:

1. **Header**: `X-API-Key`
2. **Valor**: La API Key generada (ejemplo: `fnec_abc123def456...`)

### Ejemplo en n8n (HTTP Request Node):

```
Method: GET
URL: https://tu-dominio.com/api/products
Headers:
  X-API-Key: fnec_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
  Content-Type: application/json
```

### Ejemplo en Postman:

```
GET https://tu-dominio.com/api/products
Headers:
  X-API-Key: fnec_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
  Content-Type: application/json
```

## Características de la API Key generada

- **Nombre**: `n8n WooCommerce Sync`
- **Descripción**: API Key para sincronización automática de productos desde WooCommerce mayorista con n8n
- **Límites**:
  - 60 peticiones por minuto
  - 1000 peticiones por hora
- **Expiración**: Sin expiración (puedes cambiarlo después desde el endpoint PUT /api/api-keys/:id)
- **Metadatos**: 
  ```json
  {
    "integration": "n8n",
    "purpose": "woocommerce_product_sync",
    "store": "mayorista"
  }
  ```

## Verificar API Keys existentes

Si quieres ver todas las API Keys existentes (desde Postman autenticado):

```http
GET /api/api-keys
Authorization: Bearer <tu_jwt_token>
```

## Solución de problemas

### "API Key para n8n ya existe"

Si el script indica que ya existe una API Key activa, puedes:

1. **Desactivarla** (si quieres crear una nueva):
   ```http
   DELETE /api/api-keys/:id
   Authorization: Bearer <tu_jwt_token>
   ```

2. **Obtener la API Key existente**: Consulta la base de datos directamente o usa el endpoint GET /api/api-keys (requiere autenticación JWT)

### "No se pudo conectar a la base de datos"

Verifica que las variables de entorno estén configuradas correctamente en tu archivo `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=mfcomputers
```

## Notas importantes

- ⚠️ **La API Key solo se muestra una vez** cuando se crea. Guárdala de forma segura.
- 🔒 **No compartas la API Key** públicamente ni la subas a repositorios de código.
- 📝 **Usa variables de entorno** en n8n para almacenar la API Key de forma segura.
- 🔄 Si necesitas rotar la API Key, desactiva la antigua y crea una nueva.
