-- Brabo: columnas products / sale_items / order_items (idempotente, sin procedures).
-- Uso:
--   set -a; source .env; set +a
--   mysql -h"${DB_HOST:-127.0.0.1}" -P"${DB_PORT:-3306}" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
--     < migrations/2026-10-26_brabo_products_columns.sql

-- products.iva_rate
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `products` ADD COLUMN `iva_rate` decimal(4,2) NOT NULL DEFAULT 21.00 COMMENT ''Alícuota IVA: 21, 10.5 o 0'' AFTER `price`',
    'SELECT ''products.iva_rate ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'iva_rate'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- products.woocommerce_image_ids
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `products` ADD COLUMN `woocommerce_image_ids` json DEFAULT NULL',
    'SELECT ''products.woocommerce_image_ids ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'woocommerce_image_ids'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- products.woocommerce_json
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `products` ADD COLUMN `woocommerce_json` json DEFAULT NULL',
    'SELECT ''products.woocommerce_json ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'woocommerce_json'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- products.woocommerce_slug
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `products` ADD COLUMN `woocommerce_slug` varchar(255) DEFAULT NULL',
    'SELECT ''products.woocommerce_slug ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'woocommerce_slug'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- products.woocommerce_permalink
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `products` ADD COLUMN `woocommerce_permalink` varchar(512) DEFAULT NULL',
    'SELECT ''products.woocommerce_permalink ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'woocommerce_permalink'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- products.allow_backorders
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `products` ADD COLUMN `allow_backorders` tinyint(1) NOT NULL DEFAULT 0 COMMENT ''Permitir reservas con stock 0''',
    'SELECT ''products.allow_backorders ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'allow_backorders'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- indexes (solo si no existen)
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `products` ADD INDEX `idx_products_woocommerce_slug` (`woocommerce_slug`)',
    'SELECT ''idx_products_woocommerce_slug ok'' AS info'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_woocommerce_slug'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `products` ADD INDEX `idx_products_woocommerce_permalink` (`woocommerce_permalink`(191))',
    'SELECT ''idx_products_woocommerce_permalink ok'' AS info'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_woocommerce_permalink'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sale_items.iva_rate (si existe la tabla)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sale_items') > 0
    AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sale_items' AND COLUMN_NAME = 'iva_rate') = 0,
    'ALTER TABLE `sale_items` ADD COLUMN `iva_rate` decimal(4,2) NULL COMMENT ''Alícuota IVA al momento de la venta'' AFTER `total_price`',
    'SELECT ''sale_items.iva_rate ok'' AS info'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- order_items.iva_rate (si existe la tabla)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items') > 0
    AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'iva_rate') = 0,
    'ALTER TABLE `order_items` ADD COLUMN `iva_rate` decimal(4,2) NULL COMMENT ''Alícuota IVA al momento del pedido'' AFTER `total_price`',
    'SELECT ''order_items.iva_rate ok'' AS info'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- backfill sale_items
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sale_items' AND COLUMN_NAME = 'iva_rate') > 0,
    'UPDATE `sale_items` SET `iva_rate` = 21.00 WHERE `iva_rate` IS NULL',
    'SELECT ''skip sale_items backfill'' AS info'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
