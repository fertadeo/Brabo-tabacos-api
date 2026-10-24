/**
 * Recomprime PDFs ya guardados en uploads/ (ventas y compras).
 * Los archivos .pdf sin sufijo .gz se convierten a .pdf.gz cuando el ahorro supera el 5 %.
 *
 * Uso: npm run recompress:stored-pdfs
 *      npm run recompress:stored-pdfs -- --dry-run
 */
import fs from 'fs';
import path from 'path';
import { executeQuery } from '../src/config/database';
import { compressPdfBuffer, readStoredPdf } from '../src/utils/compressedPdfStorage';

const UPLOAD_ROOTS = [
  path.join(process.cwd(), 'uploads', 'sales-documents'),
  path.join(process.cwd(), 'uploads', 'purchase-documents'),
];

const DRY_RUN = process.argv.includes('--dry-run');

type PathUpdate = { table: string; column: string; oldPath: string; newPath: string };

async function recompressFile(filePath: string): Promise<PathUpdate | null> {
  if (!filePath.toLowerCase().endsWith('.pdf') || filePath.toLowerCase().endsWith('.pdf.gz')) {
    return null;
  }
  if (!fs.existsSync(filePath)) return null;

  const pdfBuffer = readStoredPdf(filePath);
  const { buffer, compressed } = compressPdfBuffer(pdfBuffer);
  if (!compressed) return null;

  const newPath = `${filePath}.gz`;
  if (!DRY_RUN) {
    fs.writeFileSync(newPath, buffer);
    fs.unlinkSync(filePath);
  }

  return { table: '', column: '', oldPath: filePath, newPath };
}

async function updateDbPaths(updates: PathUpdate[]): Promise<void> {
  for (const update of updates) {
    const tables: Array<{ table: string; column: string }> = [
      { table: 'sales_import_documents', column: 'stored_path' },
      { table: 'purchase_supplier_documents', column: 'stored_path' },
      { table: 'sales', column: 'source_file_path' },
      { table: 'supplier_delivery_notes', column: 'source_file_path' },
    ];

    for (const { table, column } of tables) {
      await executeQuery(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`, [
        update.newPath,
        update.oldPath,
      ]);
    }
  }
}

async function main(): Promise<void> {
  const updates: PathUpdate[] = [];
  let scanned = 0;

  for (const dir of UPLOAD_ROOTS) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      if (!entry.toLowerCase().endsWith('.pdf') || entry.toLowerCase().endsWith('.pdf.gz')) continue;
      scanned += 1;
      const result = await recompressFile(fullPath);
      if (result) updates.push(result);
    }
  }

  if (!DRY_RUN && updates.length > 0) {
    await updateDbPaths(updates);
  }

  console.log(
    JSON.stringify(
      {
        dry_run: DRY_RUN,
        scanned,
        recompressed: updates.length,
        files: updates.map((u) => ({ from: u.oldPath, to: u.newPath })),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
