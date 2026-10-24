import zlib from 'zlib';
import { compressPdfBuffer, decompressPdfBuffer, isGzipBuffer } from './compressedPdfStorage';

describe('compressedPdfStorage', () => {
  it('comprime buffers repetitivos y los restaura', () => {
    const original = Buffer.from('PDF simulado '.repeat(500));
    const { buffer, compressed } = compressPdfBuffer(original);

    expect(compressed).toBe(true);
    expect(buffer.length).toBeLessThan(original.length);
    expect(decompressPdfBuffer(buffer, 'token.pdf.gz').toString()).toBe(original.toString());
  });

  it('conserva PDF ya comprimido si gzip no aporta ahorro', () => {
    const original = zlib.gzipSync(Buffer.from('ya comprimido'));
    const { buffer, compressed } = compressPdfBuffer(original);

    expect(compressed).toBe(false);
    expect(buffer).toEqual(original);
    expect(decompressPdfBuffer(buffer, 'token.pdf').toString()).toBe('ya comprimido');
  });

  it('detecta magic bytes gzip', () => {
    const gz = zlib.gzipSync(Buffer.from('test'));
    expect(isGzipBuffer(gz)).toBe(true);
    expect(isGzipBuffer(Buffer.from('%PDF-1.4'))).toBe(false);
  });
});
