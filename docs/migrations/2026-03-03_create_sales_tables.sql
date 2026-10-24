-- =====================================================
-- Migración: Tablas para módulo de ventas (POS)
-- Fecha: 2026-03-03
-- Ejecutar en la base de datos donde corre la API (ej. mfcomputers)
-- =====================================================

-- Tabla de ventas
CREATE TABLE IF NOT EXISTS `sales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sale_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` int NOT NULL,
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `payment_method` enum('efectivo','tarjeta','transferencia','mixto') COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_details` json DEFAULT NULL COMMENT 'Detalles de pago cuando el método es mixto',
  `sale_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `woocommerce_order_id` int DEFAULT NULL COMMENT 'ID del pedido en WooCommerce (si está sincronizado)',
  `sync_status` enum('pending','synced','error') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `sync_error` text COLLATE utf8mb4_unicode_ci COMMENT 'Mensaje de error si la sincronización falló',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sale_number` (`sale_number`),
  KEY `idx_sale_number` (`sale_number`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_payment_method` (`payment_method`),
  KEY `idx_sync_status` (`sync_status`),
  KEY `idx_sale_date` (`sale_date`),
  KEY `idx_woocommerce_order_id` (`woocommerce_order_id`),
  KEY `sales_ibfk_1` (`created_by`),
  CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `sales_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ventas realizadas en el local físico';

-- Tabla de items de venta
CREATE TABLE IF NOT EXISTS `sale_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sale_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `unit_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sale_id` (`sale_id`),
  KEY `idx_product_id` (`product_id`),
  CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sale_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Items de las ventas locales';
