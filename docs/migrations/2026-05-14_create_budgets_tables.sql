-- =====================================================
-- Tablas: presupuestos (budgets) e ítems (budget_items)
-- Fecha: 2026-05-14
-- Orden sugerido: 1) esta migración  2) tablas `repair_orders` (si aún no existen)
-- 3) `2026-05-14_link_budgets_repair_orders.sql` (columna + FK hacia reparación)
--
-- Collation: utf8mb4_unicode_ci (compatible con MariaDB y MySQL < 8;
--            utf8mb4_0900_ai_ci solo existe en MySQL 8+).
-- =====================================================

CREATE TABLE IF NOT EXISTS `budgets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `budget_number` varchar(20) NOT NULL,
  `client_id` int NOT NULL,
  `status` enum('draft','sent','approved','rejected','expired') DEFAULT 'draft',
  `total_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `valid_until` date DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `budget_number` (`budget_number`),
  KEY `client_id` (`client_id`),
  KEY `idx_budgets_status` (`status`),
  CONSTRAINT `budgets_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `budget_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `budget_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `budget_id` (`budget_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `budget_items_ibfk_1` FOREIGN KEY (`budget_id`) REFERENCES `budgets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `budget_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
