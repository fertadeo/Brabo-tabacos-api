-- Agregar columna para IDs de medios de WordPress/WooCommerce en products
-- Fecha: 2026-02-01
--
-- Objetivo:
-- - Guardar los IDs de la galería multimedia de WordPress cuando se suben imágenes
--   desde el ERP, para que al sincronizar el producto a WooCommerce se usen por ID
--   y no se dupliquen en la galería.
--
-- Nota:
-- - Si tu motor NO soporta tipo JSON, cambiá `JSON` por `LONGTEXT`.

ALTER TABLE products
  ADD COLUMN woocommerce_image_ids JSON NULL;
