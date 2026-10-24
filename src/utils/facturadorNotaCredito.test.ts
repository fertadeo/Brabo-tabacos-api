import {
  buildNotaCreditoIdempotencyKey,
  buildNotaCreditoPayload,
  getNotaCreditoTipoForFactura,
  resolveFacturaOriginalRef
} from './facturadorNotaCredito';
import { Sale } from '../entities/Sale';

describe('facturadorNotaCredito', () => {
  it('mapea Factura B a NC B', () => {
    expect(getNotaCreditoTipoForFactura(6)).toBe(8);
    expect(getNotaCreditoTipoForFactura(11)).toBe(13);
    expect(getNotaCreditoTipoForFactura(1)).toBe(3);
  });

  it('resuelve referencia desde columnas persistidas', () => {
    const sale = {
      arca_status: 'success',
      arca_cae: '123',
      arca_tipo: 6,
      arca_punto_venta: 5,
      arca_numero: 42
    } as Sale;
    expect(resolveFacturaOriginalRef(sale)).toEqual({
      tipo: 6,
      puntoVenta: 5,
      numero: 42
    });
  });

  it('incluye tipo, punto de venta y número en la clave de NC', () => {
    expect(
      buildNotaCreditoIdempotencyKey(10, 'error_emision', { tipo: 6, puntoVenta: 5, numero: 42 })
    ).toBe('sale-10-nc-6-5-42-error_emision');
  });

  it('arma payload NC con cbtesAsoc', () => {
    const ref = { tipo: 6, puntoVenta: 5, numero: 10 };
    const payload = buildNotaCreditoPayload(
      {
        cuitEmisor: 20339985945,
        tipo: 6,
        puntoVenta: 5,
        docTipo: 99,
        condicionIvaReceptor: 5,
        concepto: 1,
        importe: 74200,
        iva: [{ id: 5, base: 61239.67, cuota: 12860.33 }]
      },
      ref,
      8,
      5
    );
    expect(payload.tipo).toBe(8);
    expect(payload.puntoVenta).toBe(5);
    expect(payload.cbtesAsoc).toEqual([{ tipo: 6, ptoVta: 5, nro: 10 }]);
    expect(payload.importe).toBe(74200);
  });
});
