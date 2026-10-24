-- =====================================================
-- Migracion: Tracking de facturacion ARCA en ventas
-- Fecha: 2026-05-05
-- =====================================================

ALTER TABLE `sales`
  ADD COLUMN  `arca_status` enum('pending','success','error') NULL DEFAULT NULL AFTER `sync_error`,
  ADD COLUMN  `arca_factura_id` varchar(64) NULL AFTER `arca_status`,
  ADD COLUMN  `arca_cae` varchar(32) NULL AFTER `arca_factura_id`,
  ADD COLUMN  `arca_last_attempt_at` datetime NULL AFTER `arca_cae`,
  ADD COLUMN  `arca_error_code` varchar(64) NULL AFTER `arca_last_attempt_at`,
  ADD COLUMN  `arca_error_message` text NULL AFTER `arca_error_code`,
  ADD COLUMN  `arca_request_json` json NULL AFTER `arca_error_message`,
  ADD COLUMN  `arca_response_json` json NULL AFTER `arca_request_json`;

ALTER TABLE `sales`
  ADD INDEX `idx_sales_arca_status` (`arca_status`),
  ADD INDEX `idx_sales_arca_factura_id` (`arca_factura_id`),
  ADD INDEX `idx_sales_arca_last_attempt_at` (`arca_last_attempt_at`);
