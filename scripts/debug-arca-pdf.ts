/**
 * Depura la extracción de un PDF de factura ARCA.
 *
 * Uso:
 *   npx ts-node scripts/debug-arca-pdf.ts "C:\ruta\factura.pdf"
 *   npm run debug:arca-pdf -- "C:\ruta\factura.pdf"
 *
 * Genera en tmp/pdf-debug/:
 *   - <nombre>.raw.txt     texto completo que devuelve pdf-parse
 *   - <nombre>.debug.json  diagnóstico + resultado parseado
 */
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import { debugArcaPdfExtraction } from '../src/services/sales-documents/ArcaInvoicePdfParser';

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Indicá la ruta del PDF: npm run debug:arca-pdf -- ".\\factura.pdf"');
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`No existe el archivo: ${resolved}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(resolved);
  const pdfData = await pdf(buffer);
  const text = pdfData.text ?? '';

  console.log('--- PDF ---');
  console.log(`Archivo: ${resolved}`);
  console.log(`Páginas: ${pdfData.numpages}`);
  console.log(`Caracteres extraídos: ${text.length}`);

  const debug = debugArcaPdfExtraction(text);

  console.log('\n--- Layout tabla detectado ---');
  console.log(JSON.stringify(debug.tableLayout, null, 2));

  console.log('\n--- Chequeos automáticos ---');
  console.log(JSON.stringify(debug.checks, null, 2));

  console.log('\n--- Datos fiscales parseados ---');
  const p = debug.parsed;
  console.log(
    [
      `Tipo: ${p.comprobante_letra ?? '?'} (${p.comprobante_tipo ?? '?'})`,
      `PV-Nro: ${p.punto_venta ?? '?'} - ${p.numero ?? '?'}`,
      `Fecha: ${p.fecha_emision ?? '?'}`,
      `CAE: ${p.cae ?? '?'}`,
      `CUIT emisor: ${p.cuit_emisor ?? '?'}`,
      `CUIT receptor: ${p.cuit_receptor ?? '?'}`,
      `Receptor: ${p.receptor_razon_social ?? '?'}`,
      `Total: ${p.total_amount ?? '?'}`,
    ].join('\n')
  );

  console.log('\n--- Ítems ---');
  if (p.items.length === 0) {
    console.log('(ninguno detectado)');
  } else {
    for (const item of p.items) {
      console.log(
        [
          `#${item.line_number}`,
          item.description,
          `cant=${item.quantity}`,
          `neto=${item.unit_price_net ?? '?'}`,
          `iva=${item.iva_rate ?? '?'}%`,
          `c/iva=${item.subtotal_gross ?? item.subtotal ?? '?'}`,
        ].join(' | ')
      );
    }
  }

  console.log('\n--- Líneas relevantes (nº | texto) ---');
  for (const row of debug.tableLines) {
    console.log(`${String(row.lineNumber).padStart(4)} | ${row.text}`);
  }

  const outDir = path.join(process.cwd(), 'tmp', 'pdf-debug');
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.basename(resolved, path.extname(resolved));
  const rawPath = path.join(outDir, `${base}.raw.txt`);
  const debugPath = path.join(outDir, `${base}.debug.json`);

  fs.writeFileSync(rawPath, text, 'utf8');
  fs.writeFileSync(debugPath, JSON.stringify(debug, null, 2), 'utf8');

  console.log(`\nGuardado:\n  ${rawPath}\n  ${debugPath}`);
  console.log('\nTip: copiá un fragmento de .raw.txt al test ArcaInvoicePdfParser.test.ts');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
