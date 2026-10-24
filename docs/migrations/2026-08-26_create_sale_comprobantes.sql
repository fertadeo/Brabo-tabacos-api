-- =====================================================
-- Migración: Historial de comprobantes ARCA por venta
-- Fecha: 2026-08-26
-- Permite conservar Factura 1 → Nota de crédito → Factura 2 (refacturación)
-- Ejecutar después de 2026-06-11_add_arca_nota_credito_fields_to_sales.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS `sale_comprobantes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sale_id` int NOT NULL,
  `sequence` smallint UNSIGNED NOT NULL,
  `kind` enum('factura','nota_credito') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','success','error') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'success',
  `factura_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cae` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cae_vto` date DEFAULT NULL,
  `tipo` tinyint UNSIGNED DEFAULT NULL,
  `punto_venta` smallint UNSIGNED DEFAULT NULL,
  `numero` int UNSIGNED DEFAULT NULL,
  `cuit_emisor` varchar(11) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_emision` date DEFAULT NULL,
  `qr_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idempotency_key` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `motivo` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  `related_comprobante_id` int DEFAULT NULL
    COMMENT 'NC: id de la factura que anula',
  `request_json` json DEFAULT NULL,
  `response_json` json DEFAULT NULL,
  `items_json` json DEFAULT NULL
    COMMENT 'Snapshot de ítems al emitir (PDF histórico tras refacturación)',
  `error_code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `emitted_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sale_comprobantes_sequence` (`sale_id`, `sequence`),
  UNIQUE KEY `uk_sale_comprobantes_cae` (`sale_id`, `cae`),
  KEY `idx_sale_comprobantes_sale` (`sale_id`),
  KEY `idx_sale_comprobantes_kind` (`sale_id`, `kind`, `status`),
  KEY `idx_sale_comprobantes_related` (`related_comprobante_id`),
  CONSTRAINT `sale_comprobantes_sale_fk`
    FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sale_comprobantes_related_fk`
    FOREIGN KEY (`related_comprobante_id`) REFERENCES `sale_comprobantes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de facturas y notas de crédito ARCA por venta';

-- Backfill: factura vigente persistida en sales
INSERT INTO `sale_comprobantes` (
  `sale_id`, `sequence`, `kind`, `status`,
  `factura_id`, `cae`, `cae_vto`, `tipo`, `punto_venta`, `numero`,
  `cuit_emisor`, `fecha_emision`, `qr_url`, `idempotency_key`,
  `request_json`, `response_json`, `emitted_at`
)
SELECT
  s.id,
  1,
  'factura',
  'success',
  s.arca_factura_id,
  s.arca_cae,
  s.arca_cae_vto,
  s.arca_tipo,
  s.arca_punto_venta,
  s.arca_numero,
  s.arca_cuit_emisor,
  s.arca_fecha_emision,
  s.arca_qr_url,
  s.arca_idempotency_key,
  s.arca_request_json,
  s.arca_response_json,
  COALESCE(s.arca_last_attempt_at, s.updated_at, s.created_at)
FROM `sales` s
WHERE s.arca_status = 'success'
  AND s.arca_cae IS NOT NULL
  AND TRIM(s.arca_cae) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM `sale_comprobantes` c
    WHERE c.sale_id = s.id AND c.cae = s.arca_cae
  );

-- Backfill: nota de crédito vigente persistida en sales
INSERT INTO `sale_comprobantes` (
  `sale_id`, `sequence`, `kind`, `status`,
  `factura_id`, `cae`, `cae_vto`, `tipo`, `punto_venta`, `numero`,
  `motivo`, `observaciones`, `idempotency_key`,
  `related_comprobante_id`,
  `request_json`, `response_json`, `emitted_at`
)
SELECT
  s.id,
  CASE WHEN f.id IS NULL THEN 1 ELSE 2 END,
  'nota_credito',
  'success',
  s.arca_nc_factura_id,
  s.arca_nc_cae,
  s.arca_nc_cae_vto,
  s.arca_nc_tipo,
  s.arca_nc_punto_venta,
  s.arca_nc_numero,
  s.arca_nc_motivo,
  s.arca_nc_observaciones,
  s.arca_nc_idempotency_key,
  f.id,
  s.arca_nc_request_json,
  s.arca_nc_response_json,
  COALESCE(s.arca_nc_last_attempt_at, s.updated_at, s.created_at)
FROM `sales` s
LEFT JOIN `sale_comprobantes` f
  ON f.sale_id = s.id
  AND f.kind = 'factura'
  AND f.cae <=> s.arca_cae
WHERE s.arca_nc_status = 'success'
  AND s.arca_nc_cae IS NOT NULL
  AND TRIM(s.arca_nc_cae) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM `sale_comprobantes` c
    WHERE c.sale_id = s.id AND c.cae = s.arca_nc_cae
  );
