-- Crear tabla para cache de búsquedas de códigos de barras
-- Fecha: 2026-02-19
--
-- Objetivo:
-- - Almacenar resultados de búsquedas de códigos de barras desde APIs externas
-- - Evitar llamadas repetidas a las mismas APIs
-- - Tracking de uso y datos ignorados por usuarios

CREATE TABLE IF NOT EXISTS `barcode_lookup_cache` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `barcode` VARCHAR(64) NOT NULL COMMENT 'Código de barras (EAN/UPC/GTIN)',
  `title` VARCHAR(255) NOT NULL COMMENT 'Nombre/título del producto encontrado',
  `description` TEXT NULL COMMENT 'Descripción del producto',
  `brand` VARCHAR(100) NULL COMMENT 'Marca del producto',
  `images` JSON NULL COMMENT 'Array de URLs de imágenes',
  `source` VARCHAR(50) NOT NULL COMMENT 'Nombre del provider que encontró el dato (upcitemdb, discogs, etc.)',
  `raw_json` JSON NULL COMMENT 'Respuesta completa del provider (para debugging)',
  `suggested_price` DECIMAL(10,2) NULL COMMENT 'Precio sugerido si está disponible',
  `category_suggestion` VARCHAR(100) NULL COMMENT 'Categoría sugerida',
  `ignored` TINYINT(1) DEFAULT 0 COMMENT 'Flag si el usuario ignoró estos datos',
  `ignored_at` TIMESTAMP NULL COMMENT 'Fecha en que se ignoró',
  `ignored_by_user_id` INT NULL COMMENT 'ID del usuario que ignoró',
  `last_used_at` TIMESTAMP NULL COMMENT 'Última vez que se consultó',
  `hit_count` INT DEFAULT 0 COMMENT 'Cantidad de veces consultado',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_barcode_unique` (`barcode`),
  INDEX `idx_barcode_lookup_last_used` (`last_used_at`),
  INDEX `idx_barcode_lookup_source` (`source`),
  INDEX `idx_barcode_lookup_ignored` (`ignored`),
  CONSTRAINT `fk_barcode_lookup_user` FOREIGN KEY (`ignored_by_user_id`) 
    REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Cache de búsquedas de códigos de barras desde APIs externas';
