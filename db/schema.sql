-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Versión del servidor:         8.4.3 - MySQL Community Server - GPL
-- SO del servidor:              Win64
-- HeidiSQL Versión:             12.8.0.6908
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Volcando estructura para tabla brabo_tabacos.accrued_expenses
CREATE TABLE IF NOT EXISTS `accrued_expenses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `expense_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Número de egreso devengado',
  `supplier_id` int DEFAULT NULL COMMENT 'Proveedor relacionado (opcional)',
  `expense_type` enum('compromise','accrual') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'compromise = compromiso, accrual = devengado',
  `concept` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Concepto del egreso',
  `category` enum('seguro','impuesto','alquiler','servicio','otro') COLLATE utf8mb4_unicode_ci DEFAULT 'otro',
  `amount` decimal(12,2) NOT NULL,
  `accrual_date` date NOT NULL COMMENT 'Fecha de devengamiento',
  `due_date` date DEFAULT NULL COMMENT 'Fecha de vencimiento',
  `payment_date` date DEFAULT NULL COMMENT 'Fecha de pago efectivo',
  `status` enum('pending','paid','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `has_invoice` tinyint(1) DEFAULT '0' COMMENT 'Si tiene factura asociada',
  `invoice_id` int DEFAULT NULL COMMENT 'Factura asociada (si existe)',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `expense_number` (`expense_number`),
  KEY `invoice_id` (`invoice_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_accrued_expenses_supplier` (`supplier_id`),
  KEY `idx_accrued_expenses_type` (`expense_type`),
  KEY `idx_accrued_expenses_category` (`category`),
  KEY `idx_accrued_expenses_status` (`status`),
  KEY `idx_accrued_expenses_date` (`accrual_date`),
  KEY `idx_accrued_expenses_due` (`due_date`),
  CONSTRAINT `accrued_expenses_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `accrued_expenses_ibfk_2` FOREIGN KEY (`invoice_id`) REFERENCES `supplier_invoices` (`id`) ON DELETE SET NULL,
  CONSTRAINT `accrued_expenses_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.accrued_expenses: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.accrued_liabilities
CREATE TABLE IF NOT EXISTS `accrued_liabilities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `liability_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Número de pasivo',
  `liability_type` enum('impuesto','alquiler','seguro','servicio','prestamo','otro') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `accrual_date` date NOT NULL COMMENT 'Fecha de devengamiento',
  `due_date` date NOT NULL COMMENT 'Fecha de vencimiento',
  `payment_date` date DEFAULT NULL COMMENT 'Fecha de pago',
  `status` enum('pending','partial_paid','paid','overdue','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `paid_amount` decimal(12,2) DEFAULT '0.00',
  `remaining_amount` decimal(12,2) NOT NULL COMMENT 'Monto pendiente',
  `treasury_account_id` int DEFAULT NULL COMMENT 'Cuenta de tesorería relacionada',
  `payment_id` int DEFAULT NULL COMMENT 'Pago relacionado (si se pagó desde tesorería)',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `liability_number` (`liability_number`),
  KEY `created_by` (`created_by`),
  KEY `idx_accrued_liabilities_type` (`liability_type`),
  KEY `idx_accrued_liabilities_status` (`status`),
  KEY `idx_accrued_liabilities_accrual_date` (`accrual_date`),
  KEY `idx_accrued_liabilities_due_date` (`due_date`),
  KEY `idx_accrued_liabilities_payment` (`payment_date`),
  CONSTRAINT `accrued_liabilities_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.accrued_liabilities: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.accrued_liability_payments
CREATE TABLE IF NOT EXISTS `accrued_liability_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `liability_id` int NOT NULL,
  `payment_id` int NOT NULL COMMENT 'Pago desde tesorería',
  `amount` decimal(12,2) NOT NULL COMMENT 'Monto del pago aplicado',
  `payment_date` date NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_liability_payments_liability` (`liability_id`),
  KEY `idx_liability_payments_payment` (`payment_id`),
  CONSTRAINT `accrued_liability_payments_ibfk_1` FOREIGN KEY (`liability_id`) REFERENCES `accrued_liabilities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `accrued_liability_payments_ibfk_2` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.accrued_liability_payments: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.api_keys
CREATE TABLE IF NOT EXISTS `api_keys` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `api_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `rate_limit_per_minute` int DEFAULT '60',
  `rate_limit_per_hour` int DEFAULT '1000',
  `allowed_ips` text COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_key` (`api_key`),
  KEY `idx_api_key` (`api_key`),
  KEY `idx_key_hash` (`key_hash`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `api_keys_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.api_keys: ~2 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.api_key_logs
CREATE TABLE IF NOT EXISTS `api_key_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `api_key_id` int NOT NULL,
  `endpoint` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `response_status` int DEFAULT NULL,
  `response_time_ms` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_api_key_id` (`api_key_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_endpoint` (`endpoint`),
  CONSTRAINT `api_key_logs_ibfk_1` FOREIGN KEY (`api_key_id`) REFERENCES `api_keys` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.api_key_logs: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.budgets
CREATE TABLE IF NOT EXISTS `budgets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `budget_number` varchar(20) NOT NULL,
  `client_id` int NOT NULL,
  `repair_order_id` int DEFAULT NULL,
  `status` enum('draft','sent','approved','rejected','expired') DEFAULT 'draft',
  `total_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `valid_until` date DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `budget_number` (`budget_number`),
  KEY `client_id` (`client_id`),
  KEY `idx_budgets_repair_order` (`repair_order_id`),
  CONSTRAINT `budgets_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.budgets: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.budget_items
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

-- Volcando datos para la tabla brabo_tabacos.budget_items: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.categories
CREATE TABLE IF NOT EXISTS `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `description` text,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla brabo_tabacos.categories: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.clients
CREATE TABLE IF NOT EXISTS `clients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `client_type` enum('mayorista','minorista','personalizado') DEFAULT 'minorista',
  `sales_channel` enum('woocommerce_minorista','woocommerce_mayorista','mercadolibre','manual','otro') DEFAULT 'manual',
  `name` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text,
  `city` varchar(50) DEFAULT NULL,
  `country` varchar(50) DEFAULT 'Argentina',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_clients_type` (`client_type`),
  KEY `idx_clients_type_code` (`client_type`,`code`),
  KEY `idx_clients_sales_channel` (`sales_channel`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla brabo_tabacos.clients: ~18 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.delivery_zones
CREATE TABLE IF NOT EXISTS `delivery_zones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `city` varchar(50) DEFAULT NULL,
  `province` varchar(50) DEFAULT NULL,
  `postal_codes` json DEFAULT NULL,
  `delivery_time_days` int DEFAULT '1',
  `delivery_cost` decimal(10,2) DEFAULT '0.00',
  `free_delivery_minimum` decimal(10,2) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla brabo_tabacos.delivery_zones: ~4 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.logistics_config
CREATE TABLE IF NOT EXISTS `logistics_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `config_key` varchar(100) NOT NULL,
  `config_value` text,
  `config_type` enum('string','number','boolean','json') DEFAULT 'string',
  `description` text,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_key` (`config_key`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla brabo_tabacos.logistics_config: ~8 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.orders
CREATE TABLE IF NOT EXISTS `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` int NOT NULL,
  `status` enum('pendiente_preparacion','listo_despacho','pagado','aprobado','en_proceso','completado','cancelado') COLLATE utf8mb4_unicode_ci DEFAULT 'pendiente_preparacion',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `order_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `delivery_date` timestamp NULL DEFAULT NULL,
  `delivery_address` text COLLATE utf8mb4_unicode_ci,
  `delivery_city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_contact` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transport_company` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transport_cost` decimal(10,2) DEFAULT '0.00',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `remito_status` enum('sin_remito','remito_generado','remito_despachado','remito_entregado') COLLATE utf8mb4_unicode_ci DEFAULT 'sin_remito',
  `stock_reserved` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_number` (`order_number`),
  KEY `idx_order_number` (`order_number`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_status` (`status`),
  KEY `idx_remito_status` (`remito_status`),
  KEY `idx_order_date` (`order_date`),
  KEY `idx_stock_reserved` (`stock_reserved`),
  KEY `orders_ibfk_2` (`created_by`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.orders: ~6 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.orders_config
CREATE TABLE IF NOT EXISTS `orders_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `config_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `config_value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `config_type` enum('string','number','boolean','json') COLLATE utf8mb4_unicode_ci DEFAULT 'string',
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_key` (`config_key`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.orders_config: ~8 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.order_items
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `batch_number` varchar(50) DEFAULT NULL,
  `notes` text,
  `stock_reserved` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla brabo_tabacos.order_items: ~4 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.order_status_history
CREATE TABLE IF NOT EXISTS `order_status_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `previous_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_by` int DEFAULT NULL,
  `change_reason` text COLLATE utf8mb4_unicode_ci,
  `changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `changed_by` (`changed_by`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_changed_at` (`changed_at`),
  CONSTRAINT `order_status_history_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_status_history_ibfk_2` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.order_status_history: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.payments
CREATE TABLE IF NOT EXISTS `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` enum('income','outflow') COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` enum('efectivo','tarjeta','transferencia') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ARS',
  `payment_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('draft','posted','void') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'posted',
  `payee_type` enum('supplier','employee','other','client') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payee_id` int DEFAULT NULL,
  `payee_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `related_type` enum('order','purchase','expense','payroll') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `related_id` int DEFAULT NULL,
  `invoice_id` int DEFAULT NULL COMMENT 'Vinculación directa a factura de proveedor',
  `accrued_expense_id` int DEFAULT NULL COMMENT 'Egreso devengado relacionado',
  `is_partial_payment` tinyint(1) DEFAULT '0',
  `remaining_amount` decimal(12,2) DEFAULT NULL COMMENT 'Monto restante de la factura',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_date` (`payment_date`),
  KEY `idx_payment_method` (`method`),
  KEY `idx_payment_type` (`type`),
  KEY `idx_related` (`related_type`,`related_id`),
  KEY `idx_payee` (`payee_type`,`payee_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_payments_invoice` (`invoice_id`),
  KEY `payments_ibfk_accrued_expense` (`accrued_expense_id`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `payments_ibfk_accrued_expense` FOREIGN KEY (`accrued_expense_id`) REFERENCES `accrued_expenses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payments_ibfk_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `supplier_invoices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.payments: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.permissions
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Código único del permiso (ej: products.create, orders.view)',
  `module` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Módulo al que pertenece (products, orders, purchases, etc)',
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_module` (`module`),
  KEY `idx_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.permissions: ~50 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.personnel
CREATE TABLE IF NOT EXISTS `personnel` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_code` varchar(20) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `position` varchar(50) NOT NULL,
  `department` varchar(50) DEFAULT NULL,
  `salary` decimal(10,2) DEFAULT NULL,
  `hire_date` date NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_code` (`employee_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.personnel: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.production_orders
CREATE TABLE IF NOT EXISTS `production_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_number` varchar(20) NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `status` enum('pending','in_process','completed','cancelled') DEFAULT 'pending',
  `start_date` timestamp NULL DEFAULT NULL,
  `end_date` timestamp NULL DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_number` (`order_number`),
  KEY `idx_production_orders_product` (`product_id`),
  KEY `idx_production_orders_status` (`status`),
  CONSTRAINT `production_orders_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.production_orders: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.products
CREATE TABLE IF NOT EXISTS `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `barcode` varchar(64) DEFAULT NULL COMMENT 'Valor de código de barras (imprimible)',
  `qr_code` text DEFAULT NULL COMMENT 'Contenido del QR (imprimible)',
  `name` varchar(100) NOT NULL,
  `description` text,
  `category_id` int DEFAULT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `stock` int NOT NULL DEFAULT '0',
  `min_stock` int NOT NULL DEFAULT '0',
  `max_stock` int NOT NULL DEFAULT '1000',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `woocommerce_id` int DEFAULT NULL COMMENT 'ID del producto en WooCommerce',
  `woocommerce_sku` varchar(50) DEFAULT NULL COMMENT 'SKU específico para WooCommerce',
  `make_scenario_id` varchar(100) DEFAULT NULL COMMENT 'ID del escenario en Make',
  `make_last_sync` timestamp NULL DEFAULT NULL COMMENT 'Timestamp de última sincronización via Make',
  `sync_status` enum('pending','synced','error','manual') DEFAULT 'pending' COMMENT 'Estado de sincronización',
  `external_systems` json DEFAULT NULL COMMENT 'Metadatos de sistemas externos',
  `webhook_url` varchar(255) DEFAULT NULL COMMENT 'URL para webhooks de Make',
  `weight` decimal(8,2) DEFAULT NULL COMMENT 'Peso del producto en kg',
  `length` decimal(8,2) DEFAULT NULL COMMENT 'Longitud del producto en cm',
  `width` decimal(8,2) DEFAULT NULL COMMENT 'Ancho del producto en cm',
  `height` decimal(8,2) DEFAULT NULL COMMENT 'Alto del producto en cm',
  `images` json DEFAULT NULL COMMENT 'Array de URLs de imágenes desde WooCommerce',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_products_code` (`code`),
  KEY `idx_products_category` (`category_id`),
  KEY `idx_products_woocommerce_id` (`woocommerce_id`),
  KEY `idx_products_woocommerce_sku` (`woocommerce_sku`),
  KEY `idx_products_sync_status` (`sync_status`),
  KEY `idx_products_make_scenario` (`make_scenario_id`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Tabla de productos con integración WooCommerce/Make';

-- Volcando datos para la tabla brabo_tabacos.products: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.product_sync_logs
CREATE TABLE IF NOT EXISTS `product_sync_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `woocommerce_id` int DEFAULT NULL,
  `action` enum('create','update','delete','sync') NOT NULL,
  `sync_status` enum('pending','synced','error','manual') NOT NULL,
  `error_message` text,
  `make_scenario_id` varchar(100) DEFAULT NULL,
  `external_data` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sync_logs_product` (`product_id`),
  KEY `idx_sync_logs_status` (`sync_status`),
  KEY `idx_sync_logs_created` (`created_at`),
  CONSTRAINT `product_sync_logs_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Logs de sincronización de productos';

-- Volcando datos para la tabla brabo_tabacos.product_sync_logs: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.purchases
CREATE TABLE IF NOT EXISTS `purchases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchase_number` varchar(20) NOT NULL,
  `supplier_id` int NOT NULL,
  `status` enum('pending','received','cancelled') DEFAULT 'pending',
  `debt_type` enum('compromiso','deuda_directa') DEFAULT 'compromiso',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `commitment_amount` decimal(12,2) DEFAULT '0.00' COMMENT 'Monto en compromiso',
  `debt_amount` decimal(12,2) DEFAULT '0.00' COMMENT 'Monto en deuda real',
  `allows_partial_delivery` tinyint(1) DEFAULT '1',
  `purchase_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_at` timestamp NULL DEFAULT NULL COMMENT 'Fecha de confirmación de la OC',
  `received_date` timestamp NULL DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_number` (`purchase_number`),
  KEY `idx_purchases_supplier` (`supplier_id`),
  KEY `idx_purchases_status` (`status`),
  KEY `idx_purchases_date` (`purchase_date`),
  KEY `idx_purchases_debt_type` (`debt_type`),
  KEY `idx_purchases_confirmed` (`confirmed_at`),
  CONSTRAINT `purchases_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla brabo_tabacos.purchases: ~10 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.purchase_items
CREATE TABLE IF NOT EXISTS `purchase_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchase_id` int NOT NULL,
  `product_id` int NOT NULL,
  `material_code` varchar(50) DEFAULT NULL COMMENT 'Código del material (clave para costos)',
  `quantity` int NOT NULL,
  `received_quantity` int DEFAULT '0' COMMENT 'Cantidad recibida',
  `unit_price` decimal(10,2) NOT NULL,
  `unit_cost` decimal(10,2) DEFAULT NULL COMMENT 'Costo unitario para producción',
  `total_price` decimal(12,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_purchase_items_purchase` (`purchase_id`),
  KEY `idx_purchase_items_product` (`product_id`),
  KEY `idx_purchase_items_material` (`material_code`),
  CONSTRAINT `purchase_items_ibfk_1` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `purchase_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla brabo_tabacos.purchase_items: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.refresh_tokens
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` text NOT NULL,
  `revoked` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_refresh_tokens_user` (`user_id`),
  KEY `idx_refresh_tokens_expires` (`expires_at`),
  CONSTRAINT `fk_refresh_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=113 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla brabo_tabacos.refresh_tokens: ~99 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.remitos
CREATE TABLE IF NOT EXISTS `remitos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `remito_number` varchar(20) NOT NULL,
  `order_id` int NOT NULL,
  `client_id` int NOT NULL,
  `remito_type` enum('entrega_cliente','traslado_interno','devolucion','consignacion') DEFAULT 'entrega_cliente',
  `status` enum('generado','preparando','listo_despacho','en_transito','entregado','devuelto','cancelado') DEFAULT 'generado',
  `generation_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `preparation_date` timestamp NULL DEFAULT NULL,
  `dispatch_date` timestamp NULL DEFAULT NULL,
  `delivery_date` timestamp NULL DEFAULT NULL,
  `delivery_address` text,
  `delivery_city` varchar(50) DEFAULT NULL,
  `delivery_contact` varchar(100) DEFAULT NULL,
  `delivery_phone` varchar(20) DEFAULT NULL,
  `transport_company` varchar(100) DEFAULT NULL,
  `tracking_number` varchar(50) DEFAULT NULL,
  `transport_cost` decimal(10,2) DEFAULT '0.00',
  `total_products` int DEFAULT '0',
  `total_quantity` int DEFAULT '0',
  `total_value` decimal(10,2) DEFAULT '0.00',
  `preparation_notes` text,
  `delivery_notes` text,
  `signature_data` text,
  `delivery_photo` varchar(255) DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `delivered_by` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `remito_number` (`remito_number`),
  KEY `created_by` (`created_by`),
  KEY `delivered_by` (`delivered_by`),
  KEY `idx_remitos_order` (`order_id`),
  KEY `idx_remitos_client` (`client_id`),
  KEY `idx_remitos_status` (`status`),
  KEY `idx_remitos_date` (`generation_date`),
  KEY `idx_remitos_number` (`remito_number`),
  CONSTRAINT `remitos_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `remitos_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `remitos_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `remitos_ibfk_4` FOREIGN KEY (`delivered_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.remitos: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.remito_items
CREATE TABLE IF NOT EXISTS `remito_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `remito_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `status` enum('preparado','parcial','completo','devuelto') DEFAULT 'preparado',
  `prepared_quantity` int DEFAULT '0',
  `delivered_quantity` int DEFAULT '0',
  `returned_quantity` int DEFAULT '0',
  `batch_number` varchar(50) DEFAULT NULL,
  `serial_numbers` text,
  `expiration_date` date DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_remito_items_remito` (`remito_id`),
  KEY `idx_remito_items_product` (`product_id`),
  KEY `idx_remito_items_status` (`status`),
  CONSTRAINT `remito_items_ibfk_1` FOREIGN KEY (`remito_id`) REFERENCES `remitos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `remito_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.remito_items: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.role_permissions
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Rol del usuario (admin, manager, gerencia, ventas, etc)',
  `permission_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_role_permission` (`role`,`permission_id`),
  KEY `idx_role` (`role`),
  KEY `idx_permission` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=286 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.role_permissions: ~200 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.stock_movements
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `movement_type` enum('salida_remito','entrada_devolucion','traslado_interno','ajuste_inventario') NOT NULL,
  `remito_id` int DEFAULT NULL,
  `reference_number` varchar(50) DEFAULT NULL,
  `reference_type` enum('remito','devolucion','traslado','ajuste') NOT NULL,
  `quantity` int NOT NULL,
  `unit_cost` decimal(10,2) DEFAULT NULL,
  `total_cost` decimal(10,2) DEFAULT NULL,
  `from_location` varchar(100) DEFAULT NULL,
  `to_location` varchar(100) DEFAULT NULL,
  `batch_number` varchar(50) DEFAULT NULL,
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_stock_movements_product` (`product_id`),
  KEY `idx_stock_movements_remito` (`remito_id`),
  KEY `idx_stock_movements_type` (`movement_type`),
  KEY `idx_stock_movements_date` (`created_at`),
  CONSTRAINT `stock_movements_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `stock_movements_ibfk_2` FOREIGN KEY (`remito_id`) REFERENCES `remitos` (`id`),
  CONSTRAINT `stock_movements_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.stock_movements: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.suppliers
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `supplier_type` enum('productivo','no_productivo','otro_pasivo') DEFAULT 'no_productivo',
  `name` varchar(100) NOT NULL,
  `legal_name` varchar(255) DEFAULT NULL COMMENT 'Razón Social del Proveedor',
  `trade_name` varchar(255) DEFAULT NULL COMMENT 'Nombre de Fantasía',
  `purchase_frequency` varchar(50) DEFAULT NULL COMMENT 'Frecuencia de Compra (diaria, semanal, mensual, etc.)',
  `id_type` enum('CUIT','CUIL','DNI','PASAPORTE','OTRO') DEFAULT NULL COMMENT 'Tipo de Identificación',
  `tax_id` varchar(20) DEFAULT NULL COMMENT 'CUIT/Número de Identificación',
  `gross_income` varchar(50) DEFAULT NULL COMMENT 'Ingresos Brutos',
  `vat_condition` enum('Responsable Inscripto','Monotributista','Exento','Iva Exento','No Responsable','Consumidor Final') DEFAULT NULL COMMENT 'Condición IVA',
  `account_description` text COMMENT 'Descripción de Cuenta Contable',
  `product_service` text COMMENT 'Producto o Servicio que provee',
  `integral_summary_account` varchar(100) DEFAULT NULL COMMENT 'Cuenta de Resumen Integral',
  `cost` decimal(12,2) DEFAULT NULL COMMENT 'Costo asociado al proveedor',
  `contact_name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text,
  `city` varchar(50) DEFAULT NULL,
  `country` varchar(50) DEFAULT 'Argentina',
  `has_account` tinyint(1) DEFAULT '1',
  `payment_terms` int DEFAULT '30' COMMENT 'Términos de pago en días',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_suppliers_code` (`code`),
  KEY `idx_suppliers_active` (`is_active`),
  KEY `idx_suppliers_type` (`supplier_type`),
  KEY `idx_suppliers_tax_id` (`tax_id`),
  KEY `idx_suppliers_legal_name` (`legal_name`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla brabo_tabacos.suppliers: ~14 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.supplier_accounts
CREATE TABLE IF NOT EXISTS `supplier_accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int NOT NULL,
  `commitment_balance` decimal(12,2) DEFAULT '0.00' COMMENT 'Compromisos',
  `debt_balance` decimal(12,2) DEFAULT '0.00' COMMENT 'Deuda real',
  `total_balance` decimal(12,2) DEFAULT '0.00' COMMENT 'Total (commitment + debt)',
  `credit_limit` decimal(12,2) DEFAULT '0.00',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `supplier_id` (`supplier_id`),
  KEY `idx_supplier_accounts_supplier` (`supplier_id`),
  KEY `idx_supplier_accounts_active` (`is_active`),
  CONSTRAINT `supplier_accounts_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.supplier_accounts: ~12 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.supplier_account_movements
CREATE TABLE IF NOT EXISTS `supplier_account_movements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `supplier_account_id` int NOT NULL,
  `movement_type` enum('commitment','debt','payment','adjustment') COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('debit','credit') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Débito = aumenta deuda, Crédito = pago',
  `amount` decimal(12,2) NOT NULL,
  `balance_after` decimal(12,2) NOT NULL COMMENT 'Balance después del movimiento',
  `reference_type` enum('purchase','invoice','payment','delivery_note','adjustment') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` int DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `due_date` date DEFAULT NULL COMMENT 'Fecha de vencimiento (para deudas)',
  `payment_date` date DEFAULT NULL COMMENT 'Fecha de pago (si aplica)',
  `status` enum('pending','paid','overdue','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_movements_account` (`supplier_account_id`),
  KEY `idx_movements_type` (`movement_type`),
  KEY `idx_movements_reference` (`reference_type`,`reference_id`),
  KEY `idx_movements_status` (`status`),
  KEY `idx_movements_date` (`created_at`),
  CONSTRAINT `supplier_account_movements_ibfk_1` FOREIGN KEY (`supplier_account_id`) REFERENCES `supplier_accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.supplier_account_movements: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.supplier_delivery_notes
CREATE TABLE IF NOT EXISTS `supplier_delivery_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `delivery_note_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplier_id` int NOT NULL,
  `purchase_id` int NOT NULL COMMENT 'OC relacionada',
  `invoice_id` int DEFAULT NULL COMMENT 'Factura relacionada (puede ser NULL si se recibe antes)',
  `delivery_date` date NOT NULL,
  `received_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pending','partial','complete','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `matches_invoice` tinyint(1) DEFAULT '0' COMMENT 'Si coincide con factura',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `received_by` int DEFAULT NULL COMMENT 'Usuario que recibió',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `delivery_note_number` (`delivery_note_number`),
  KEY `received_by` (`received_by`),
  KEY `idx_delivery_notes_supplier` (`supplier_id`),
  KEY `idx_delivery_notes_purchase` (`purchase_id`),
  KEY `idx_delivery_notes_invoice` (`invoice_id`),
  KEY `idx_delivery_notes_number` (`delivery_note_number`),
  KEY `idx_delivery_notes_status` (`status`),
  CONSTRAINT `supplier_delivery_notes_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `supplier_delivery_notes_ibfk_2` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`),
  CONSTRAINT `supplier_delivery_notes_ibfk_3` FOREIGN KEY (`invoice_id`) REFERENCES `supplier_invoices` (`id`),
  CONSTRAINT `supplier_delivery_notes_ibfk_4` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.supplier_delivery_notes: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.supplier_delivery_note_items
CREATE TABLE IF NOT EXISTS `supplier_delivery_note_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `delivery_note_id` int NOT NULL,
  `material_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` int DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `purchase_item_id` int DEFAULT NULL COMMENT 'Item de OC',
  `invoice_item_id` int DEFAULT NULL COMMENT 'Item de factura',
  `quality_check` tinyint(1) DEFAULT '0',
  `quality_notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `purchase_item_id` (`purchase_item_id`),
  KEY `invoice_item_id` (`invoice_item_id`),
  KEY `idx_delivery_note_items_delivery` (`delivery_note_id`),
  KEY `idx_delivery_note_items_material` (`material_code`),
  KEY `idx_delivery_note_items_product` (`product_id`),
  CONSTRAINT `supplier_delivery_note_items_ibfk_1` FOREIGN KEY (`delivery_note_id`) REFERENCES `supplier_delivery_notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `supplier_delivery_note_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `supplier_delivery_note_items_ibfk_3` FOREIGN KEY (`purchase_item_id`) REFERENCES `purchase_items` (`id`),
  CONSTRAINT `supplier_delivery_note_items_ibfk_4` FOREIGN KEY (`invoice_item_id`) REFERENCES `supplier_invoice_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.supplier_delivery_note_items: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.supplier_invoices
CREATE TABLE IF NOT EXISTS `supplier_invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Número de factura del proveedor',
  `supplier_id` int NOT NULL,
  `purchase_id` int DEFAULT NULL COMMENT 'OC relacionada (opcional al inicio)',
  `invoice_date` date NOT NULL,
  `due_date` date DEFAULT NULL COMMENT 'Fecha de vencimiento',
  `subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(12,2) DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('draft','received','partial_paid','paid','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'received',
  `payment_status` enum('pending','partial','paid','overdue') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `delivery_note_id` int DEFAULT NULL COMMENT 'Remito relacionado',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `file_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL del PDF de la factura',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_number` (`invoice_number`),
  KEY `created_by` (`created_by`),
  KEY `idx_invoices_supplier` (`supplier_id`),
  KEY `idx_invoices_purchase` (`purchase_id`),
  KEY `idx_invoices_number` (`invoice_number`),
  KEY `idx_invoices_date` (`invoice_date`),
  KEY `idx_invoices_status` (`status`),
  KEY `idx_invoices_payment_status` (`payment_status`),
  KEY `supplier_invoices_ibfk_delivery` (`delivery_note_id`),
  CONSTRAINT `supplier_invoices_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `supplier_invoices_ibfk_2` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`),
  CONSTRAINT `supplier_invoices_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `supplier_invoices_ibfk_delivery` FOREIGN KEY (`delivery_note_id`) REFERENCES `supplier_delivery_notes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.supplier_invoices: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.supplier_invoice_items
CREATE TABLE IF NOT EXISTS `supplier_invoice_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `material_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_id` int DEFAULT NULL COMMENT 'Opcional, vinculación con producto',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `unit_cost` decimal(10,2) DEFAULT NULL COMMENT 'Costo unitario para producción',
  `affects_production_cost` tinyint(1) DEFAULT '1' COMMENT 'Si afecta costo de producción',
  `purchase_item_id` int DEFAULT NULL COMMENT 'Item de OC relacionado',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `purchase_item_id` (`purchase_item_id`),
  KEY `idx_invoice_items_invoice` (`invoice_id`),
  KEY `idx_invoice_items_material` (`material_code`),
  KEY `idx_invoice_items_product` (`product_id`),
  CONSTRAINT `supplier_invoice_items_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `supplier_invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `supplier_invoice_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `supplier_invoice_items_ibfk_3` FOREIGN KEY (`purchase_item_id`) REFERENCES `purchase_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.supplier_invoice_items: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.sync_status
CREATE TABLE IF NOT EXISTS `sync_status` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `woocommerce_id` int DEFAULT NULL,
  `sync_status` enum('pending','synced','error','manual') DEFAULT 'pending',
  `last_sync` timestamp NULL DEFAULT NULL,
  `error_message` text,
  `make_scenario_id` varchar(100) DEFAULT NULL,
  `retry_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_product_sync` (`product_id`),
  KEY `idx_sync_status_product` (`product_id`),
  KEY `idx_sync_status_woocommerce` (`woocommerce_id`),
  KEY `idx_sync_status_status` (`sync_status`),
  CONSTRAINT `sync_status_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Estado de sincronización de productos';

-- Volcando datos para la tabla brabo_tabacos.sync_status: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.transport_companies
CREATE TABLE IF NOT EXISTS `transport_companies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `contact_person` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text,
  `services` json DEFAULT NULL,
  `coverage_zones` json DEFAULT NULL,
  `rates` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla brabo_tabacos.transport_companies: ~3 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.trazabilidad
CREATE TABLE IF NOT EXISTS `trazabilidad` (
  `id` int NOT NULL AUTO_INCREMENT,
  `remito_id` int NOT NULL,
  `product_id` int NOT NULL,
  `stage` enum('fabricacion','control_calidad','almacenamiento','preparacion','despacho','transito','entrega','devuelto') NOT NULL,
  `location` varchar(100) DEFAULT NULL,
  `location_details` text,
  `responsible_person` varchar(100) DEFAULT NULL,
  `responsible_user_id` int DEFAULT NULL,
  `stage_start` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `stage_end` timestamp NULL DEFAULT NULL,
  `duration_minutes` int DEFAULT NULL,
  `temperature` decimal(5,2) DEFAULT NULL,
  `humidity` decimal(5,2) DEFAULT NULL,
  `quality_check` tinyint(1) DEFAULT '0',
  `quality_notes` text,
  `vehicle_plate` varchar(20) DEFAULT NULL,
  `driver_name` varchar(100) DEFAULT NULL,
  `driver_phone` varchar(20) DEFAULT NULL,
  `notes` text,
  `photos` json DEFAULT NULL,
  `documents` json DEFAULT NULL,
  `is_automatic` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `responsible_user_id` (`responsible_user_id`),
  KEY `idx_trazabilidad_remito` (`remito_id`),
  KEY `idx_trazabilidad_product` (`product_id`),
  KEY `idx_trazabilidad_stage` (`stage`),
  KEY `idx_trazabilidad_date` (`stage_start`),
  CONSTRAINT `trazabilidad_ibfk_1` FOREIGN KEY (`remito_id`) REFERENCES `remitos` (`id`),
  CONSTRAINT `trazabilidad_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `trazabilidad_ibfk_3` FOREIGN KEY (`responsible_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.trazabilidad: ~0 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `role` enum('admin','manager','employee','viewer','gerencia','ventas','logistica','finanzas') DEFAULT 'employee',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla brabo_tabacos.users: ~3 rows (aproximadamente)

-- Volcando estructura para tabla brabo_tabacos.user_permissions
CREATE TABLE IF NOT EXISTS `user_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `granted_by` int DEFAULT NULL COMMENT 'ID del usuario que otorgó el permiso',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT 'Fecha de expiración del permiso (NULL = permanente)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_permission` (`user_id`,`permission_id`),
  KEY `granted_by` (`granted_by`),
  KEY `idx_user` (`user_id`),
  KEY `idx_permission` (`permission_id`),
  KEY `idx_expires` (`expires_at`),
  CONSTRAINT `user_permissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_permissions_ibfk_3` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla brabo_tabacos.user_permissions: ~0 rows (aproximadamente)

-- Volcando estructura para vista brabo_tabacos.v_orders_ready_for_remito
-- Creando tabla temporal para superar errores de dependencia de VIEW
CREATE TABLE `v_orders_ready_for_remito` (
	`id` INT NOT NULL,
	`order_number` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`client_id` INT NOT NULL,
	`status` ENUM('pendiente_preparacion','listo_despacho','pagado','aprobado','en_proceso','completado','cancelado') NULL COLLATE 'utf8mb4_unicode_ci',
	`total_amount` DECIMAL(12,2) NOT NULL,
	`order_date` TIMESTAMP NULL,
	`delivery_date` TIMESTAMP NULL,
	`delivery_address` TEXT NULL COLLATE 'utf8mb4_unicode_ci',
	`delivery_city` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`delivery_contact` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`delivery_phone` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`transport_company` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`transport_cost` DECIMAL(10,2) NULL,
	`notes` TEXT NULL COLLATE 'utf8mb4_unicode_ci',
	`remito_status` ENUM('sin_remito','remito_generado','remito_despachado','remito_entregado') NULL COLLATE 'utf8mb4_unicode_ci',
	`stock_reserved` TINYINT(1) NULL,
	`is_active` TINYINT(1) NULL,
	`created_by` INT NULL,
	`created_at` TIMESTAMP NULL,
	`updated_at` TIMESTAMP NULL,
	`client_name` VARCHAR(1) NULL COLLATE 'utf8mb4_0900_ai_ci',
	`client_email` VARCHAR(1) NULL COLLATE 'utf8mb4_0900_ai_ci'
) ENGINE=MyISAM;

-- Volcando estructura para vista brabo_tabacos.v_orders_with_clients
-- Creando tabla temporal para superar errores de dependencia de VIEW
CREATE TABLE `v_orders_with_clients` (
	`id` INT NULL,
	`order_number` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`client_id` INT NULL,
	`status` ENUM('pendiente_preparacion','listo_despacho','pagado','aprobado','en_proceso','completado','cancelado') NULL COLLATE 'utf8mb4_unicode_ci',
	`total_amount` DECIMAL(12,2) NULL,
	`order_date` TIMESTAMP NULL,
	`delivery_date` TIMESTAMP NULL,
	`delivery_address` TEXT NULL COLLATE 'utf8mb4_unicode_ci',
	`delivery_city` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`delivery_contact` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`delivery_phone` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`transport_company` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`transport_cost` DECIMAL(10,2) NULL,
	`notes` TEXT NULL COLLATE 'utf8mb4_unicode_ci',
	`remito_status` ENUM('sin_remito','remito_generado','remito_despachado','remito_entregado') NULL COLLATE 'utf8mb4_unicode_ci',
	`stock_reserved` TINYINT(1) NULL,
	`is_active` TINYINT(1) NULL,
	`created_by` INT NULL,
	`created_at` TIMESTAMP NULL,
	`updated_at` TIMESTAMP NULL,
	`client_name` VARCHAR(1) NULL COLLATE 'utf8mb4_0900_ai_ci',
	`client_code` VARCHAR(1) NULL COLLATE 'utf8mb4_0900_ai_ci',
	`client_email` VARCHAR(1) NULL COLLATE 'utf8mb4_0900_ai_ci',
	`client_phone` VARCHAR(1) NULL COLLATE 'utf8mb4_0900_ai_ci',
	`client_type` ENUM('mayorista','minorista','personalizado') NULL COLLATE 'utf8mb4_0900_ai_ci',
	`items_count` BIGINT NULL
) ENGINE=MyISAM;

-- Volcando estructura para tabla brabo_tabacos.webhook_configs
CREATE TABLE IF NOT EXISTS `webhook_configs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `system_name` varchar(50) NOT NULL COMMENT 'Nombre del sistema (woocommerce, make, etc)',
  `webhook_url` varchar(255) NOT NULL,
  `webhook_secret` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Configuración de webhooks para sistemas externos';

-- Volcando datos para la tabla brabo_tabacos.webhook_configs: ~2 rows (aproximadamente)

-- Volcando estructura para disparador brabo_tabacos.after_order_item_delete
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `after_order_item_delete` AFTER DELETE ON `order_items` FOR EACH ROW BEGIN
    UPDATE orders 
    SET total_amount = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM order_items 
        WHERE order_id = OLD.order_id
    )
    WHERE id = OLD.order_id;
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Volcando estructura para disparador brabo_tabacos.after_order_item_insert
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `after_order_item_insert` AFTER INSERT ON `order_items` FOR EACH ROW BEGIN
    UPDATE orders 
    SET total_amount = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM order_items 
        WHERE order_id = NEW.order_id
    )
    WHERE id = NEW.order_id;
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Volcando estructura para disparador brabo_tabacos.after_order_item_update
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `after_order_item_update` AFTER UPDATE ON `order_items` FOR EACH ROW BEGIN
    UPDATE orders 
    SET total_amount = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM order_items 
        WHERE order_id = NEW.order_id
    )
    WHERE id = NEW.order_id;
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Volcando estructura para disparador brabo_tabacos.after_order_status_change
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `after_order_status_change` BEFORE UPDATE ON `orders` FOR EACH ROW BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, change_reason)
        VALUES (NEW.id, OLD.status, NEW.status, NEW.created_by, 'Estado actualizado');
    END IF;
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Volcando estructura para disparador brabo_tabacos.before_order_item_insert
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `before_order_item_insert` BEFORE INSERT ON `order_items` FOR EACH ROW BEGIN
    SET NEW.total_price = NEW.quantity * NEW.unit_price;
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Volcando estructura para disparador brabo_tabacos.before_order_item_update
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `before_order_item_update` BEFORE UPDATE ON `order_items` FOR EACH ROW BEGIN
    SET NEW.total_price = NEW.quantity * NEW.unit_price;
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Volcando estructura para disparador brabo_tabacos.tr_remito_stock_update
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `tr_remito_stock_update` AFTER INSERT ON `remito_items` FOR EACH ROW BEGIN
    -- Actualizar stock del producto
    UPDATE products 
    SET stock = stock - NEW.quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.product_id;
    
    -- Registrar movimiento de stock
    INSERT INTO stock_movements (
        product_id, 
        movement_type, 
        remito_id, 
        reference_number, 
        reference_type, 
        quantity, 
        unit_cost, 
        total_cost,
        notes
    ) VALUES (
        NEW.product_id,
        'salida_remito',
        NEW.remito_id,
        (SELECT remito_number FROM remitos WHERE id = NEW.remito_id),
        'remito',
        NEW.quantity,
        NEW.unit_price,
        NEW.total_price,
        CONCAT('Salida por remito ', (SELECT remito_number FROM remitos WHERE id = NEW.remito_id))
    );
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Volcando estructura para disparador brabo_tabacos.tr_remito_totals_update
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `tr_remito_totals_update` AFTER INSERT ON `remito_items` FOR EACH ROW BEGIN
    UPDATE remitos 
    SET total_products = (
            SELECT COUNT(*) FROM remito_items WHERE remito_id = NEW.remito_id
        ),
        total_quantity = (
            SELECT SUM(quantity) FROM remito_items WHERE remito_id = NEW.remito_id
        ),
        total_value = (
            SELECT SUM(total_price) FROM remito_items WHERE remito_id = NEW.remito_id
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.remito_id;
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Eliminando tabla temporal y crear estructura final de VIEW
DROP TABLE IF EXISTS `v_orders_ready_for_remito`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `v_orders_ready_for_remito` AS select `o`.`id` AS `id`,`o`.`order_number` AS `order_number`,`o`.`client_id` AS `client_id`,`o`.`status` AS `status`,`o`.`total_amount` AS `total_amount`,`o`.`order_date` AS `order_date`,`o`.`delivery_date` AS `delivery_date`,`o`.`delivery_address` AS `delivery_address`,`o`.`delivery_city` AS `delivery_city`,`o`.`delivery_contact` AS `delivery_contact`,`o`.`delivery_phone` AS `delivery_phone`,`o`.`transport_company` AS `transport_company`,`o`.`transport_cost` AS `transport_cost`,`o`.`notes` AS `notes`,`o`.`remito_status` AS `remito_status`,`o`.`stock_reserved` AS `stock_reserved`,`o`.`is_active` AS `is_active`,`o`.`created_by` AS `created_by`,`o`.`created_at` AS `created_at`,`o`.`updated_at` AS `updated_at`,`c`.`name` AS `client_name`,`c`.`email` AS `client_email` from (`orders` `o` left join `clients` `c` on((`o`.`client_id` = `c`.`id`))) where ((`o`.`is_active` = true) and (`o`.`status` in ('listo_despacho','pagado','aprobado')) and (`o`.`remito_status` = 'sin_remito') and (`o`.`stock_reserved` = true));

-- Eliminando tabla temporal y crear estructura final de VIEW
DROP TABLE IF EXISTS `v_orders_with_clients`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `v_orders_with_clients` AS select `o`.`id` AS `id`,`o`.`order_number` AS `order_number`,`o`.`client_id` AS `client_id`,`o`.`status` AS `status`,`o`.`total_amount` AS `total_amount`,`o`.`order_date` AS `order_date`,`o`.`delivery_date` AS `delivery_date`,`o`.`delivery_address` AS `delivery_address`,`o`.`delivery_city` AS `delivery_city`,`o`.`delivery_contact` AS `delivery_contact`,`o`.`delivery_phone` AS `delivery_phone`,`o`.`transport_company` AS `transport_company`,`o`.`transport_cost` AS `transport_cost`,`o`.`notes` AS `notes`,`o`.`remito_status` AS `remito_status`,`o`.`stock_reserved` AS `stock_reserved`,`o`.`is_active` AS `is_active`,`o`.`created_by` AS `created_by`,`o`.`created_at` AS `created_at`,`o`.`updated_at` AS `updated_at`,`c`.`name` AS `client_name`,`c`.`code` AS `client_code`,`c`.`email` AS `client_email`,`c`.`phone` AS `client_phone`,`c`.`client_type` AS `client_type`,(select count(0) from `order_items` where (`order_items`.`order_id` = `o`.`id`)) AS `items_count` from (`orders` `o` left join `clients` `c` on((`o`.`client_id` = `c`.`id`))) where (`o`.`is_active` = true);

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
