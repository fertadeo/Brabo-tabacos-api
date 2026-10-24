import type { ParsedSalesInvoice, ParsedSalesInvoiceItem } from '../../entities/SalesImportDocument';
import {
  detectArcaTableLayout,
  mapAmountsToItemFields,
  parseIvaPercentLine,
  type ArcaTableLayout,
} from './arcaInvoiceItemAmounts';

const COMPROBANTE_PATTERNS: Array<{ regex: RegExp; tipo: number; letra: string; docType: 'factura' | 'nota_credito' }> = [
  { regex: /NOTA\s+DE\s+CR[EÉ]DITO\s+A\b/i, tipo: 3, letra: 'A', docType: 'nota_credito' },
  { regex: /NOTA\s+DE\s+CR[EÉ]DITO\s+B\b/i, tipo: 8, letra: 'B', docType: 'nota_credito' },
  { regex: /NOTA\s+DE\s+CR[EÉ]DITO\s+C\b/i, tipo: 13, letra: 'C', docType: 'nota_credito' },
  { regex: /FACTURA\s+A\b/i, tipo: 1, letra: 'A', docType: 'factura' },
  { regex: /FACTURA\s+B\b/i, tipo: 6, letra: 'B', docType: 'factura' },
  { regex: /FACTURA\s+C\b/i, tipo: 11, letra: 'C', docType: 'factura' },
];

const QTY_OR_AMOUNT_RE = /^[\d.]+,\d{2}$/;
const AMOUNT_INLINE_RE = /[\d.]+,\d{2}/g;
const UNIT_WORDS_RE = /^(unidades?|u\.?\s*med\.?|kg|lt|lts?|m2|m³?|hs|horas?|d[ií]as?|mes(es)?|otros|\d{1,2})$/i;

function parseArgentineNumber(value: string): number | undefined {
  const normalized = value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : undefined;
}

function parseDateToIso(value: string): string | undefined {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function parseDigits(value: string): number | undefined {
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  const num = parseInt(digits, 10);
  return Number.isFinite(num) ? num : undefined;
}

function normalizeCuit(value: string): string | undefined {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 ? digits : undefined;
}

function isHeaderLine(line: string): boolean {
  return /^(c[oó]digo|producto\s*\/\s*servicio|cantidad|u\.?\s*medida|precio\s*unit|%\s*bonif|imp\.?\s*bonif|subtotal|al[ií]cuota|descripci[oó]n)$/i.test(
    line.trim()
  );
}

function isFooterLine(line: string): boolean {
  return /^(importe\s+total|subtotal|importe\s+neto|iva|otros\s+tributos|cae|fecha\s+de\s+vto)/i.test(
    line.trim()
  );
}

function isQtyLine(line: string): boolean {
  return QTY_OR_AMOUNT_RE.test(line.trim());
}

function isUnitLine(line: string): boolean {
  return UNIT_WORDS_RE.test(line.trim());
}

function isAmountLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^\d+%$/.test(t)) return true;
  return QTY_OR_AMOUNT_RE.test(t);
}

function isShortCode(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 24) return false;
  if (isQtyLine(t) || isUnitLine(t) || isHeaderLine(t) || isFooterLine(t)) return false;
  return /^[A-Z0-9._\-/]+$/i.test(t);
}

function extractComprobante(text: string): {
  tipo?: number;
  letra?: string;
  document_type: ParsedSalesInvoice['document_type'];
} {
  for (const pattern of COMPROBANTE_PATTERNS) {
    if (pattern.regex.test(text)) {
      return { tipo: pattern.tipo, letra: pattern.letra, document_type: pattern.docType };
    }
  }

  const codMatch = text.match(/COD\.?\s*(\d{3})/i);
  if (codMatch) {
    const cod = codMatch[1];
    const codMap: Record<string, { tipo: number; letra: string; document_type: 'factura' | 'nota_credito' }> = {
      '001': { tipo: 1, letra: 'A', document_type: 'factura' },
      '006': { tipo: 6, letra: 'B', document_type: 'factura' },
      '011': { tipo: 11, letra: 'C', document_type: 'factura' },
      '003': { tipo: 3, letra: 'A', document_type: 'nota_credito' },
      '008': { tipo: 8, letra: 'B', document_type: 'nota_credito' },
      '013': { tipo: 13, letra: 'C', document_type: 'nota_credito' },
    };
    if (codMap[cod]) return codMap[cod];
  }

  return { document_type: 'unknown' };
}

