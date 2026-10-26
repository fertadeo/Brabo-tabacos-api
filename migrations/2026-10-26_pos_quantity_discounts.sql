-- Descuentos escalonados por cantidad para el POS (Brabo Tabacos)
CREATE TABLE IF NOT EXISTS pos_quantity_discounts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  min_quantity INT UNSIGNED NOT NULL DEFAULT 1,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  -- NULL = aplica a todas las listas; o venta_local / mayorista / revendedor
  price_list_slug VARCHAR(50) NULL DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pos_qty_disc_active (is_active, min_quantity),
  KEY idx_pos_qty_disc_slug (price_list_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ejemplos tipicos (se pueden editar/borrar desde Configuracion)
INSERT INTO pos_quantity_discounts (name, min_quantity, discount_percent, price_list_slug, is_active, sort_order)
SELECT * FROM (
  SELECT '10+ unidades' AS name, 10 AS min_quantity, 5.00 AS discount_percent, NULL AS price_list_slug, 1 AS is_active, 10 AS sort_order
  UNION ALL SELECT '25+ unidades', 25, 8.00, NULL, 1, 20
  UNION ALL SELECT '50+ unidades', 50, 12.00, NULL, 1, 30
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM pos_quantity_discounts LIMIT 1);
