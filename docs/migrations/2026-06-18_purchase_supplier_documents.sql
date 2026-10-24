-- Documentos de proveedor (remitos/facturas) en módulo de compras
-- Ejecutar manualmente en la base de datos de producción/staging

ALTER TABLE `supplier_delivery_notes`
  MODIFY COLUMN `purchase_id` int NULL COMMENT 'OC relacionada (opcional si se importa remito sin OC previa)',
  ADD COLUMN `source_file_path` varchar(500) NULL COMMENT 'Ruta del PDF/archivo original del proveedor' AFTER `notes`,
  ADD COLUMN `source_provider` varchar(50) NULL COMMENT 'Parser usado: invid, generic, etc.' AFTER `source_file_path`,
  ADD COLUMN `source_invoice_number` varchar(50) NULL COMMENT 'Factura origen indicada en el remito' AFTER `source_provider`,
  ADD COLUMN `insured_value` decimal(14,2) NULL COMMENT 'Valor asegurado del envío' AFTER `source_invoice_number`,
  ADD COLUMN `parsed_payload` json NULL COMMENT 'Datos extraídos del documento' AFTER `insured_value`,
  ADD COLUMN `stock_applied_at` timestamp NULL COMMENT 'Cuándo se aplicó el ingreso de stock' AFTER `parsed_payload`;

ALTER TABLE `stock_movements`
  MODIFY COLUMN `movement_type` enum(
    'salida_remito',
    'entrada_devolucion',
    'traslado_interno',
    'ajuste_inventario',
    'entrada_compra'
  ) NOT NULL,
  MODIFY COLUMN `reference_type` enum(
    'remito',
    'devolucion',
    'traslado',
    'ajuste',
    'delivery_note'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS `purchase_supplier_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `file_token` varchar(64) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `stored_path` varchar(500) NOT NULL,
  `mime_type` varchar(100) NOT NULL DEFAULT 'application/pdf',
  `source_provider` varchar(50) DEFAULT NULL,
  `parsed_payload` json DEFAULT NULL,
  `delivery_note_id` int DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `file_token` (`file_token`),
  KEY `idx_purchase_docs_delivery_note` (`delivery_note_id`),
  KEY `idx_purchase_docs_uploaded_by` (`uploaded_by`),
  CONSTRAINT `purchase_supplier_documents_ibfk_1` FOREIGN KEY (`delivery_note_id`) REFERENCES `supplier_delivery_notes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `purchase_supplier_documents_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
