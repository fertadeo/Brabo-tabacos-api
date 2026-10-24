import type { SaleCurrency } from '../entities/Sale';
import { normalizeCreateSaleLine, type CreateSaleLineInput } from './saleItems';

export type BudgetLineInput = CreateSaleLineInput & {
  currency?: SaleCurrency;
};

export function resolveBudgetCurrency(raw: unknown): SaleCurrency {
  const value = String(raw ?? 'ARS').trim().toUpperCase();
  return value === 'USD' ? 'USD' : 'ARS';
}

export function normalizeBudgetLine(raw: Record<string, unknown>): BudgetLineInput {
  const base = normalizeCreateSaleLine(raw);
  const currencyRaw = raw.currency ?? raw.Currency;
  const currency = resolveBudgetCurrency(currencyRaw);
  return { ...base, currency };
}

export interface BudgetLineTotalInput {
  quantity: number;
  unit_price: number;
  currency?: SaleCurrency | string | null;
}

export function budgetLineTotal(line: BudgetLineTotalInput): number {
  return Number(line.quantity) * Number(line.unit_price);
}

export function budgetHasUsdLines(items: BudgetLineTotalInput[]): boolean {
  return items.some((item) => resolveBudgetCurrency(item.currency) === 'USD');
}

export function budgetTotalsByCurrency(items: BudgetLineTotalInput[]): { ars: number; usd: number } {
  return items.reduce(
    (acc, item) => {
      const total = budgetLineTotal(item);
      if (resolveBudgetCurrency(item.currency) === 'USD') {
        acc.usd += total;
      } else {
        acc.ars += total;
      }
      return acc;
    },
    { ars: 0, usd: 0 }
  );
}

/** Total en ARS para cabecera: suma ARS + USD convertido si hay cotización. */
export function computeBudgetTotalAmount(
  items: BudgetLineTotalInput[],
  exchangeRate?: number | null
): number {
  const { ars, usd } = budgetTotalsByCurrency(items);
  if (usd > 0) {
    const rate = Number(exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(
        'Se requiere exchange_rate válido cuando el presupuesto incluye ítems en USD'
      );
    }
    return Math.round((ars + usd * rate) * 100) / 100;
  }
  return Math.round(ars * 100) / 100;
}

export function assertHomogeneousBudgetCurrency(items: BudgetLineTotalInput[]): SaleCurrency {
  if (!items.length) return 'ARS';
  const currencies = new Set(items.map((item) => resolveBudgetCurrency(item.currency)));
  if (currencies.size > 1) {
    throw new Error(
      'El presupuesto tiene ítems en ARS y USD. Unificá la moneda antes de convertir a venta.'
    );
  }
  return resolveBudgetCurrency(items[0].currency);
}
