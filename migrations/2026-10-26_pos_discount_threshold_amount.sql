-- Amplía descuentos POS: umbral por unidades o importe; beneficio % o monto fijo.
-- Idempotente.

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `pos_quantity_discounts` ADD COLUMN `threshold_type` VARCHAR(20) NOT NULL DEFAULT ''quantity'' COMMENT ''quantity|amount'' AFTER `name`',
    'SELECT ''threshold_type ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_quantity_discounts' AND COLUMN_NAME = 'threshold_type'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `pos_quantity_discounts` ADD COLUMN `min_amount` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT ''Importe mínimo de línea (lista x cant)'' AFTER `min_quantity`',
    'SELECT ''min_amount ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_quantity_discounts' AND COLUMN_NAME = 'min_amount'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `pos_quantity_discounts` ADD COLUMN `discount_type` VARCHAR(20) NOT NULL DEFAULT ''percent'' COMMENT ''percent|fixed'' AFTER `min_amount`',
    'SELECT ''discount_type ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_quantity_discounts' AND COLUMN_NAME = 'discount_type'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `pos_quantity_discounts` ADD COLUMN `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT ''Monto fijo descontado por unidad'' AFTER `discount_percent`',
    'SELECT ''discount_amount ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_quantity_discounts' AND COLUMN_NAME = 'discount_amount'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