function extractCuits(text: string): string[] {
  const matches = text.match(/\b\d{2}-\d{8}-\d\b/g) ?? [];
  const normalized = matches.map((m) => normalizeCuit(m)).filter(Boolean) as string[];
  const bare = text.match(/\b\d{11}\b/g) ?? [];
  for (const b of bare) {
    const n = normalizeCuit(b);
    if (n) normalized.push(n);
  }
  return [...new Set(normalized)];
}

function extractEmisorCuit(text: string, cuits: string[]): string | undefined {
  const emisorBlock = text.match(
    /raz[oó]n\s+social[\s\S]{0,900}?(?=apellido\s+y\s+nombre|condici[oó]n\s+de\s+venta|c[oó]digo|producto\s*\/\s*servicio)/i
  )?.[0];
  if (emisorBlock) {
    const m = emisorBlock.match(/cuit\s*:?\s*(\d{2}-\d{8}-\d|\d{11})/i);
    if (m) return normalizeCuit(m[1]);
  }
  return cuits[0];
}

function extractReceptorBlock(text: string): {
  razon_social?: string;
  cuit?: string;
  condicion_iva?: string;
} {
  const razonMatch = text.match(
    /Apellido\s+y\s+Nombre\s*\/\s*Raz[oó]n\s+Social\s*:?\s*([^\n]+)/i
  );

  const afterReceptor = razonMatch?.index != null
    ? text.slice(razonMatch.index, razonMatch.index + 500)
    : text;

  const cuitMatch = afterReceptor.match(/CUIT\s*:?\s*(\d{2}-\d{8}-\d|\d{11})/i);
  const condicionMatch = afterReceptor.match(
    /Condici[oó]n\s+frente\s+al\s+IVA\s*:?\s*([^\n]+)/i
  );

  return {
    razon_social: razonMatch?.[1]?.trim(),
    cuit: cuitMatch ? normalizeCuit(cuitMatch[1]) : undefined,
    condicion_iva: condicionMatch?.[1]?.trim(),
  };
}

function findTableSection(text: string): string {
  const startMatch =
    text.match(/c[oó]digo[\s\S]{0,120}producto[\s\S]{0,20}servicio/i) ??
    text.match(/producto[\s\S]{0,20}servicio[\s\S]{0,80}cantidad/i) ??
    text.match(/descripci[oó]n[\s\S]{0,80}(?:cant\.?|cantidad)/i) ??
    text.match(/cantidad[\s\S]{0,60}precio\s*unit/i);

  const startIdx = startMatch?.index ?? text.search(/cantidad|descripci[oó]n/i);
  if (startIdx < 0) return text;

  const tail = text.slice(startIdx);
  const endRel = tail.search(/importe\s+total/i);
  const endIdx = endRel > 0 ? endRel : tail.search(/\bcae\s*n[°º]?/i);
  const end = endIdx > 0 ? endIdx : tail.length;
  return tail.slice(0, end);
}

function maxAmountCells(layout: ArcaTableLayout): number {
  if (layout.hasSubtotalConIva) {
    return layout.hasBonifAmount ? 5 : 4;
  }
  return layout.hasBonifAmount ? 4 : 3;
}

function collectTrailingAmounts(line: string): number[] {
  return [...line.matchAll(AMOUNT_INLINE_RE)]
    .map((m) => parseArgentineNumber(m[0]))
    .filter((n): n is number => n != null);
}

function applyAmountFields(
  partial: Omit<ParsedSalesInvoiceItem, 'line_number'>,
  quantity: number,
  amounts: number[],
  layout: ArcaTableLayout,
  ivaRate?: number
): Omit<ParsedSalesInvoiceItem, 'line_number'> {
  const mapped = mapAmountsToItemFields(quantity, amounts, layout, ivaRate);
  return { ...partial, ...mapped };
}

function pushItem(
  items: ParsedSalesInvoiceItem[],
  partial: Omit<ParsedSalesInvoiceItem, 'line_number'>
): void {
  const desc = partial.description?.trim();
  if (!desc || desc.length < 2) return;
  if (/^(subtotal|importe|total|cae|iva)$/i.test(desc)) return;

  items.push({
    line_number: items.length + 1,
    ...partial,
    description: desc,
  });
}

