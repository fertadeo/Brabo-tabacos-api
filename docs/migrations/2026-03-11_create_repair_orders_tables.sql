-- =====================================================
-- Migración: Tablas para módulo de órdenes de reparación
-- Fecha: 2026-03-11
-- Ejecutar en la base de datos donde corre la API (ej. mfcomputers)
-- =====================================================

-- Tabla de órdenes de reparación
CREATE TABLE IF NOT EXISTS `repair_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `repair_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` int NOT NULL,
  `equipment_description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `diagnosis` text COLLATE utf8mb4_unicode_ci,
  `work_description` text COLLATE utf8mb4_unicode_ci,
  `reception_date` date NOT NULL,
  `delivery_date_estimated` date DEFAULT NULL,
  `delivery_date_actual` datetime DEFAULT NULL,
  `labor_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `amount_paid` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('consulta_recibida','presupuestado','aceptado','en_proceso_reparacion','listo_entrega','entregado','cancelado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'consulta_recibida',
  `budget_sent_at` datetime DEFAULT NULL,
  `accepted_at` datetime DEFAULT NULL,
  `days_to_claim` int DEFAULT NULL COMMENT 'Días para retiro antes de perder derecho a reclamo',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `repair_number` (`repair_number`),
  KEY `idx_repair_number` (`repair_number`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_status` (`status`),
  KEY `idx_reception_date` (`reception_date`),
  KEY `repair_orders_ibfk_1` (`created_by`),
  CONSTRAINT `repair_orders_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `repair_orders_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Órdenes de reparación de equipos';

-- Tabla de ítems de la orden (materiales usados)
CREATE TABLE IF NOT EXISTS `repair_order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `repair_order_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `unit_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `stock_deducted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = ya se descontó del stock',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_repair_order_id` (`repair_order_id`),
  KEY `idx_product_id` (`product_id`),
  CONSTRAINT `repair_order_items_ibfk_1` FOREIGN KEY (`repair_order_id`) REFERENCES `repair_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `repair_order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Productos usados en cada orden de reparación';
