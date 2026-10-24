import type { ParsedSalesInvoiceItem } from '../../entities/SalesImportDocument';

export interface ArcaTableLayout {
  hasBonifAmount: boolean;
  hasSubtotalConIva: boolean;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseIvaPercentLine(line: string): number | undefined {
  const match = line.trim().match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (!match) return undefined;
  const raw = match[1].replace(',', '.');
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return undefined;
  if (Math.abs(n - 21) < 0.01) return 21;
  if (Math.abs(n - 10.5) < 0.01 || Math.abs(n - 10) < 0.01) return 10.5;
  if (n === 0) return 0;
  return undefined;
}

export function inferIvaRateFromAmounts(neto: number, bruto: number): number | undefined {
  if (neto <= 0 || bruto <= neto + 0.001) return undefined;
  const pct = ((bruto / neto) - 1) * 100;
  if (Math.abs(pct - 21) < 0.6) return 21;
  if (Math.abs(pct - 10.5) < 0.6) return 10.5;
  if (Math.abs(pct) < 0.05) return 0;
  return undefined;
}

export function detectArcaTableLayout(section: string): ArcaTableLayout {
  const headerChunk = section.slice(0, 800).toLowerCase().replace(/\s+/g, ' ');
  return {
    hasBonifAmount: /imp\.?\s*bonif/.test(headerChunk),
    hasSubtotalConIva:
      /subtotal\s*c\s*\/\s*iva/.test(headerChunk) ||
      (/al[ií]cuota\s*iva/.test(headerChunk) && /precio\s*unit/.test(headerChunk)),
  };
}

export function mapAmountsToItemFields(
  quantity: number,
  amounts: number[],
  layout: ArcaTableLayout,
  ivaRate?: number
): Pick<
  ParsedSalesInvoiceItem,
  | 'unit_price_net'
  | 'bonif_percent'
  | 'bonif_amount'
  | 'subtotal_net'
  | 'subtotal_gross'
  | 'subtotal'
  | 'iva_rate'
  | 'unit_price'
> {
  if (amounts.length === 0) {
    return {};
  }

  const unit_price_net = amounts[0];
  let bonif_percent: number | undefined;
  let bonif_amount: number | undefined;
  let subtotal_net: number | undefined;
  let subtotal_gross: number | undefined;

  if (layout.hasBonifAmount && amounts.length >= 4) {
    bonif_percent = amounts[1];
    bonif_amount = amounts[2];
    subtotal_net = amounts[3];
    if (layout.hasSubtotalConIva && amounts.length >= 5) {
      subtotal_gross = amounts[4];
    }
  } else if (amounts.length >= 3) {
    bonif_percent = amounts[1];
    subtotal_net = amounts[2];
    if (layout.hasSubtotalConIva && amounts.length >= 4) {
      subtotal_gross = amounts[3];
    }
  } else if (amounts.length === 2) {
    subtotal_net = amounts[1];
  } else {
    subtotal_net = amounts[amounts.length - 1];
  }

  if (subtotal_net == null && unit_price_net != null) {
    const bonif = bonif_percent ?? 0;
    subtotal_net = round2(quantity * unit_price_net * (1 - bonif / 100));
  }

  let rate = ivaRate;
  if (rate == null && subtotal_net != null && subtotal_gross != null) {
    rate = inferIvaRateFromAmounts(subtotal_net, subtotal_gross);
  }
  if (rate == null) {
    rate = 21;
  }

  if (subtotal_gross == null && subtotal_net != null) {
    subtotal_gross = rate === 0 ? subtotal_net : round2(subtotal_net * (1 + rate / 100));
  }

  const unit_price =
    quantity > 0 && subtotal_gross != null
      ? round2(subtotal_gross / quantity)
      : unit_price_net != null && rate != null
        ? rate === 0
          ? unit_price_net
          : round2(unit_price_net * (1 + rate / 100))
        : unit_price_net;

  return {
    unit_price_net,
    bonif_percent,
    bonif_amount,
    subtotal_net,
    subtotal_gross,
    subtotal: subtotal_gross ?? subtotal_net,
    iva_rate: rate,
    unit_price,
  };
}