/** Filas en una sola línea (texto continuo del PDF). */
function parseItemsInline(section: string, layout: ArcaTableLayout): ParsedSalesInvoiceItem[] {
  const items: ParsedSalesInvoiceItem[] = [];
  const lines = section.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || isHeaderLine(line) || isFooterLine(line)) continue;

    const ivaFromLine = parseIvaPercentLine(line);

    const withUnit = line.match(
      /^(\d{1,6}|[A-Z0-9._\-/]{2,24})\s+(.+?)\s+([\d.,]+)\s+(?:unidades?|u\.?\s*med\.?|kg|lt|m|hs|\d{1,2})\s+([\d.,]+)(?:\s+[\d.,]+){1,4}/i
    );
    if (withUnit) {
      const [, code, description, qty] = withUnit;
      const quantity = parseArgentineNumber(qty) ?? 1;
      const allAmounts = collectTrailingAmounts(line);
      const qtyIdx = allAmounts.findIndex((n) => Math.abs(n - quantity) < 0.001);
      const amounts = qtyIdx >= 0 ? allAmounts.slice(qtyIdx + 1) : allAmounts.slice(1);
      pushItem(
        items,
        applyAmountFields(
          {
            product_code: code,
            description: description.trim(),
            quantity,
          },
          quantity,
          amounts,
          layout,
          ivaFromLine
        )
      );
      continue;
    }

    const trailingNums = collectTrailingAmounts(line);
    if (trailingNums.length >= 3) {
      const lastAmountMatch = [...line.matchAll(AMOUNT_INLINE_RE)].pop();
      const lastIdx = lastAmountMatch ? line.lastIndexOf(lastAmountMatch[0]) : -1;
      const prefix = lastIdx >= 0 ? line.slice(0, lastIdx).trim() : line;
      const quantity = trailingNums[0] ?? 1;
      const amounts = trailingNums.slice(1);
      const codeMatch = prefix.match(/^(\S+)\s+(.+)$/);
      if (codeMatch && isShortCode(codeMatch[1])) {
        pushItem(
          items,
          applyAmountFields(
            {
              product_code: codeMatch[1],
              description: codeMatch[2].trim(),
              quantity,
            },
            quantity,
            amounts,
            layout,
            ivaFromLine
          )
        );
      } else {
        pushItem(
          items,
          applyAmountFields(
            {
              description: prefix.replace(/^\d{1,6}\s+/, '').trim() || prefix,
              quantity,
            },
            quantity,
            amounts,
            layout,
            ivaFromLine
          )
        );
      }
      continue;
    }

    const simpleMatch = line.match(/^(\d{1,6})\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/);
    if (simpleMatch) {
      const [, code, description, qty, unitPrice, subtotal] = simpleMatch;
      const quantity = parseArgentineNumber(qty) ?? 1;
      pushItem(
        items,
        applyAmountFields(
          {
            product_code: code,
            description: description.trim(),
            quantity,
          },
          quantity,
          [parseArgentineNumber(unitPrice) ?? 0, 0, parseArgentineNumber(subtotal) ?? 0],
          layout,
          ivaFromLine
        )
      );
    }
  }

  return items;
}

/** Celdas apiladas (común en PDF generados con jsPDF / autoTable). */
function parseItemsStacked(section: string, layout: ArcaTableLayout): ParsedSalesInvoiceItem[] {
  const items: ParsedSalesInvoiceItem[] = [];
  const lines = section
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const amountLimit = maxAmountCells(layout);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isHeaderLine(line) || isFooterLine(line)) {
      i++;
      continue;
    }

    let code: string | undefined;
    let j = i;
    const descParts: string[] = [];

    if (isShortCode(line)) {
      code = line;
      j = i + 1;
    } else if (!isHeaderLine(line) && !isFooterLine(line)) {
      descParts.push(line);
      j = i + 1;
    }

    while (j < lines.length && j < i + 8) {
      if (isQtyLine(lines[j])) break;
      if (!isHeaderLine(lines[j]) && !isFooterLine(lines[j]) && !isShortCode(lines[j])) {
        descParts.push(lines[j]);
      } else if (isShortCode(lines[j]) && !code && descParts.length === 0) {
        code = lines[j];
      }
      j++;
    }

    if (j >= lines.length || !isQtyLine(lines[j])) {
      i++;
      continue;
    }

    const qty = parseArgentineNumber(lines[j]) ?? 1;
    j++;

    if (j < lines.length && isUnitLine(lines[j])) j++;

    const amounts: number[] = [];
    let ivaRate: number | undefined;
    while (j < lines.length && j < i + 18) {
      const cur = lines[j];
      if (isFooterLine(cur) || isHeaderLine(cur)) break;
      const pctRate = parseIvaPercentLine(cur);
      if (pctRate != null) {
        ivaRate = pctRate;
        j++;
        continue;
      }
      if (isAmountLine(cur)) {
        const n = parseArgentineNumber(cur);
        if (n != null) amounts.push(n);
        j++;
        if (amounts.length >= amountLimit) break;
        continue;
      }
      if (descParts.length === 0 && !isShortCode(cur)) {
        break;
      }
      break;
    }

    if (descParts.length > 0 && amounts.length > 0) {
      pushItem(
        items,
        applyAmountFields(
          {
            product_code: code,
            description: descParts.join(' '),
            quantity: qty,
          },
          qty,
          amounts,
          layout,
          ivaRate
        )
      );
      i = j;
      continue;
    }

    i++;
  }

  return items;
}

