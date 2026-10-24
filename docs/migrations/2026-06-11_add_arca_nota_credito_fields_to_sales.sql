-- =====================================================
-- Migración: Nota de crédito ARCA en ventas
-- Fecha: 2026-06-11
-- Ejecutar después de 2026-05-19_add_arca_comprobante_fields_to_sales.sql
-- =====================================================

ALTER TABLE `sales`
  ADD COLUMN `arca_nc_status` enum('pending','success','error') NULL
    COMMENT 'Estado emisión nota de crédito' AFTER `arca_response_json`,
  ADD COLUMN `arca_nc_cae` varchar(20) NULL AFTER `arca_nc_status`,
  ADD COLUMN `arca_nc_cae_vto` date NULL AFTER `arca_nc_cae`,
  ADD COLUMN `arca_nc_factura_id` varchar(64) NULL AFTER `arca_nc_cae_vto`,
  ADD COLUMN `arca_nc_tipo` tinyint UNSIGNED NULL AFTER `arca_nc_factura_id`,
  ADD COLUMN `arca_nc_punto_venta` smallint UNSIGNED NULL AFTER `arca_nc_tipo`,
  ADD COLUMN `arca_nc_numero` int UNSIGNED NULL AFTER `arca_nc_punto_venta`,
  ADD COLUMN `arca_nc_motivo` varchar(32) NULL AFTER `arca_nc_numero`,
  ADD COLUMN `arca_nc_observaciones` text NULL AFTER `arca_nc_motivo`,
  ADD COLUMN `arca_nc_idempotency_key` varchar(128) NULL AFTER `arca_nc_observaciones`,
  ADD COLUMN `arca_nc_error_code` varchar(64) NULL AFTER `arca_nc_idempotency_key`,
  ADD COLUMN `arca_nc_error_message` text NULL AFTER `arca_nc_error_code`,
  ADD COLUMN `arca_nc_request_json` json NULL AFTER `arca_nc_error_message`,
  ADD COLUMN `arca_nc_response_json` json NULL AFTER `arca_nc_request_json`,
  ADD COLUMN `arca_nc_last_attempt_at` datetime NULL AFTER `arca_nc_response_json`;

ALTER TABLE `sales`
  ADD INDEX `idx_sales_arca_nc_status` (`arca_nc_status`);
