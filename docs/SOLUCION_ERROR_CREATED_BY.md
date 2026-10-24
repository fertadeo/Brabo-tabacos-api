# Solución al Error de created_by

## Problema
Al crear un pedido desde WooCommerce/N8N, se produce el siguiente error:
```
Cannot add or update a child row: a foreign key constraint fails (`norte_erp_db`.`orders`, CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`))
```

## Causa
El campo `created_by` en la tabla `orders` tiene una restricción de clave foránea que requiere que exista un usuario en la tabla `users`, pero:
1. No hay usuarios en la tabla `users`, o
2. La restricción no permite NULL

## Solución

### Opción 1: Ejecutar Migración SQL (Recomendado)

Ejecuta el siguiente script SQL en tu base de datos:

```sql
-- Migración para permitir NULL en created_by de orders
USE norte_erp_db;

-- Eliminar la restricción de clave foránea existente
ALTER TABLE orders DROP FOREIGN KEY orders_ibfk_2;

-- Volver a crear la restricción pero permitiendo NULL
ALTER TABLE orders 
ADD CONSTRAINT orders_ibfk_2 
FOREIGN KEY (created_by) REFERENCES users(id) 
ON DELETE SET NULL;
```

### Opción 2: Crear un Usuario del Sistema

Si prefieres que siempre haya un usuario, crea uno ejecutando:

```sql
INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active)
VALUES (
  'sistema_woocommerce',
  'sistema@norteabanicos.com',
  '$2b$10$default.hash.for.system.user.please.change',
  'Sistema',
  'WooCommerce',
  'employee',
  1
);
```

**Nota:** Deberías cambiar el password_hash después de crear el usuario.

## Verificación

Después de ejecutar la migración, verifica que funcione:

```sql
-- Verificar que la restricción permite NULL
SHOW CREATE TABLE orders;
```

Deberías ver que la restricción tiene `ON DELETE SET NULL`.

## El Código Ya Está Preparado

El código ya está actualizado para:
1. Buscar un usuario existente (preferir admin o manager)
2. Si no existe, intentar crear uno automáticamente
3. Si no se puede crear, usar NULL (después de ejecutar la migración)

