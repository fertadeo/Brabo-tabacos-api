import type { ParsedPurchaseDocument, ParsedPurchaseDocumentItem } from '../../entities/PurchaseDocument';

function parseArgentineNumber(value: string): number | undefined {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : undefined;
}

function parseDateToIso(value: string): string | undefined {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function extractSerialNumbers(text: string, description: string): string[] {
  const escaped = description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 40);
  const blockRegex = new RegExp(`${escaped}[\\s\\S]{0,120}`, 'i');
  const block = text.match(blockRegex)?.[0] ?? '';
  const serialMatches = block.match(/\b(IC\d{2}\s+\d{6}\s+[A-Z0-9])\b/gi) ?? [];
  return [...new Set(serialMatches.map((s) => s.replace(/\s+/g, ' ').trim()))];
}

function parseDetailItems(text: string): ParsedPurchaseDocumentItem[] {
  const items: ParsedPurchaseDocumentItem[] = [];
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const compactMatch = line.match(
      /^(\d+)\s*(.+?\(\d{3,5}\))\s*(\d{7})(\d{12,14})$/
    );
    if (compactMatch) {
      const [, qty, description, materialCode, barcode] = compactMatch;
      const supplierCodeMatch = description.match(/\((\d{3,5})\)\s*$/);
      items.push({
        line_number: items.length + 1,
        quantity: parseInt(qty, 10),
        description: description.trim(),
        supplier_product_code: supplierCodeMatch?.[1],
        material_code: materialCode,
        barcode,
        serial_numbers: extractSerialNumbers(text, description.trim()),
      });
      continue;
    }

    const tabbedMatch = line.match(
      /^(\d+)\s+(.+?\(\d{3,5}\))\s+(\d{7})\s+(\d{12,14})/
    );
    if (tabbedMatch) {
      const [, qty, description, materialCode, barcode] = tabbedMatch;
      const supplierCodeMatch = description.match(/\((\d{3,5})\)\s*$/);
      items.push({
        line_number: items.length + 1,
        quantity: parseInt(qty, 10),
        description: description.trim(),
        supplier_product_code: supplierCodeMatch?.[1],
        material_code: materialCode,
        barcode,
        serial_numbers: extractSerialNumbers(text, description.trim()),
      });
    }
  }

  return items;
}

export function parseInvidRemitoPdfText(text: string): ParsedPurchaseDocument {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const multiline = text;

  const deliveryDateMatch =
    multiline.match(/^(\d{2}\/\d{2}\/\d{4})/m) ??
    multiline.match(/Basado en[\s\S]*?(\d{2}\/\d{2}\/\d{4})/);

  const remitoNumberMatch =
    multiline.match(/R-(\d{4}-\d{8})/i) ??
    multiline.match(/\b(\d{4}-\d{8})\b/);

  const supplierTaxIdMatch = multiline.match(/\b(30-\d{8}-\d)\b/);
  const customerTaxIdMatch = multiline.match(/\b(20-\d{8}-\d)\b/);

  const sourceInvoiceMatch = multiline.match(/Factura origen:\s*(\d{4}-\d{5,8})/i);
  const insuredValueMatch =
    multiline.match(/([\d.]+,\d{2})\s*VALOR ASEGURADO/i) ??
    multiline.match(/VALOR ASEGURADO:\s*([\d.]+,\d{2})/i);

  const customerOrderMatch = multiline.match(/Pedidos de cliente\s+(\d+)/i);
  const transportMatch = multiline.match(/Transporte:\s*([^\n]+)/i);

  const supplierNameMatch = multiline.match(/(JUKEBOX S\.A\.?|INVID[^|\n]*)/i);

  const customerLines = multiline.split(/\r?\n/).slice(0, 6);
  const customerName =
    customerLines.find((l) => l.includes('Figueroa') || l.match(/^[A-ZÁÉÍÓÚ][a-záéíóú]+(\s+[A-ZÁÉÍÓÚ][a-záéíóú]+)+$/)) ??
    undefined;

  const items = parseDetailItems(multiline);

  return {
    provider: 'invid',
    document_type: /REMITO/i.test(multiline) ? 'remito' : 'unknown',
    delivery_note_number: remitoNumberMatch
      ? remitoNumberMatch[0].startsWith('R-')
        ? remitoNumberMatch[0].toUpperCase()
        : `R-${remitoNumberMatch[1] ?? remitoNumberMatch[0]}`
      : undefined,
    delivery_date: deliveryDateMatch ? parseDateToIso(deliveryDateMatch[1]) : undefined,
    supplier_name: supplierNameMatch?.[1]?.trim(),
    supplier_tax_id: supplierTaxIdMatch?.[1],
    customer_name: typeof customerName === 'string' ? customerName.trim() : undefined,
    customer_tax_id: customerTaxIdMatch?.[1],
    source_invoice_number: sourceInvoiceMatch?.[1],
    insured_value: insuredValueMatch ? parseArgentineNumber(insuredValueMatch[1]) : undefined,
    customer_order_reference: customerOrderMatch?.[1],
    transport_company: transportMatch?.[1]?.trim(),
    observations: multiline.match(/OBSERVACIONES\s+([\s\S]*?)RECIBI CONFORME/i)?.[1]?.trim(),
    items,
    raw_text_preview: normalized.slice(0, 500),
  };
}

export function detectInvidDocument(text: string): boolean {
  return (
    /invidcomputers\.com/i.test(text) ||
    /JUKEBOX S\.A/i.test(text) ||
    /documento no válido como factura/i.test(text) ||
    /Código N° 91/i.test(text)
  );
}
