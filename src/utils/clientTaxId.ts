export const CLIENT_TAX_ID_DNI_MIN = 7;
export const CLIENT_TAX_ID_DNI_MAX = 8;
export const CLIENT_TAX_ID_CUIT_LEN = 11;

export type ClientTaxIdKind = 'dni' | 'cuil_cuit';

export function normalizeClientTaxIdDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, CLIENT_TAX_ID_CUIT_LEN);
}

export function classifyClientTaxId(digits: string): ClientTaxIdKind | null {
  const len = digits.length;
  if (len === CLIENT_TAX_ID_CUIT_LEN) return 'cuil_cuit';
  if (len >= CLIENT_TAX_ID_DNI_MIN && len <= CLIENT_TAX_ID_DNI_MAX) return 'dni';
  return null;
}

export function isValidClientTaxId(value: string | null | undefined): boolean {
  const digits = normalizeClientTaxIdDigits(value);
  return digits.length > 0 && classifyClientTaxId(digits) != null;
}

export function docTipoFromClientTaxId(value: string | null | undefined): number {
  const digits = normalizeClientTaxIdDigits(value);
  const kind = classifyClientTaxId(digits);
  if (kind === 'cuil_cuit') return 80;
  if (kind === 'dni') return 96;
  return 99;
}

export function docNroFromClientTaxId(value: string | null | undefined): string | undefined {
  const digits = normalizeClientTaxIdDigits(value);
  if (!classifyClientTaxId(digits)) return undefined;
  return digits;
}

export function validateClientTaxIdBody(value: unknown): true {
  if (value === undefined || value === null || value === '') return true;
  const digits = normalizeClientTaxIdDigits(String(value));
  if (!classifyClientTaxId(digits)) {
    throw new Error('CUIL/CUIT/DNI must be 7-8 digits (DNI) or 11 digits (CUIL/CUIT)');
  }
  return true;
}
