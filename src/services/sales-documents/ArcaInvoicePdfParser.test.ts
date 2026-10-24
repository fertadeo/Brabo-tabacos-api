import { describe, expect, it } from '@jest/globals';
import { detectArcaInvoiceDocument, parseArcaInvoicePdfText } from './ArcaInvoicePdfParser';

const SAMPLE_FACTURA_B = `
ORIGINAL
BRABO TABACOS
Razón Social: BRABO TABACOS SRL
Domicilio Comercial: Av. Siempre Viva 123
Condición frente al IVA: IVA Responsable Inscripto
FACTURA B
COD. 006
Punto de Venta: 00004
Comp. Nro: 00000123
Fecha de Emisión: 18/06/2026
CUIT: 30-71234567-8
Ingresos Brutos: 123456
Apellido y Nombre / Razón Social: CLIENTE DEMO SA
CUIT: 30-11122233-3
Condición frente al IVA: Responsable Monotributo
Código Producto / Servicio Cantidad U. Medida Precio Unit. % Bonif Imp. Bonif. Subtotal
001 Producto de prueba 2,00 unidades 1000,00 0,00 0,00 2000,00
Importe Total: $ 2.420,00
CAE N°: 71234567890123
Fecha de Vto. de CAE: 28/06/2026
`;

/** Texto típico cuando pdf-parse extrae celdas de autoTable en líneas separadas. */
const SAMPLE_STACKED_JSPDF = `
Punto de Venta: 00005
Comp. Nro: 00000006
Fecha de Emisión: 09/06/2026
Razón Social: BRABO TABACOS SRL
CUIT: 30-71234567-8
Apellido y Nombre / Razón Social: Consumidor Final
CUIT: 20-00000000-0
Código
Producto / Servicio
Cantidad
U. Medida
Precio Unit.
% Bonif
Subtotal
Alicuota IVA
Subtotal c/IVA
NB-8GB
Memoria RAM DDR4 8GB 2666MHz
1,00
unidades
45000,00
0,00
45000,00
21%
54450,00
SSD256
Disco SSD 256GB SATA
2,00
unidades
38000,00
0,00
76000,00
21%
91960,00
Importe Total: $ 146.410,00
CAE N°: 86239045708260
Fecha de Vto. de CAE: 19/06/2026
`;

/** Línea única con códigos de unidad/alícuota numéricos (común en comprobantes ARCA). */
const SAMPLE_INLINE_NUMERIC_UNITS = `
Código Producto / Servicio Cantidad U. Medida Precio Unit. % Bonif Imp. Bonif. Subtotal
Servicio de reparación notebook 1,00 7 50000,00 0,00 0,00 50000,00 5 60500,00
Importe Total: $ 60.500,00
CAE N°: 86239045708260
`;

describe('ArcaInvoicePdfParser', () => {
  it('detecta factura electrónica ARCA', () => {
    expect(detectArcaInvoiceDocument(SAMPLE_FACTURA_B)).toBe(true);
  });

  it('extrae datos fiscales y receptor (línea continua)', () => {
    const parsed = parseArcaInvoicePdfText(SAMPLE_FACTURA_B);

    expect(parsed.comprobante_tipo).toBe(6);
    expect(parsed.punto_venta).toBe(4);
    expect(parsed.numero).toBe(123);
    expect(parsed.cae).toBe('71234567890123');
    expect(parsed.cuit_emisor).toBe('30712345678');
    expect(parsed.total_amount).toBe(2420);
    expect(parsed.items.length).toBeGreaterThanOrEqual(1);
    expect(parsed.items[0].description).toContain('Producto de prueba');
  });

  it('extrae ítems con celdas apiladas (jsPDF)', () => {
    const parsed = parseArcaInvoicePdfText(SAMPLE_STACKED_JSPDF);

    expect(parsed.punto_venta).toBe(5);
    expect(parsed.numero).toBe(6);
    expect(parsed.total_amount).toBe(146410);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].description).toContain('Memoria RAM');
    expect(parsed.items[0].quantity).toBe(1);
    expect(parsed.items[0].unit_price_net).toBe(45000);
    expect(parsed.items[0].subtotal_net).toBe(45000);
    expect(parsed.items[0].iva_rate).toBe(21);
    expect(parsed.items[0].subtotal_gross).toBe(54450);
    expect(parsed.items[0].unit_price).toBe(54450);
    expect(parsed.items[1].description).toContain('Disco SSD');
    expect(parsed.items[1].quantity).toBe(2);
    expect(parsed.items[1].subtotal_gross).toBe(91960);
    expect(parsed.items[1].unit_price).toBe(45980);
  });

  it('extrae importes netos, IVA y subtotal con IVA (cable trebol)', () => {
    const sample = `
Código
Producto / Servicio
Cantidad
U. Medida
Precio Unit.
% Bonif
Subtotal
Alicuota IVA
Subtotal c/IVA
0
cable trebol
1,00
unidades
12396,69
0,00
12396,69
21%
15000,00
Importe Neto Gravado: $ 12396,69
IVA 21%: $ 2603,31
Importe Total: $ 15000,00
CAE N°: 71234567890123
`;
    const parsed = parseArcaInvoicePdfText(sample);
    expect(parsed.items).toHaveLength(1);
    const item = parsed.items[0];
    expect(item.description).toContain('cable trebol');
    expect(item.quantity).toBe(1);
    expect(item.unit_price_net).toBe(12396.69);
    expect(item.bonif_percent).toBe(0);
    expect(item.subtotal_net).toBe(12396.69);
    expect(item.iva_rate).toBe(21);
    expect(item.subtotal_gross).toBe(15000);
    expect(item.unit_price).toBe(15000);
    expect(parsed.total_amount).toBe(15000);
  });

  it('extrae ítems en una línea con unidad numérica', () => {
    const parsed = parseArcaInvoicePdfText(SAMPLE_INLINE_NUMERIC_UNITS);

    expect(parsed.items.length).toBeGreaterThanOrEqual(1);
    expect(parsed.items[0].description).toMatch(/reparaci[oó]n/i);
    expect(parsed.total_amount).toBe(60500);
  });
});
