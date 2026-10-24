-- Configuración para actualización de precios por lote (referencia USD/ARS)
CREATE TABLE IF NOT EXISTS `products_config` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `products_config` (`config_key`, `config_value`, `config_type`, `description`)
VALUES (
  'last_usd_ars_rate',
  '0',
  'number',
  'Última cotización USD/ARS (venta) aplicada al confirmar ajuste por dólar'
)
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);
