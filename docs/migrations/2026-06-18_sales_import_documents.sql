-- Facturas de venta importadas desde PDF ARCA/AFIP (emisión externa)
-- Ejecutar manualmente en la base de datos de producción/staging

ALTER TABLE `sales`
  ADD COLUMN `sale_source` enum('pos','imported') NOT NULL DEFAULT 'pos'
    COMMENT 'pos=venta del sistema; imported=PDF ARCA externo' AFTER `notes`,
  ADD COLUMN `source_file_path` varchar(500) NULL
    COMMENT 'Ruta del PDF original importado' AFTER `sale_source`;

CREATE TABLE IF NOT EXISTS `sales_import_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `file_token` varchar(64) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `stored_path` varchar(500) NOT NULL,
  `mime_type` varchar(100) NOT NULL DEFAULT 'application/pdf',
  `source_provider` varchar(50) DEFAULT NULL,
  `parsed_payload` json DEFAULT NULL,
  `sale_id` int DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `file_token` (`file_token`),
  KEY `idx_sales_import_docs_sale` (`sale_id`),
  KEY `idx_sales_import_docs_uploaded_by` (`uploaded_by`),
  CONSTRAINT `sales_import_documents_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sales_import_documents_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
