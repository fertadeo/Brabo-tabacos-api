-- =====================================================
-- Enlace: presupuestos comerciales (budgets) ↔ órdenes de reparación
-- Fecha: 2026-05-14
-- Requiere tablas `budgets` y `repair_orders` existentes.
--
-- Si `repair_order_id` ya existe en `budgets` (sin FK), omitir ADD COLUMN
-- y ejecutar solo ADD KEY + ADD CONSTRAINT según el estado de la tabla.
-- =====================================================

ALTER TABLE `budgets`
  ADD COLUMN `repair_order_id` int DEFAULT NULL COMMENT 'Orden de reparación asociada (mismo cliente)' AFTER `client_id`,
  ADD KEY `idx_budgets_repair_order` (`repair_order_id`),
  ADD CONSTRAINT `budgets_ibfk_repair_order`
    FOREIGN KEY (`repair_order_id`) REFERENCES `repair_orders` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
