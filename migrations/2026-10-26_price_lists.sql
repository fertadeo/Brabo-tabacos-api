-- Listas de precio Brabo: Venta en local, Mayorista, Revendedor
CREATE TABLE IF NOT EXISTS `price_lists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `slug` varchar(50) NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_price_lists_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `product_prices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `price_list_id` int NOT NULL,
  `price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_price_list` (`product_id`, `price_list_id`),
  KEY `idx_product_prices_list` (`price_list_id`),
  CONSTRAINT `fk_product_prices_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_product_prices_list`
    FOREIGN KEY (`price_list_id`) REFERENCES `price_lists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `price_lists` (`name`, `slug`, `is_default`, `sort_order`, `is_active`)
VALUES
  ('Venta en local', 'venta_local', 1, 1, 1),
  ('Mayorista', 'mayorista', 0, 2, 1),
  ('Revendedor', 'revendedor', 0, 3, 1)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `is_default` = VALUES(`is_default`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);

-- Migrar precio actual → lista default (venta_local)
INSERT INTO `product_prices` (`product_id`, `price_list_id`, `price`)
SELECT p.id, pl.id, COALESCE(p.price, 0)
FROM `products` p
CROSS JOIN `price_lists` pl
WHERE pl.slug = 'venta_local'
ON DUPLICATE KEY UPDATE `price` = VALUES(`price`);

-- Inicializar mayorista / revendedor con el mismo precio si aún no existen
INSERT INTO `product_prices` (`product_id`, `price_list_id`, `price`)
SELECT p.id, pl.id, COALESCE(p.price, 0)
FROM `products` p
CROSS JOIN `price_lists` pl
WHERE pl.slug IN ('mayorista', 'revendedor')
ON DUPLICATE KEY UPDATE `product_id` = `product_id`;
