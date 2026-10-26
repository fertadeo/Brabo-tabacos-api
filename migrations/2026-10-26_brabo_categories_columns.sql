-- Brabo: columnas de categories requeridas por la API actual (idempotente).
-- Corrige: Unknown column 'woocommerce_id' / 'parent_id' / 'updated_at' al listar/crear.
-- Uso:
--   cd ~/Brabo-tabacos-api
--   set -a; source .env; set +a
--   mysql -h"${DB_HOST:-127.0.0.1}" -P"${DB_PORT:-3306}" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
--     < migrations/2026-10-26_brabo_categories_columns.sql

-- categories.woocommerce_id
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `categories` ADD COLUMN `woocommerce_id` INT NULL COMMENT ''ID de la categoría en WooCommerce'' AFTER `is_active`',
    'SELECT ''categories.woocommerce_id ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'woocommerce_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- categories.woocommerce_slug
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `categories` ADD COLUMN `woocommerce_slug` VARCHAR(100) NULL COMMENT ''Slug de la categoría en WooCommerce'' AFTER `woocommerce_id`',
    'SELECT ''categories.woocommerce_slug ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'woocommerce_slug'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- categories.parent_id
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `categories` ADD COLUMN `parent_id` INT NULL COMMENT ''Para categorías jerárquicas'' AFTER `woocommerce_slug`',
    'SELECT ''categories.parent_id ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'parent_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- categories.updated_at
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `categories` ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`',
    'SELECT ''categories.updated_at ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'updated_at'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- unique_woocommerce_id
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `categories` ADD UNIQUE KEY `unique_woocommerce_id` (`woocommerce_id`)',
    'SELECT ''categories.unique_woocommerce_id ok'' AS info'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND INDEX_NAME = 'unique_woocommerce_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_woocommerce_slug
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `categories` ADD KEY `idx_woocommerce_slug` (`woocommerce_slug`)',
    'SELECT ''categories.idx_woocommerce_slug ok'' AS info'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND INDEX_NAME = 'idx_woocommerce_slug'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_parent_id
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `categories` ADD KEY `idx_parent_id` (`parent_id`)',
    'SELECT ''categories.idx_parent_id ok'' AS info'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND INDEX_NAME = 'idx_parent_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- fk_category_parent (solo si no existe)
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `categories` ADD CONSTRAINT `fk_category_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL',
    'SELECT ''categories.fk_category_parent ok'' AS info'
  )
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND CONSTRAINT_NAME = 'fk_category_parent'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
