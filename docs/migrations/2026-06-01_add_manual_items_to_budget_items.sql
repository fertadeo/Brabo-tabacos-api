-- =====================================================
-- Migración: Ítems manuales en presupuestos (budget_items)
-- Fecha: 2026-06-01
-- Ejecutar en la base de datos donde corre la API
-- =====================================================

ALTER TABLE `budget_items`
  DROP FOREIGN KEY `budget_items_ibfk_2`;

ALTER TABLE `budget_items`
  MODIFY `product_id` int NULL COMMENT 'NULL = línea manual sin catálogo',
  ADD COLUMN `description` varchar(500) NULL
    COMMENT 'Descripción de línea manual (product_id NULL)' AFTER `product_id`;

ALTER TABLE `budget_items`
  ADD CONSTRAINT `budget_items_ibfk_2`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);
