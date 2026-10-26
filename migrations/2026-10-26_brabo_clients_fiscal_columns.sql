-- Brabo: columnas fiscales de clients requeridas por GET /api/clients (idempotente).
-- Corrige Unknown column 'personeria' / 'cuil_cuit' / 'tax_condition' / 'condicion_iva_receptor'.
-- Uso:
--   mysql ... < migrations/2026-10-26_brabo_clients_fiscal_columns.sql

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `clients` ADD COLUMN `personeria` VARCHAR(20) NOT NULL DEFAULT ''consumidor_final'' COMMENT ''persona_fisica|persona_juridica|consumidor_final'' AFTER `country`',
    'SELECT ''clients.personeria ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'personeria'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `clients` ADD COLUMN `cuil_cuit` VARCHAR(20) NULL COMMENT ''CUIL/CUIT 11 digitos'' AFTER `personeria`',
    'SELECT ''clients.cuil_cuit ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'cuil_cuit'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `clients` ADD COLUMN `tax_condition` VARCHAR(30) NULL DEFAULT ''consumidor_final'' COMMENT ''condicion fiscal ERP'' AFTER `cuil_cuit`',
    'SELECT ''clients.tax_condition ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'tax_condition'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `clients` ADD COLUMN `condicion_iva_receptor` TINYINT UNSIGNED NULL COMMENT ''Codigo AFIP condicionIvaReceptor'' AFTER `tax_condition`',
    'SELECT ''clients.condicion_iva_receptor ok'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'condicion_iva_receptor'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
