-- Alícuota IVA por producto (21%, 10.5% o 0%) y snapshot en líneas de venta/pedido
ALTER TABLE `products`
  ADD COLUMN `iva_rate` decimal(4,2) NOT NULL DEFAULT 21.00
    COMMENT 'Alícuota IVA: 21, 10.5 o 0'
    AFTER `price`;

ALTER TABLE `sale_items`
  ADD COLUMN `iva_rate` decimal(4,2) NULL
    COMMENT 'Alícuota IVA al momento de la venta (snapshot)'
    AFTER `total_price`;

ALTER TABLE `order_items`
  ADD COLUMN `iva_rate` decimal(4,2) NULL
    COMMENT 'Alícuota IVA al momento del pedido (snapshot)'
    AFTER `total_price`;

-- Ventas existentes: asumir 21% (comportamiento anterior en facturación)
UPDATE `sale_items` SET `iva_rate` = 21.00 WHERE `iva_rate` IS NULL;
