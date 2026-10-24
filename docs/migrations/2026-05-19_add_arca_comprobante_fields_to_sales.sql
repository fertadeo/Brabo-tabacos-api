-- =====================================================
-- Migracion: Datos AFIP del comprobante en ventas (PDF / vista)
-- Fecha: 2026-05-19
-- Ejecutar despues de 2026-05-05_add_facturador_fields_to_sales.sql
-- =====================================================

ALTER TABLE `sales`
  ADD COLUMN `arca_punto_venta` smallint UNSIGNED NULL
    COMMENT 'Punto de venta AFIP (WSFE)' AFTER `arca_cae`,
  ADD COLUMN `arca_tipo` tinyint UNSIGNED NULL
    COMMENT 'Tipo comprobante WSFE (6=Factura B, 11=Factura C, etc.)' AFTER `arca_punto_venta`,
  ADD COLUMN `arca_numero` int UNSIGNED NULL
    COMMENT 'Numero de comprobante AFIP' AFTER `arca_tipo`,
  ADD COLUMN `arca_cuit_emisor` varchar(11) NULL AFTER `arca_numero`,
  ADD COLUMN `arca_fecha_emision` date NULL AFTER `arca_cuit_emisor`,
  ADD COLUMN `arca_cae_vto` date NULL
    COMMENT 'Vencimiento CAE (YYYY-MM-DD)' AFTER `arca_fecha_emision`,
  ADD COLUMN `arca_qr_url` varchar(512) NULL AFTER `arca_cae_vto`,
  ADD COLUMN `arca_idempotency_key` varchar(128) NULL AFTER `arca_qr_url`;

ALTER TABLE `sales`
  ADD INDEX `idx_sales_arca_numero` (`arca_punto_venta`, `arca_tipo`, `arca_numero`);

-- Backfill ventas ya facturadas (ejecutar una vez tras el ALTER)
-- Usa NULLIF para evitar STR_TO_DATE('') → error 1411 en modo estricto
UPDATE sales s
SET
  arca_punto_venta = CAST(
    NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.arca_response_json, '$.data.puntoVenta'))), ''), 'null')
    AS UNSIGNED
  ),
  arca_tipo = CAST(
    NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.arca_response_json, '$.data.tipo'))), ''), 'null')
    AS UNSIGNED
  ),
  arca_numero = CAST(
    NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.arca_response_json, '$.data.numero'))), ''), 'null')
    AS UNSIGNED
  ),
  arca_cuit_emisor = CASE
    WHEN LENGTH(REPLACE(
      NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.arca_response_json, '$.data.cuitEmisor'))), ''), 'null'),
      '-', ''
    )) = 11 THEN REPLACE(
      NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.arca_response_json, '$.data.cuitEmisor'))), ''), 'null'),
      '-', ''
    )
    ELSE NULL
  END,
  arca_fecha_emision = CASE
    WHEN NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.arca_response_json, '$.data.fechaEmision'))), ''), 'null') IS NULL
      THEN NULL
    ELSE STR_TO_DATE(
      NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.arca_response_json, '$.data.fechaEmision'))), ''), 'null'),
      '%Y-%m-%d'
    )
  END,
  arca_cae_vto = CASE
    WHEN NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.arca_response_json, '$.data.vencimientoCae'))), ''), 'null') IS NULL
      THEN NULL
    WHEN LENGTH(REPLACE(
      NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.arca_response_json, '$.data.vencimientoCae'))), ''), 'null'),
      '-', ''
    )) = 8 THEN STR_TO_DATE(
      REPLACE(
        NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.arca_response_json, '$.data.vencimientoCae'))), ''), 'null'),
        '-', ''
      ),
      '%Y%m%d'
    )
    ELSE STR_TO_DATE(
      NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.arca_response_json, '$.data.vencimientoCae'))), ''), 'null'),
      '%Y-%m-%d'
    )
  END,
  arca_qr_url = NULLIF(
    NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.arca_response_json, '$.data.qrUrl'))), ''), 'null'),
    ''
  )
WHERE s.arca_status = 'success'
  AND s.arca_numero IS NULL
  AND s.arca_response_json IS NOT NULL
  AND JSON_EXTRACT(s.arca_response_json, '$.data.numero') IS NOT NULL
  AND JSON_TYPE(JSON_EXTRACT(s.arca_response_json, '$.data.numero')) NOT IN ('NULL');
