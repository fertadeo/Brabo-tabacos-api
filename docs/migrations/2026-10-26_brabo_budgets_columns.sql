-- Brabo: tablas/columnas de presupuestos requeridas por la API actual (idempotente).
-- Corrige 500 al crear presupuesto (exchange_rate, currency, description, product_id NULL).
-- Uso:
--   cd ~/Brabo-tabacos-api
--   set -a; source .env; set +a
--   mysql -h"${DB_HOST:-127.0.0.1}" -P"${DB_PORT:-3306}" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
--     < migrations/2026-10-26_brabo_budgets_columns.sql

-- budgets table
CREATE TABLE IF NOT EXISTS `budgets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `budget_number` varchar(20) NOT NULL,
  `client_id` int NOT NULL,
  `status` enum('draft','sent','approved','rejected','expired') DEFAULT 'draft',
  `total_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `valid_until` date DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `budget_number` (`budget_number`),
  KEY `client_id` (`client_id`),
  KEY `idx_budgets_status` (`status`),
  CONSTRAINT `budgets_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- budget_items table
CREATE TABLE IF NOT EXISTS `budget_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `budget_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `budget_id` (`budget_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `budget_items_ibfk_1` FOREIGN KEY (`budget_id`) REFERENCES `budgets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- budgets.repair_order_id (opcional; sin FK a repair_orders en Brabo)
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `budgets` ADD COLUMN `repair_order_id` INT NULL AFTER `client_id`',
    'SELECT ''budgets.repair_order_id ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budgets' AND COLUMN_NAME = 'repair_order_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `budgets` ADD KEY `idx_budgets_repair_order` (`repair_order_id`)',
    'SELECT ''budgets.idx_budgets_repair_order ok'' AS info'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budgets' AND INDEX_NAME = 'idx_budgets_repair_order'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- budgets.exchange_rate
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `budgets` ADD COLUMN `exchange_rate` DECIMAL(12,4) NULL AFTER `total_amount`',
    'SELECT ''budgets.exchange_rate ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budgets' AND COLUMN_NAME = 'exchange_rate'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- budget_items.description
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `budget_items` ADD COLUMN `description` VARCHAR(500) NULL COMMENT ''Línea manual si product_id NULL'' AFTER `product_id`',
    'SELECT ''budget_items.description ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_items' AND COLUMN_NAME = 'description'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- budget_items.currency
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `budget_items` ADD COLUMN `currency` VARCHAR(3) NOT NULL DEFAULT ''ARS'' AFTER `unit_price`',
    'SELECT ''budget_items.currency ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_items' AND COLUMN_NAME = 'currency'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- budget_items.product_id nullable
SET @sql := (
  SELECT IF(
    COUNT(*) > 0 AND MAX(IS_NULLABLE) = 'NO',
    'ALTER TABLE `budget_items` MODIFY `product_id` INT NULL COMMENT ''NULL = línea manual''',
    'SELECT ''budget_items.product_id nullable ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_items' AND COLUMN_NAME = 'product_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
