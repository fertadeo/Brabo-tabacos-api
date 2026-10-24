import {
  buildRefacturacionIdempotencyKey,
  mergeSaleComprobanteHistorial,
  saleCanRefacturar,
  saleHasFiscalLock,
  saleHasNotaCreditoEmitida,
  snapshotFacturaFromSale,
  snapshotNotaCreditoFromSale
} from './saleComprobantes';
import type { SaleWithDetails } from '../entities/Sale';

function sale(overrides: Partial<SaleWithDetails> = {}): SaleWithDetails {
  return {
    id: 10,
    sale_number: 'SALE-202608-0001',
    client_id: 1,
    total_amount: 1000,
    payment_method: 'efectivo',
    sale_date: '2026-08-26',
    sync_status: 'pending',
    created_by: 1,
    created_at: '2026-08-26T12:00:00Z',
    updated_at: '2026-08-26T12:00:00Z',
    arca_status: 'success',
    arca_cae: '11111111111111',
    arca_tipo: 6,
    arca_punto_venta: 5,
    arca_numero: 100,
    items: [
      {
        id: 1,
        sale_id: 10,
        product_id: 3,
        product_name: 'RAM',
        quantity: 1,
        unit_price: 1000,
        total_price: 1000,
        created_at: '2026-08-26T12:00:00Z'
      }
    ],
    ...overrides
  };
}

describe('saleComprobantes', () => {
  it('detecta NC emitida y habilita refacturación', () => {
    const withNc = sale({
      arca_nc_status: 'success',
      arca_nc_cae: '22222222222222'
    });
    expect(saleHasNotaCreditoEmitida(withNc)).toBe(true);
    expect(saleCanRefacturar(withNc)).toBe(true);
    expect(saleHasFiscalLock(withNc)).toBe(false);
  });

  it('bloquea edición si hay factura vigente sin NC', () => {
    expect(saleHasFiscalLock(sale())).toBe(true);
    expect(saleCanRefacturar(sale())).toBe(false);
  });

  it('arma historial Factura → NC → Factura vigente', () => {
    const current = sale({
      arca_cae: '33333333333333',
      arca_numero: 200,
      arca_nc_status: null,
      arca_nc_cae: null
    });
    const historial = mergeSaleComprobanteHistorial(
      [
        {
          id: 1,
          sale_id: 10,
          sequence: 1,
          kind: 'factura',
          status: 'success',
          cae: '11111111111111',
          tipo: 6,
          punto_venta: 5,
          numero: 100,
          created_at: '2026-08-01T10:00:00Z',
          updated_at: '2026-08-01T10:00:00Z'
        },
        {
          id: 2,
          sale_id: 10,
          sequence: 2,
          kind: 'nota_credito',
          status: 'success',
          cae: '22222222222222',
          tipo: 8,
          punto_venta: 5,
          numero: 40,
          related_comprobante_id: 1,
          created_at: '2026-08-02T10:00:00Z',
          updated_at: '2026-08-02T10:00:00Z'
        }
      ],
      current
    );

    expect(historial.map((row) => row.kind)).toEqual(['factura', 'nota_credito', 'factura']);
    expect(historial[0].vigente).toBe(false);
    expect(historial[1].vigente).toBe(false);
    expect(historial[2].vigente).toBe(true);
    expect(historial[2].cae).toBe('33333333333333');
    expect(historial[2].numero).toBe(200);
  });

  it('sintetiza historial desde columnas de sales si no hay filas', () => {
    const withNc = sale({
      arca_nc_status: 'success',
      arca_nc_cae: '22222222222222',
      arca_nc_tipo: 8,
      arca_nc_numero: 40
    });
    const historial = mergeSaleComprobanteHistorial([], withNc);
    expect(historial).toHaveLength(2);
    expect(historial[0].kind).toBe('factura');
    expect(historial[1].kind).toBe('nota_credito');
    expect(historial[0].vigente).toBe(false);
  });

  it('snapshot de factura incluye ítems', () => {
    const snap = snapshotFacturaFromSale(sale());
    expect(snap?.kind).toBe('factura');
    expect(snap?.items_json).toHaveLength(1);
    expect(snap?.items_json?.[0].product_name).toBe('RAM');
    expect(snapshotNotaCreditoFromSale(sale())).toBeNull();
  });

  it('arma idempotency de refacturación distinta a la original', () => {
    const key = buildRefacturacionIdempotencyKey(10, 3, { tipo: 6, importe: 1000 });
    expect(key.startsWith('sale-10-refact-3-')).toBe(true);
  });
});
