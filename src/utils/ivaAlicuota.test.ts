import {
  aggregateIvaForFacturador,
  buildIvaArrayFromSaleLines,
  countDistinctIvaAlicuotas,
  validateFacturadorIvaTotals
} from './ivaAlicuota';

/** Caso real: venta SALE-202606-0008 — Factura A con 21% + 10,5%. */
const SALE_202606_0008_LINES = [
  { lineTotal: 861_000, ivaRate: 21 },
  { lineTotal: 95_000, ivaRate: 21 },
  { lineTotal: 44_500, ivaRate: 10.5 },
  { lineTotal: 51_500, ivaRate: 10.5 },
  { lineTotal: 185_500, ivaRate: 10.5 },
  { lineTotal: 6_500, ivaRate: 21 }
];

const EXPECTED_IVA_SALE_202606_0008 = [
  { id: 4, base: 254_751.12, cuota: 26_748.88 },
  { id: 5, base: 795_454.55, cuota: 167_045.45 }
];

describe('buildIvaArrayFromSaleLines — SALE-202606-0008', () => {
  it('agrupa dos alícuotas ARCA (id 4 y 5) con totales esperados', () => {
    const iva = buildIvaArrayFromSaleLines(SALE_202606_0008_LINES);

    expect(iva).toHaveLength(2);
    expect(iva).toEqual(EXPECTED_IVA_SALE_202606_0008);
  });

  it('valida importe = neto gravado + IVA total', () => {
    const iva = buildIvaArrayFromSaleLines(SALE_202606_0008_LINES);
    const check = validateFacturadorIvaTotals(1_244_000, iva);

    expect(check.valid).toBe(true);
    expect(check.netoGravado).toBe(1_050_205.67);
    expect(check.ivaTotal).toBe(193_794.33);
    expect(check.computedImporte).toBe(1_244_000);
    expect(check.diff).toBe(0);
  });

  it('coincide con aggregateIvaForFacturador', () => {
    const fromAlias = buildIvaArrayFromSaleLines(SALE_202606_0008_LINES);
    const fromAggregate = aggregateIvaForFacturador(SALE_202606_0008_LINES);
    expect(fromAlias).toEqual(fromAggregate);
  });

  it('detecta múltiples alícuotas', () => {
    const iva = buildIvaArrayFromSaleLines(SALE_202606_0008_LINES);
    expect(countDistinctIvaAlicuotas(iva)).toBe(2);
  });
});

/** Ejemplos oficiales MultiFacturador (jun 2026) — centavos WSFE con precio IVA incluido. */
describe('buildIvaArrayFromSaleLines — ejemplos MultiFacturador', () => {
  it('Factura A multi IVA 10,5% + 21% (importe 1,16)', () => {
    const iva = buildIvaArrayFromSaleLines([
      { lineTotal: 0.55, ivaRate: 10.5 },
      { lineTotal: 0.61, ivaRate: 21 }
    ]);

    expect(iva).toEqual([
      { id: 4, base: 0.5, cuota: 0.05 },
      { id: 5, base: 0.5, cuota: 0.11 }
    ]);
    expect(validateFacturadorIvaTotals(1.16, iva).valid).toBe(true);
  });

  it('Factura A receptor monotributo — un ítem IVA 21% (importe 1,21)', () => {
    const iva = buildIvaArrayFromSaleLines([{ lineTotal: 1.21, ivaRate: 21 }]);

    expect(iva).toEqual([{ id: 5, base: 1.0, cuota: 0.21 }]);
    expect(validateFacturadorIvaTotals(1.21, iva).valid).toBe(true);
  });
});

describe('buildIvaArrayFromSaleLines — un solo IVA', () => {
  it('devuelve un solo elemento cuando todos los ítems son 21%', () => {
    const iva = buildIvaArrayFromSaleLines([
      { lineTotal: 100, ivaRate: 21 },
      { lineTotal: 200, ivaRate: 21 }
    ]);

    expect(iva).toHaveLength(1);
    expect(iva[0].id).toBe(5);
    expect(iva[0].base).toBe(247.93);
    expect(iva[0].cuota).toBe(52.07);
    expect(validateFacturadorIvaTotals(300, iva).valid).toBe(true);
  });
});
