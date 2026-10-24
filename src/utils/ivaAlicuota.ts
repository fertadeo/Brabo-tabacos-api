/** Alícuotas IVA admitidas en el ERP (precios con IVA incluido). */
export const ALLOWED_IVA_RATES = [0, 10.5, 21] as const;

export type IvaRate = (typeof ALLOWED_IVA_RATES)[number];

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Normaliza entrada a 0, 10.5 o 21 (default 21). */
export function normalizeIvaRate(raw: unknown, defaultRate: IvaRate = 21): IvaRate {
  if (raw === undefined || raw === null || raw === '') {
    return defaultRate;
  }
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (!Number.isFinite(n)) {
    return defaultRate;
  }
  if (n === 0) return 0;
  if (Math.abs(n - 10.5) < 0.01) return 10.5;
  if (Math.abs(n - 21) < 0.01) return 21;
  return defaultRate;
}

/** Código alícuota WSFE/ARCA: 3 exento, 4 = 10,5%, 5 = 21%. */
export function afipIvaIdFromRate(ratePercent: number): number {
  const rate = normalizeIvaRate(ratePercent);
  if (rate === 0) return 3;
  if (rate === 10.5) return 4;
  return 5;
}

export function ivaRateLabel(rate: number): string {
  const r = normalizeIvaRate(rate);
  if (r === 0) return '0%';
  if (r === 10.5) return '10,5%';
  return '21%';
}

export interface IvaLineInput {
  /** Total de la línea con IVA incluido */
  lineTotal: number;
  ivaRate: number;
}

/** Descompone un importe con IVA incluido en neto + cuota. */
export function splitIvaFromInclusiveTotal(
  total: number,
  ratePercent: number
): { base: number; cuota: number } {
  const safeTotal = roundMoney(Number(total) || 0);
  const rate = normalizeIvaRate(ratePercent);
  if (rate === 0) {
    return { base: safeTotal, cuota: 0 };
  }
  const divisor = 1 + rate / 100;
  const base = roundMoney(safeTotal / divisor);
  const cuota = roundMoney(safeTotal - base);
  return { base, cuota };
}

/** Línea de venta para armar `iva[]` del facturador (precio con IVA incluido). */
export interface SaleLineForIva {
  lineTotal: number;
  ivaRate: number;
}

/**
 * Agrupa líneas por alícuota ARCA para el array `iva` del facturador.
 * Redondeo WSFE (centavos): neto por ítem a 2 decimales; cuota del bucket =
 * importe de líneas de esa alícuota − neto agregado (no % sobre base sumada).
 */
export function aggregateIvaForFacturador(
  lines: IvaLineInput[]
): Array<{ id: number; base: number; cuota: number }> {
  const buckets = new Map<number, { base: number; lineTotal: number }>();

  for (const line of lines) {
    const rate = normalizeIvaRate(line.ivaRate);
    const id = afipIvaIdFromRate(rate);
    const safeTotal = roundMoney(Number(line.lineTotal) || 0);
    const { base } = splitIvaFromInclusiveTotal(safeTotal, rate);
    const prev = buckets.get(id) ?? { base: 0, lineTotal: 0 };
    buckets.set(id, {
      base: roundMoney(prev.base + base),
      lineTotal: roundMoney(prev.lineTotal + safeTotal)
    });
  }

  return Array.from(buckets.entries())
    .map(([id, { base, lineTotal }]) => ({
      id,
      base,
      cuota: roundMoney(lineTotal - base)
    }))
    .filter((row) => row.base !== 0 || row.cuota !== 0)
    .sort((a, b) => a.id - b.id);
}

/** Redondea importe e ítems de `iva[]` antes de POST /api/facturas. */
export function sanitizeFacturadorIvaPayload<T extends {
  importe: number;
  iva?: Array<{ id: number; base: number; cuota: number }>;
}>(payload: T): T {
  if (Array.isArray(payload.iva) && payload.iva.length > 0) {
    payload.iva = payload.iva.map((row) => ({
      id: row.id,
      base: roundMoney(row.base),
      cuota: roundMoney(row.cuota)
    }));
    payload.importe = roundMoney(
      payload.iva.reduce((sum, row) => sum + row.base + row.cuota, 0)
    );
  } else {
    payload.importe = roundMoney(payload.importe);
  }
  return payload;
}

/** Alias explícito para integración ERP → MultiFacturador (`POST /api/facturas`). */
export function buildIvaArrayFromSaleLines(
  lines: SaleLineForIva[]
): Array<{ id: number; base: number; cuota: number }> {
  return aggregateIvaForFacturador(
    lines.map((line) => ({
      lineTotal: roundMoney(line.lineTotal),
      ivaRate: line.ivaRate
    }))
  );
}

/** Valida que importe ≈ suma(base + cuota) por alícuota (tolerancia ±0.01). */
export function validateFacturadorIvaTotals(
  importe: number,
  iva: Array<{ id: number; base: number; cuota: number }>,
  tolerance = 0.01
): { valid: boolean; computedImporte: number; netoGravado: number; ivaTotal: number; diff: number } {
  const netoGravado = roundMoney(iva.reduce((sum, row) => sum + row.base, 0));
  const ivaTotal = roundMoney(iva.reduce((sum, row) => sum + row.cuota, 0));
  const computedImporte = roundMoney(netoGravado + ivaTotal);
  const target = roundMoney(importe);
  const diff = roundMoney(Math.abs(computedImporte - target));
  return {
    valid: diff <= tolerance,
    computedImporte,
    netoGravado,
    ivaTotal,
    diff
  };
}

/** Cantidad de alícuotas distintas en el array `iva` (excluye cuota 0). */
export function countDistinctIvaAlicuotas(
  iva: Array<{ id: number; base: number; cuota: number }>
): number {
  return iva.filter((row) => row.base > 0 || row.cuota > 0).length;
}
