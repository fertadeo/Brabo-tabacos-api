-- Agregar índice en campo barcode de products para optimizar búsquedas
-- Fecha: 2026-02-19
--
-- Objetivo:
-- - Mejorar performance de búsquedas por código de barras en tabla products
-- - Necesario para la funcionalidad de autocompletado por código de barras

-- Verificar si el índice ya existe antes de crearlo
SET @index_exists = (
  SELECT COUNT(*) 
  FROM information_schema.statistics 
  WHERE table_schema = DATABASE()
    AND table_name = 'products'
    AND index_name = 'idx_products_barcode'
);

-- Crear índice solo si no existe
SET @sql = IF(@index_exists = 0,
  'CREATE INDEX idx_products_barcode ON products (barcode)',
  'SELECT "Índice idx_products_barcode ya existe" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Alternativa simple (si tu versión de MySQL no soporta la verificación anterior):
-- CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);

-- Nota: Si tu versión de MySQL no soporta CREATE INDEX IF NOT EXISTS,
-- ejecuta directamente:
-- CREATE INDEX idx_products_barcode ON products (barcode);
