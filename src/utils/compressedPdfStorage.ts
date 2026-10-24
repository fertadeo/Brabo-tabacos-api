import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/** Solo guardar gzip si reduce al menos un 5 % respecto al PDF original. */
const GZIP_MIN_SAVINGS_RATIO = 0.95;

export interface StoredPdfResult {
  storedPath: string;
  mimeType: string;
  originalBytes: number;
  storedBytes: number;
  compressed: boolean;
}

export function isGzipBuffer(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

export function compressPdfBuffer(pdfBuffer: Buffer): { buffer: Buffer; compressed: boolean } {
  const gzipped = zlib.gzipSync(pdfBuffer, { level: zlib.constants.Z_BEST_COMPRESSION });
  if (gzipped.length < pdfBuffer.length * GZIP_MIN_SAVINGS_RATIO) {
    return { buffer: gzipped, compressed: true };
  }
  return { buffer: pdfBuffer, compressed: false };
}

export function decompressPdfBuffer(raw: Buffer, storedPath?: string): Buffer {
  const shouldGunzip =
    storedPath?.toLowerCase().endsWith('.gz') || isGzipBuffer(raw);
  if (shouldGunzip) {
    return zlib.gunzipSync(raw);
  }
  return raw;
}

export function savePdfDocument(
  uploadDir: string,
  fileToken: string,
  pdfBuffer: Buffer
): StoredPdfResult {
  const { buffer, compressed } = compressPdfBuffer(pdfBuffer);
  const filename = compressed ? `${fileToken}.pdf.gz` : `${fileToken}.pdf`;
  const storedPath = path.join(uploadDir, filename);
  fs.writeFileSync(storedPath, buffer);

  return {
    storedPath,
    mimeType: 'application/pdf',
    originalBytes: pdfBuffer.length,
    storedBytes: buffer.length,
    compressed,
  };
}

export function readStoredPdf(storedPath: string): Buffer {
  if (!fs.existsSync(storedPath)) {
    throw new Error(`Archivo PDF no encontrado: ${storedPath}`);
  }
  const raw = fs.readFileSync(storedPath);
  return decompressPdfBuffer(raw, storedPath);
}
