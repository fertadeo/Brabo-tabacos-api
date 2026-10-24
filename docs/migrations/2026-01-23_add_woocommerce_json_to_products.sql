-- Agregar columnas para persistir datos de WooCommerce en products
-- Fecha: 2026-01-23
--
-- Objetivo:
-- - Guardar el ID del producto en WooCommerce (woocommerce_id)
-- - Guardar el JSON completo del producto recibido desde WooCommerce (woocommerce_json)
--
-- Nota:
-- - Si tu motor NO soporta tipo JSON (por ejemplo algunas versiones de MariaDB),
--   cambiá `JSON` por `LONGTEXT`.

ALTER TABLE products
  ADD COLUMN woocommerce_id INT NULL,
  ADD COLUMN woocommerce_json JSON NULL;

-- Index recomendado para búsquedas por id de WooCommerce
CREATE INDEX idx_products_woocommerce_id ON products (woocommerce_id);