/** Texto de tabla aplanado (saltos de línea → espacios). */
function parseItemsFlattened(section: string, layout: ArcaTableLayout): ParsedSalesInvoiceItem[] {
  const flat = section
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const items: ParsedSalesInvoiceItem[] = [];
  const rowRe =
    /(.{2,120}?)\s+([\d.]+,\d{2})\s+(?:unidades?|u\.?\s*med\.?|\d{1,2})\s+([\d.]+,\d{2}(?:\s+[\d.]+,\d{2}){1,3})(?:\s+(\d+(?:[.,]\d+)?)\s*%)?(?:\s+([\d.]+,\d{2}))?/gi;

  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(flat)) !== null) {
    const rawDesc = match[1].trim();
    const codeSplit = rawDesc.match(/^(\S+)\s+(.+)$/);
    const quantity = parseArgentineNumber(match[2]) ?? 1;
    const amounts = collectTrailingAmounts(match[3]);
    const ivaRate = match[4] ? parseIvaPercentLine(`${match[4]}%`) : undefined;
    if (match[5]) {
      const gross = parseArgentineNumber(match[5]);
      if (gross != null) amounts.push(gross);
    }
    pushItem(
      items,
      applyAmountFields(
        {
          product_code: codeSplit && isShortCode(codeSplit[1]) ? codeSplit[1] : undefined,
          description: codeSplit && isShortCode(codeSplit[1]) ? codeSplit[2] : rawDesc,
          quantity,
        },
        quantity,
        amounts,
        layout,
        ivaRate
      )
    );
  }

  return items;
}

function extractItems(text: string): ParsedSalesInvoiceItem[] {
  const section = findTableSection(text);
  const layout = detectArcaTableLayout(section);

  const attempts = [
    () => parseItemsInline(section, layout),
    () => parseItemsStacked(section, layout),
    () => parseItemsFlattened(section, layout),
    () => parseItemsStacked(text, detectArcaTableLayout(text)),
    () => parseItemsInline(text, detectArcaTableLayout(text)),
    () => parseItemsFlattened(text, detectArcaTableLayout(text)),
  ];

  for (const attempt of attempts) {
    const found = attempt();
    if (found.length > 0) return found;
  }

  const total = extractTotal(text);
  if (total != null && total > 0) {
    return [
      {
        line_number: 1,
        quantity: 1,
        description: 'Importación PDF — detalle no detectado',
        unit_price: total,
        subtotal: total,
      },
    ];
  }

  return [];
}

function extractTotal(text: string): number | undefined {
  const patterns = [
    /importe\s+total\s*:?\s*\$?\s*([\d.\s]+,\d{2})/i,
    /importe\s+total[\s\n\r]+\$?\s*([\d.\s]+,\d{2})/i,
    /total\s+a\s+pagar\s*:?\s*\$?\s*([\d.\s]+,\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const n = parseArgentineNumber(match[1]);
      if (n != null && n > 0) return n;
    }
  }
  return undefined;
}

export function detectArcaInvoiceDocument(text: string): boolean {
  if (!text?.trim()) return false;
  return (
    /FACTURA\s+[ABC]/i.test(text) ||
    /NOTA\s+DE\s+CR[EÉ]DITO\s+[ABC]/i.test(text) ||
    /CAE\s*N[°º]?\s*:?\s*\d{14}/i.test(text) ||
    (/punto\s+de\s+venta/i.test(text) && /comp\.?\s*nro/i.test(text))
  );
}

