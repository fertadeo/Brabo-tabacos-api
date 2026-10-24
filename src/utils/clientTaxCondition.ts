import { Personeria } from '../types';

export type ClientTaxCondition =
  | 'inscripto'
  | 'consumidor_final'
  | 'monotributo'
  | 'responsable_inscripto'
  | 'exento';

export const CLIENT_TAX_CONDITIONS: ClientTaxCondition[] = [
  'inscripto',
  'consumidor_final',
  'monotributo',
  'responsable_inscripto',
  'exento'
];

const TAX_TO_AFIP: Record<ClientTaxCondition, number> = {
  responsable_inscripto: 1,
  inscripto: 1,
  exento: 4,
  consumidor_final: 5,
  monotributo: 6
};

export function normalizeTaxCondition(raw: unknown): ClientTaxCondition | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = String(raw).trim().toLowerCase().replace(/\s+/g, '_');
  return CLIENT_TAX_CONDITIONS.includes(n as ClientTaxCondition)
    ? (n as ClientTaxCondition)
    : null;
}

export function defaultTaxConditionForPersoneria(personeria: Personeria): ClientTaxCondition {
  if (personeria === Personeria.PERSONA_JURIDICA) return 'responsable_inscripto';
  return 'consumidor_final';
}

export function isTaxConditionAllowedForPersoneria(
  personeria: Personeria,
  taxCondition: ClientTaxCondition
): boolean {
  if (personeria === Personeria.CONSUMIDOR_FINAL) {
    return taxCondition === 'consumidor_final';
  }
  if (personeria === Personeria.PERSONA_JURIDICA) {
    return taxCondition === 'responsable_inscripto' || taxCondition === 'exento';
  }
  return ['inscripto', 'consumidor_final', 'monotributo'].includes(taxCondition);
}

export function afipCondicionFromTaxCondition(taxCondition: ClientTaxCondition): number {
  return TAX_TO_AFIP[taxCondition];
}

export function taxConditionFromAfipCode(
  code: number | null | undefined,
  personeria?: Personeria | string | null
): ClientTaxCondition | null {
  if (code == null || !Number.isFinite(Number(code))) return null;
  const c = Number(code);
  const p = personeria as Personeria | undefined;

  if (c === 6) return 'monotributo';
  if (c === 5) return 'consumidor_final';
  if (c === 4 || c === 10) return 'exento';
  if (c === 1) {
    return p === Personeria.PERSONA_FISICA ? 'inscripto' : 'responsable_inscripto';
  }
  if (c === 9) return 'consumidor_final';

  return null;
}

/** Resuelve tax_condition + condicion_iva_receptor coherentes para persistir. */
export function resolveClientTaxFields(input: {
  tax_condition?: unknown;
  condicion_iva_receptor?: unknown;
  personeria?: Personeria;
}): { tax_condition: ClientTaxCondition; condicion_iva_receptor: number } {
  const personeria = input.personeria ?? Personeria.CONSUMIDOR_FINAL;
  let tax = normalizeTaxCondition(input.tax_condition);

  const rawCode = input.condicion_iva_receptor;
  let code =
    rawCode !== undefined && rawCode !== null && rawCode !== ''
      ? Number(rawCode)
      : NaN;

  if (tax && !isTaxConditionAllowedForPersoneria(personeria, tax)) {
    tax = defaultTaxConditionForPersoneria(personeria);
  }

  if (!tax) {
    if (Number.isFinite(code)) {
      tax = taxConditionFromAfipCode(code, personeria) ?? defaultTaxConditionForPersoneria(personeria);
    } else {
      tax = defaultTaxConditionForPersoneria(personeria);
    }
  }

  if (!Number.isFinite(code) || code < 1) {
    code = afipCondicionFromTaxCondition(tax);
  }

  return { tax_condition: tax, condicion_iva_receptor: code };
}
