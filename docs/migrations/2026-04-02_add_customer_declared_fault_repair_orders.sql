-- =====================================================
-- Migración: Falla declarada por el cliente (recepción)
-- Fecha: 2026-04-02
-- Ejecutar en la base donde corre la API (ej. mfcomputers)
-- =====================================================

ALTER TABLE `repair_orders`
  ADD COLUMN `customer_declared_fault` text COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Falla que declara el cliente en recepción' AFTER `equipment_description`;
