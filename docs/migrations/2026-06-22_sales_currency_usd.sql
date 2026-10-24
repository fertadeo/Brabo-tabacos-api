-- Moneda de la venta POS y cotización USD/ARS al momento de cobro (facturación en dólares)

ALTER TABLE `sales`
  ADD COLUMN `currency` varchar(3) NOT NULL DEFAULT 'ARS'
    COMMENT 'Moneda de la venta: ARS o USD'
    AFTER `total_amount`,
  ADD COLUMN `exchange_rate` decimal(12,4) NULL
    COMMENT 'Cotización USD/ARS (venta) usada al cobrar en USD'
    AFTER `currency`;
