-- Índice para filtrar pedidos de preventa (calle) vs local / WooCommerce
-- canal_venta ya existe como VARCHAR; solo documentamos el valor 'preventa' y aceleramos listados.

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'idx_orders_canal_venta'
);

SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE orders ADD INDEX idx_orders_canal_venta (canal_venta)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
