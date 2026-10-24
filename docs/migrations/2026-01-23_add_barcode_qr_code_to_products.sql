-- Agrega soporte para barcode y qr_code (Opción A)
-- Ejecutar en la DB antes de desplegar el backend que ya escribe estos campos.

ALTER TABLE `products`
  ADD COLUMN `barcode` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Valor de código de barras (imprimible)' AFTER `code`,
  ADD COLUMN `qr_code` TEXT NULL DEFAULT NULL COMMENT 'Contenido del QR (imprimible)' AFTER `barcode`;