export function parseArcaInvoicePdfText(text: string): ParsedSalesInvoice {
  const comprobante = extractComprobante(text);

  const puntoVentaMatch = text.match(/punto\s+de\s+venta\s*:?\s*([\d\s]+)/i);
  const numeroMatch = text.match(/comp\.?\s*nro\.?\s*:?\s*([\d\s]+)/i);
  const fechaEmisionMatch = text.match(/fecha\s+de\s+emisi[oó]n\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  const caeMatch = text.match(/CAE\s*N[°º]?\s*:?\s*(\d{14})/i);
  const caeVtoMatch = text.match(
    /fecha\s+de\s+vto\.?\s+de\s+cae\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i
  );
  const qrMatch = text.match(/(https?:\/\/[^\s]+afip[^\s]+)/i);

  const cuits = extractCuits(text);
  const receptor = extractReceptorBlock(text);
  const cuitEmisor = extractEmisorCuit(text, cuits);

  let cuitReceptor: string | undefined = receptor.cuit ?? cuits.find((c) => c !== cuitEmisor);
  if (!cuitReceptor && cuits.length > 1) {
    cuitReceptor = cuits.find((c) => c !== cuitEmisor);
  }

  const items = extractItems(text);
  const itemsTotal = items.reduce(
    (sum, item) => sum + (item.subtotal_gross ?? item.subtotal ?? 0),
    0
  );
  const parsedTotal = extractTotal(text);

  return {
    provider: detectArcaInvoiceDocument(text) ? 'arca_afip' : 'generic',
    document_type: comprobante.document_type,
    comprobante_tipo: comprobante.tipo,
    comprobante_letra: comprobante.letra,
    punto_venta: puntoVentaMatch ? parseDigits(puntoVentaMatch[1]) : undefined,
    numero: numeroMatch ? parseDigits(numeroMatch[1]) : undefined,
    fecha_emision: fechaEmisionMatch ? parseDateToIso(fechaEmisionMatch[1]) : undefined,
    cae: caeMatch?.[1],
    cae_vto: caeVtoMatch ? parseDateToIso(caeVtoMatch[1]) : undefined,
    cuit_emisor: cuitEmisor,
    cuit_receptor: cuitReceptor,
    receptor_razon_social: receptor.razon_social,
    receptor_condicion_iva: receptor.condicion_iva,
    total_amount: parsedTotal ?? (itemsTotal > 0 ? itemsTotal : undefined),
    qr_url: qrMatch?.[1],
    items,
    raw_text_preview: text.slice(0, 800),
  };
}

/** Información de depuración para afinar el parser con PDFs reales. */
export function debugArcaPdfExtraction(text: string) {
  const section = findTableSection(text);
  const layout = detectArcaTableLayout(section);
  const parsed = parseArcaInvoicePdfText(text);
  const allLines = text.split(/\r?\n/);

  const tableLines = allLines
    .map((line, index) => ({ lineNumber: index + 1, text: line.trim() }))
    .filter(({ text: line }) => line.length > 0)
    .filter(
      ({ text: line }) =>
        /cantidad|producto|c[oó]digo|precio|subtotal|bonif|al[ií]cuota|unidades|[\d.]+,\d{2}|^\d+%$/i.test(
          line
        )
    );

  const itemsSum = parsed.items.reduce(
    (sum, item) => sum + (item.subtotal_gross ?? item.subtotal ?? 0),
    0
  );

  return {
    detected: detectArcaInvoiceDocument(text),
    charCount: text.length,
    lineCount: allLines.length,
    tableLayout: layout,
    tableSectionLength: section.length,
    tableSectionPreview: section.slice(0, 2000),
    tableLines: tableLines.slice(0, 100),
    parsed,
    checks: {
      hasCae: Boolean(parsed.cae),
      hasPvNumero: Boolean(parsed.punto_venta && parsed.numero),
      hasFecha: Boolean(parsed.fecha_emision),
      itemCount: parsed.items.length,
      totalPdf: parsed.total_amount ?? null,
      itemsSumGross: itemsSum > 0 ? Math.round(itemsSum * 100) / 100 : null,
      totalMatchesItems:
        parsed.total_amount != null && itemsSum > 0
          ? Math.abs(parsed.total_amount - itemsSum) < 0.05
          : null,
    },
    rawTextPreview: text.slice(0, 1200),
  };
}
