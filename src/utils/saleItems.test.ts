import {
  buildFacturadorDetalleLines,
  parseSaleItemQuantity,
  resolveFacturadorDetalleForEmision
} from './saleItems';

const round2 = (v: number) => Math.round(v * 100) / 100;

describe('facturador detalle desde ítems de venta', () => {
  it('preserva cantidad distinta de 1', () => {
    const detalle = buildFacturadorDetalleLines(
      [
        {
          product_id: 10,
          product_code: 'CAM-520',
          product_name: 'camara tapo ws 520',
          quantity: 7,
          unit_price: 123000
        }
      ],
      round2
    );
    expect(detalle).toHaveLength(1);
    expect(detalle[0].cantidad).toBe(7);
    expect(detalle[0].precioUnitario).toBe(123000);
    expect(detalle[0].codigo).toBe('CAM-520');
  });

  it('parsea quantity como string desde MySQL', () => {
    expect(parseSaleItemQuantity('7')).toBe(7);
    expect(parseSaleItemQuantity(3)).toBe(3);
  });

  it('incluye detalle en emisión cuando suma coincide con importe fiscal', () => {
    const items = [
      { product_id: 1, product_name: 'A', quantity: 7, unit_price: 100 },
      { product_id: 2, product_name: 'B', quantity: 1, unit_price: 300 }
    ];
    const result = resolveFacturadorDetalleForEmision(items, 1000, round2);
    expect(result.incluidoEnEmision).toBe(true);
    expect(result.detalle[0].cantidad).toBe(7);
  });
});
