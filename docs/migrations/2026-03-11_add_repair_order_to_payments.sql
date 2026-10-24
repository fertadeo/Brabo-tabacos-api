-- =====================================================
-- Migración: Extender related_type en payments para repair_order y sale
-- Fecha: 2026-03-11
-- Ejecutar después de 2026-03-11_create_repair_orders_tables.sql
-- =====================================================

ALTER TABLE `payments`
  MODIFY COLUMN `related_type` enum('order','purchase','expense','payroll','sale','repair_order') COLLATE utf8mb4_unicode_ci DEFAULT NULL;
