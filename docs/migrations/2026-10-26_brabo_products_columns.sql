-- Brabo: columnas de products requeridas por la API actual (idempotente).
-- Corrige: Unknown column 'iva_rate' in 'field list' al crear productos.
-- Uso:
--   cd ~/Brabo-tabacos-api
--   set -a; source .env; set +a
--   mysql -h"${DB_HOST:-127.0.0.1}" -P"${DB_PORT:-3306}" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
--     < migrations/2026-10-26_brabo_products_columns.sql

DELIMITER //

DROP PROCEDURE IF EXISTS brabo_add_column_if_missing //
CREATE PROCEDURE brabo_add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN ', p_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //

DROP PROCEDURE IF EXISTS brabo_add_index_if_missing //
CREATE PROCEDURE brabo_add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND INDEX_NAME = p_index
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD ', p_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //

DELIMITER ;

CALL brabo_add_column_if_missing(
  'products',
  'iva_rate',
  '`iva_rate` decimal(4,2) NOT NULL DEFAULT 21.00 COMMENT ''Alícuota IVA: 21, 10.5 o 0'' AFTER `price`'
);

CALL brabo_add_column_if_missing(
  'products',
  'woocommerce_image_ids',
  '`woocommerce_image_ids` json DEFAULT NULL'
);

CALL brabo_add_column_if_missing(
  'products',
  'woocommerce_json',
  '`woocommerce_json` json DEFAULT NULL'
);

CALL brabo_add_column_if_missing(
  'products',
  'woocommerce_slug',
  '`woocommerce_slug` varchar(255) DEFAULT NULL'
);

CALL brabo_add_column_if_missing(
  'products',
  'woocommerce_permalink',
  '`woocommerce_permalink` varchar(512) DEFAULT NULL'
);

CALL brabo_add_column_if_missing(
  'products',
  'allow_backorders',
  '`allow_backorders` tinyint(1) NOT NULL DEFAULT 0 COMMENT ''Permitir reservas con stock 0 (venta por encargo)'''
);

CALL brabo_add_index_if_missing(
  'products',
  'idx_products_woocommerce_slug',
  'INDEX `idx_products_woocommerce_slug` (`woocommerce_slug`)'
);

CALL brabo_add_index_if_missing(
  'products',
  'idx_products_woocommerce_permalink',
  'INDEX `idx_products_woocommerce_permalink` (`woocommerce_permalink`(191))'
);

-- sale_items / order_items: directo (sin PREPARE+CALL anidados)
CALL brabo_add_column_if_missing(
  'sale_items',
  'iva_rate',
  '`iva_rate` decimal(4,2) NULL COMMENT ''Alícuota IVA al momento de la venta'' AFTER `total_price`'
);

CALL brabo_add_column_if_missing(
  'order_items',
  'iva_rate',
  '`iva_rate` decimal(4,2) NULL COMMENT ''Alícuota IVA al momento del pedido'' AFTER `total_price`'
);

-- Backfill solo si la columna existe
SET @has_sale_iva := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sale_items'
    AND COLUMN_NAME = 'iva_rate'
);
SET @sql := IF(
  @has_sale_iva > 0,
  'UPDATE `sale_items` SET `iva_rate` = 21.00 WHERE `iva_rate` IS NULL',
  'SELECT ''skip sale_items iva backfill'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP PROCEDURE IF EXISTS brabo_add_column_if_missing;
DROP PROCEDURE IF EXISTS brabo_add_index_if_missing;
