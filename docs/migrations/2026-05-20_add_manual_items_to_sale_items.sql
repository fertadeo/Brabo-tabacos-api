-- =====================================================
-- Migración: Ítems manuales en ventas POS (sale_items)
-- Fecha: 2026-05-20
-- Ejecutar en la base de datos donde corre la API
-- =====================================================

ALTER TABLE `sale_items`
  DROP FOREIGN KEY `sale_items_ibfk_2`;

ALTER TABLE `sale_items`
  MODIFY `product_id` int NULL COMMENT 'NULL = línea manual sin catálogo',
  ADD COLUMN `description` varchar(500) NULL
    COMMENT 'Descripción de línea manual (product_id NULL)' AFTER `product_id`;

ALTER TABLE `sale_items`
  ADD CONSTRAINT `sale_items_ibfk_2`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);
