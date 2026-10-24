import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import { parseInvidRemitoPdfText } from './InvidRemitoParser';

describe('InvidRemitoParser', () => {
  it('extrae ítems, remito y factura origen del PDF de ejemplo', async () => {
    const samplePath = path.join(
      process.cwd(),
      '..',
      '..',
      'Users',
      'Usuario',
      'Downloads',
      'Remito - R-0023-00366043.PDF'
    );

    if (!fs.existsSync(samplePath)) {
      const fallbackText = `
11/06/2026
0023-00366043
JUKEBOX S.A
www.invidcomputers.com
REMITO
N° 30-71010577-0
 8Mouse Genius DX-120 USB Black (0975)04077964710268250975
 10Teclado Genius Smart KB-100 Black USB (5574)04111634710268255574
Factura origen: 0004-00228449
 599.555,71 VALOR ASEGURADO:
`;
      const parsed = parseInvidRemitoPdfText(fallbackText);
      expect(parsed.items.length).toBe(2);
      expect(parsed.delivery_note_number).toBe('R-0023-00366043');
      expect(parsed.source_invoice_number).toBe('0004-00228449');
      return;
    }

    const buffer = fs.readFileSync(samplePath);
    const pdfData = await pdf(buffer);
    const parsed = parseInvidRemitoPdfText(pdfData.text);

    expect(parsed.provider).toBe('invid');
    expect(parsed.items.length).toBeGreaterThanOrEqual(7);
    expect(parsed.delivery_note_number).toMatch(/0023-00366043/);
    expect(parsed.supplier_tax_id).toBe('30-71010577-0');
    expect(parsed.insured_value).toBeCloseTo(599555.71, 0);
    expect(parsed.items[0].barcode).toMatch(/^\d{12,14}$/);
  });
});
