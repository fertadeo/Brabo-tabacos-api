-- =====================================================
-- Migración: Condición fiscal en clientes (tax_condition + AFIP)
-- Fecha: 2026-06-02
-- Ejecutar en la base de datos donde corre la API
-- =====================================================

ALTER TABLE `clients`
  ADD COLUMN `tax_condition` varchar(30) NULL DEFAULT 'consumidor_final'
    COMMENT 'inscripto|consumidor_final|monotributo|responsable_inscripto|exento'
    AFTER `cuil_cuit`,
  ADD COLUMN `condicion_iva_receptor` tinyint unsigned NULL
    COMMENT 'Código AFIP WSFE condicionIvaReceptor (1-10)'
    AFTER `tax_condition`;
