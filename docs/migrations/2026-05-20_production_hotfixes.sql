-- =====================================================
-- Hotfix producción (facturación / POS / caja)
-- Fecha: 2026-05-20
-- Ejecutar en el VPS si aparecen errores de related_type o ítems manuales
-- =====================================================

-- 1) Pagos de ventas POS y reparaciones (evita "Data truncated for column related_type")
ALTER TABLE `payments`
  MODIFY COLUMN `related_type` enum(
    'order','purchase','expense','payroll','sale','repair_order'
  ) COLLATE utf8mb4_unicode_ci DEFAULT NULL;

-- 2) Ítems manuales en ventas (si aún no corriste 2026-05-20_add_manual_items_to_sale_items.sql)
-- Descomentar solo si sale_items.product_id sigue siendo NOT NULL:
/*
ALTER TABLE `sale_items` DROP FOREIGN KEY `sale_items_ibfk_2`;
ALTER TABLE `sale_items`
  MODIFY `product_id` int NULL,
  ADD COLUMN `description` varchar(500) NULL AFTER `product_id`;
ALTER TABLE `sale_items`
  ADD CONSTRAINT `sale_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);
*/
