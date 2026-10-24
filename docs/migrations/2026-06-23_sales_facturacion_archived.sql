-- Ocultar ventas en facturación (errores / pruebas) sin borrar datos ARCA.
ALTER TABLE `sales`
  ADD COLUMN `facturacion_archived` tinyint(1) NOT NULL DEFAULT 0
    COMMENT '1 = oculta en listado de facturación'
    AFTER `arca_nc_response_json`,
  ADD COLUMN `facturacion_archived_at` datetime NULL
    AFTER `facturacion_archived`,
  ADD COLUMN `facturacion_archived_by` int unsigned NULL
    AFTER `facturacion_archived_at`,
  ADD KEY `idx_sales_facturacion_archived` (`facturacion_archived`, `arca_status`);
