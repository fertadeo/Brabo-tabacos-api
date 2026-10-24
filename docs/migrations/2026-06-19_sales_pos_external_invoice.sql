-- Vincular factura ARCA externa (PDF) a una venta POS existente
-- Ejecutar después de 2026-06-18_sales_import_documents.sql

ALTER TABLE `sales`
  MODIFY COLUMN `sale_source` enum('pos','imported','pos_external') NOT NULL DEFAULT 'pos'
    COMMENT 'pos=venta POS; imported=registro solo PDF; pos_external=venta POS facturada fuera del sistema';
