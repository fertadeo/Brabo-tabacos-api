-- Moneda por línea de presupuesto (ARS | USD) y cotización snapshot en cabecera
ALTER TABLE budget_items
  ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'ARS' AFTER unit_price;

ALTER TABLE budgets
  ADD COLUMN exchange_rate DECIMAL(12, 4) NULL AFTER total_amount;
