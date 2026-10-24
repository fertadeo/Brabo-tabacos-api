-- Condición de venta comercial (PDF) y vencimiento de pago en ventas facturadas
-- El facturador ARCA no persiste condicionVenta; el ERP guarda snapshot al emitir.

ALTER TABLE `sales`
  ADD COLUMN `condicion_venta_codigo` varchar(32) NULL
    COMMENT 'Código interno catálogo condición de venta (CONTADO, CC_30, etc.)'
    AFTER `arca_response_json`,
  ADD COLUMN `condicion_venta_texto` varchar(120) NULL
    COMMENT 'Etiqueta enviada al facturador como condicionVenta (snapshot PDF)'
    AFTER `condicion_venta_codigo`,
  ADD COLUMN `fecha_vencimiento_pago` date NULL
    COMMENT 'Vencimiento de pago WSFE si concepto servicios/mixto'
    AFTER `condicion_venta_texto`;
