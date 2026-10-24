-- Agregar columna para persistir slug público de WooCommerce en products
-- Fecha: 2026-03-19
--
-- Objetivo:
-- - Guardar el slug nativo de WooCommerce (campo `slug`) para construir URL pública
-- - Permitir devolverlo al frontend de forma estable sin consultar WooCommerce en cada request

ALTER TABLE products
  ADD COLUMN woocommerce_slug VARCHAR(255) NULL,
  ADD INDEX idx_products_woocommerce_slug (woocommerce_slug);

