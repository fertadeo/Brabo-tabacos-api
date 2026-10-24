# 🗄️ Migración: Crear Tablas de API Keys

## 📋 Instrucciones para Ejecutar la Migración

### Opción 1: Desde el Servidor (Recomendado)

1. **Conecta al servidor via SSH:**
   ```bash
   ssh usuario@servidor
   ```

2. **Navega al directorio del proyecto:**
   ```bash
   cd /home/fenecstudio/norte-erp-api
   ```

3. **Ejecuta la migración directamente con MySQL:**
   ```bash
   mysql -u fenecstudio-remote -p -h 149.50.139.91 norte_erp_db < src/database/migration_api_keys.sql
   ```
   
   Te pedirá la contraseña: `FENEC2024@`

### Opción 2: Desde MySQL Client

1. **Conecta a MySQL:**
   ```bash
   mysql -u fenecstudio-remote -p -h 149.50.139.91 norte_erp_db
   ```
   
   Contraseña: `FENEC2024@`

2. **Copia y pega el contenido del archivo `src/database/migration_api_keys.sql`**

3. **O ejecuta directamente:**
   ```sql
   source /home/fenecstudio/norte-erp-api/src/database/migration_api_keys.sql
   ```

### Opción 3: Desde phpMyAdmin o Adminer

1. Accede a tu panel de administración de MySQL
2. Selecciona la base de datos: `norte_erp_db`
3. Ve a la pestaña "SQL"
4. Copia y pega el contenido completo de `src/database/migration_api_keys.sql`
5. Ejecuta

---

## ✅ Verificar que las Tablas se Crearon

### Desde MySQL:

```sql
-- Verificar que las tablas existen
SHOW TABLES LIKE 'api_keys';
SHOW TABLES LIKE 'api_key_logs';

-- Ver estructura de api_keys
DESCRIBE api_keys;

-- Ver estructura de api_key_logs
DESCRIBE api_key_logs;
```

### Desde línea de comandos:

```bash
mysql -u fenecstudio-remote -p -h 149.50.139.91 norte_erp_db -e "SHOW TABLES LIKE 'api_keys';"
mysql -u fenecstudio-remote -p -h 149.50.139.91 norte_erp_db -e "SHOW TABLES LIKE 'api_key_logs';"
```

---

## 🔍 Verificar Estructura de las Tablas

### Tabla `api_keys` debe tener:

- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `key_name` (VARCHAR(100))
- `api_key` (VARCHAR(255), UNIQUE)
- `key_hash` (VARCHAR(255))
- `description` (TEXT)
- `created_by` (INT, FOREIGN KEY → users)
- `is_active` (BOOLEAN)
- `last_used_at` (TIMESTAMP)
- `expires_at` (TIMESTAMP)
- `rate_limit_per_minute` (INT)
- `rate_limit_per_hour` (INT)
- `allowed_ips` (TEXT)
- `metadata` (JSON)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Tabla `api_key_logs` debe tener:

- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `api_key_id` (INT, FOREIGN KEY → api_keys)
- `endpoint` (VARCHAR(255))
- `method` (VARCHAR(10))
- `ip_address` (VARCHAR(45))
- `user_agent` (TEXT)
- `response_status` (INT)
- `response_time_ms` (INT)
- `created_at` (TIMESTAMP)

---

## ⚠️ Solución de Problemas

### Error: "Table already exists"

Si las tablas ya existen pero están vacías o mal configuradas:

```sql
-- Eliminar tablas existentes (CUIDADO: esto elimina datos)
DROP TABLE IF EXISTS api_key_logs;
DROP TABLE IF EXISTS api_keys;

-- Luego ejecutar la migración nuevamente
```

### Error: "Foreign key constraint fails"

Si hay un error con la foreign key a `users`:

```sql
-- Verificar que la tabla users existe
SHOW TABLES LIKE 'users';

-- Si no existe, crear la foreign key después
-- O modificar la migración para que created_by sea NULL sin foreign key
```

### Error: "Access denied"

Verifica las credenciales:
- Usuario: `fenecstudio-remote`
- Contraseña: `FENEC2024@`
- Host: `149.50.139.91`
- Base de datos: `norte_erp_db`

---

## 🚀 Después de la Migración

1. **Reinicia la aplicación:**
   ```bash
   pm2 restart norte-erp-api
   # o
   pm2 reload norte-erp-api
   ```

2. **Verifica que el endpoint funciona:**
   ```bash
   # Debe devolver 401 (no autorizado) no 404 (no encontrado)
   curl -X GET https://sistema.norteabanicos.com/api/api-keys
   ```

3. **Crea las API Keys** siguiendo las instrucciones en `docs/API_KEYS_SETUP.md`

---

## 📝 Notas

- Las tablas se crean con `IF NOT EXISTS`, así que es seguro ejecutar la migración múltiples veces
- Los índices mejoran el rendimiento de las consultas
- La tabla `api_key_logs` es opcional pero recomendada para auditoría

