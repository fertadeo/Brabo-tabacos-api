-- Producto: reservas (venta por encargo)
-- Fecha: 2026-03-04
--
-- Añade solo allow_backorders. Las columnas weight, length, width, height se asumen ya existentes
-- en la tabla products (p. ej. desde db-test) y son editables vía API (PUT /api/products/:id).

ALTER TABLE products
  ADD COLUMN allow_backorders TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Permitir reservas con stock 0 (venta por encargo)';
