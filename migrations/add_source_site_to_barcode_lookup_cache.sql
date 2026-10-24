-- Añade columna source_site a barcode_lookup_cache para persistir
-- el sitio donde se encontró el producto (ej. "Mercado Libre", "Fravega").
-- Ejecutar manualmente: mysql ... < migrations/add_source_site_to_barcode_lookup_cache.sql

ALTER TABLE barcode_lookup_cache
  ADD COLUMN source_site VARCHAR(255) NULL
  AFTER source;
