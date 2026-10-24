-- Agregar columna para persistir permalink público de WooCommerce en products
-- Fecha: 2026-03-19
--
-- Objetivo:
-- - Guardar la URL pública completa del producto (permalink) para uso directo en frontend

ALTER TABLE products
  ADD COLUMN woocommerce_permalink VARCHAR(512) NULL,
  ADD INDEX idx_products_woocommerce_permalink (woocommerce_permalink(191));

