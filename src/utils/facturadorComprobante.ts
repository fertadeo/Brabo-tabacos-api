/**
 * Reglas y sugerencias de tipo de comprobante WSFE (A / B / C).
 * Evita errores frecuentes como emitir Factura C (11) cuando el emisor es RI y corresponde B (6).
 */

import {
  afipCondicionFromTaxCondition,
  normalizeTaxCondition
} from './clientTaxCondition';

export const WSFE_TIPOS = {
  1: { label: 'Factura A', requiereIva: true },
  2: { label: 'Nota de débito A', requiereIva: true },
  3: { label: 'Nota de crédito A', requiereIva: true },
  6: { label: 'Factura B', requiereIva: true },
  7: { label: 'Nota de débito B', requiereIva: true },
  8: { label: 'Nota de crédito B', requiereIva: true },
  11: { label: 'Factura C', requiereIva: false }
} as const;

export type WsfeTipo = keyof typeof WSFE_TIPOS;

export type EmisorRegimenFiscal = 'responsable_inscripto' | 'monotributo' | 'exento';

export interface ComprobanteFiscalInput {
  tipo: number;
  condicionIvaReceptor: number;
  docTipo?: number;
  docNro?: number | string | null;
  emisorRegimen?: EmisorRegimenFiscal;
}

export interface ComprobanteIssue {
  code: string;
  message: string;
  suggestedTipo?: number;
  suggestedLabel?: string;
}

export interface ComprobanteValidationResult {
  valid: boolean;
  issues: ComprobanteIssue[];
  suggestedTipo: number;
  suggestedLabel: string;
  tipoUsado: number;
  condicionIvaReceptor: number;
}

export const CONDICION_IVA = {
  1: 'Responsable inscripto',
  4: 'Exento',
  5: 'Consumidor final',
  6: 'Monotributo',
  7: 'No categorizado',
  8: 'No responsable',
  9: 'Monotributo social',
  10: 'Monotributo trabajador independiente'
} as const;

export function getCondicionIvaLabel(codigo: number | null | undefined): string | null {
  if (codigo == null || !Number.isFinite(Number(codigo))) return null;
  return CONDICION_IVA[codigo as keyof typeof CONDICION_IVA] ?? `Condición IVA ${codigo}`;
}

export function getEmisorRegimenFromEnv(): EmisorRegimenFiscal {
  const raw = (process.env.FACTURADOR_EMISOR_REGIMEN || 'responsable_inscripto')
    .trim()
    .toLowerCase();
  if (raw === 'monotributo' || raw === 'mt') return 'monotributo';
  if (raw === 'exento') return 'exento';
  return 'responsable_inscripto';
}

export function getDefaultTipoFromEnv(): number {
  const fromEnv = Number(process.env.FACTURADOR_TIPO_DEFAULT);
  if (Number.isFinite(fromEnv) && WSFE_TIPOS[fromEnv as WsfeTipo]) {
    return fromEnv;
  }
  const regimen = getEmisorRegimenFromEnv();
  return regimen === 'responsable_inscripto' ? 6 : 11;
}

export function getTipoLabel(tipo: number): string {
  return WSFE_TIPOS[tipo as WsfeTipo]?.label ?? `Comprobante tipo ${tipo}`;
}

export type WsfeComprobanteClase = 'A' | 'B' | 'C';

const TIPOS_CLASE_A = new Set([1, 2, 3, 4, 5]);
const TIPOS_CLASE_B = new Set([6, 7, 8, 9, 10]);
const CONDICION_IVA_SOLO_AMC = new Set([1, 6, 13, 16]);
/** Lista WSFE clase B (FEParamGetCondicionIvaReceptor): 4, 5, 7, 8, 9, 10, 15 — no incluye 6. */
const CONDICION_IVA_SOLO_BC = new Set([4, 5, 7, 8, 9, 10, 15]);

/** Condiciones monotributo en el ERP/padrón que en Factura B se envían como CF (5) a WSFE. */
const CONDICION_IVA_MONOTRIBUTO_ERP = new Set([6, 9, 10, 13, 16]);

export function isCondicionIvaMonotributoErp(codigo: number): boolean {
  return CONDICION_IVA_MONOTRIBUTO_ERP.has(Number(codigo));
}

export function getWsfeComprobanteClase(tipo: number): WsfeComprobanteClase {
  if (TIPOS_CLASE_A.has(tipo)) return 'A';
  if (TIPOS_CLASE_B.has(tipo)) return 'B';
  return 'C';
}

/**
 * Condición IVA del receptor para el payload WSFE.
 * En el ERP/padrón el monotributista es 6; en Factura B WSFE exige un código de la lista clase B
 * (4, 5, 7, 8, 9, 10, 15). Receptor monotributo con CUIT sin crédito fiscal → 5 (consumidor final).
 * Factura C conserva la condición ERP (6).
 */
export function resolveCondicionIvaReceptorForWsfe(
  tipo: number,
  condicionErp: number
): number {
  const codigo = Number(condicionErp);
  if (
    getWsfeComprobanteClase(tipo) === 'B' &&
    CONDICION_IVA_MONOTRIBUTO_ERP.has(codigo)
  ) {
    return 5;
  }
  return codigo;
}

/** @deprecated Usar resolveCondicionIvaReceptorForWsfe */
export function normalizeCondicionIvaReceptorForWsfe(
  tipo: number,
  condicionIvaReceptor: number
): number {
  return resolveCondicionIvaReceptorForWsfe(tipo, condicionIvaReceptor);
}

export function inferCondicionIvaErpFromClient(client: {
  personeria?: string;
  cuil_cuit?: string | null;
  tax_condition?: string | null;
  condicion_iva_receptor?: number | null;
} | null | undefined): number | null {
  if (!client) return null;

  if (
    client.condicion_iva_receptor != null &&
    Number.isFinite(Number(client.condicion_iva_receptor)) &&
    Number(client.condicion_iva_receptor) >= 1
  ) {
    return Number(client.condicion_iva_receptor);
  }

  const tax = normalizeTaxCondition(client.tax_condition);
  if (tax) return afipCondicionFromTaxCondition(tax);

  if (client.personeria === 'persona_juridica') return 1;
  if (client.personeria === 'consumidor_final') return 5;

  return null;
}

/** Bloquea emitir como consumidor final (5) si el cliente tiene otra condición fiscal (salvo Factura B + monotributo WSFE). */
export function validateNoConsumidorFinalSiOtraCondicion(
  condicionPayload: number,
  client: {
    personeria?: string;
    cuil_cuit?: string | null;
    tax_condition?: string | null;
    condicion_iva_receptor?: number | null;
  } | null | undefined,
  tipoComprobante?: number
): ComprobanteIssue | null {
  if (Number(condicionPayload) !== 5) return null;

  const tipo = Number(tipoComprobante ?? 6);
  const condicionErp = inferCondicionIvaErpFromClient(client);
  if (
    getWsfeComprobanteClase(tipo) === 'B' &&
    condicionErp != null &&
    CONDICION_IVA_MONOTRIBUTO_ERP.has(condicionErp)
  ) {
    return null;
  }

  if (condicionErp != null && condicionErp !== 5) {
    return {
      code: 'RECEPTOR_CF_CON_CONDICION_ERP',
      message: `El cliente tiene condición IVA ${condicionErp} en el ERP; no se puede facturar como Consumidor final (5). Revisá los datos fiscales o consultá padrón ARCA.`
    };
  }

  const tax = normalizeTaxCondition(client?.tax_condition);
  if (tax && tax !== 'consumidor_final') {
    return {
      code: 'RECEPTOR_CF_CON_CONDICION_ERP',
      message: `El cliente está registrado como «${tax}»; no corresponde emitir con condición Consumidor final (5).`
    };
  }

  const cuit = String(client?.cuil_cuit ?? '').replace(/\D/g, '');
  if (
    cuit.length === 11 &&
    client?.personeria !== 'consumidor_final' &&
    (tax == null || tax !== 'consumidor_final')
  ) {
    return {
      code: 'RECEPTOR_CF_CON_CONDICION_ERP',
      message:
        'El cliente tiene CUIT/CUIL pero no está marcado como consumidor final. Completá la condición fiscal en el ERP o consultá padrón ARCA antes de emitir.'
    };
  }

  return null;
}

export function isWsfeTipoSupported(tipo: number): boolean {
  return tipo in WSFE_TIPOS;
}

/**
 * Condición IVA del receptor (ARCA) a partir del cliente del ERP.
 */
export function inferCondicionIvaReceptor(client: {
  personeria?: string;
  cuil_cuit?: string | null;
  tax_condition?: string | null;
  condicion_iva_receptor?: number | null;
} | null | undefined): number {
  if (!client) return 5;

  if (
    client.condicion_iva_receptor != null &&
    Number.isFinite(Number(client.condicion_iva_receptor)) &&
    Number(client.condicion_iva_receptor) >= 1
  ) {
    return Number(client.condicion_iva_receptor);
  }

  const tax = normalizeTaxCondition(client.tax_condition);
  if (tax) return afipCondicionFromTaxCondition(tax);

  if (client.personeria === 'persona_juridica') return 1;
  if (client.personeria === 'consumidor_final') return 5;

  const hasCuit = String(client.cuil_cuit ?? '').replace(/\D/g, '').length === 11;
  // CUIT/CUIL sin condición fiscal: no asumir consumidor final (AFIP rechaza docTipo 80 + condición 5).
  if (hasCuit) return 6;

  return 5;
}

/** docTipo 80 + condición 5: solo consumidor final real; no monotributo/RI con otra condición. */
export function validateReceptorDocumentoCondicion(input: {
  docTipo?: number;
  docNro?: number | string | null;
  condicionIvaReceptor?: number;
  tipo?: number;
}): ComprobanteIssue | null {
  const docTipo = Number(input.docTipo ?? 99);
  const condicion = Number(input.condicionIvaReceptor ?? 5);
  const tipo = Number(input.tipo ?? 6);
  const docNroRaw =
    input.docNro !== undefined && input.docNro !== null
      ? String(input.docNro).replace(/\D/g, '')
      : '';
  const tieneCuit = docTipo === 80 && docNroRaw.length === 11 && docNroRaw !== '0';

  if (tieneCuit && condicion === 5 && getWsfeComprobanteClase(tipo) !== 'B') {
    return {
      code: 'RECEPTOR_CUIT_CONDICION_INVALIDA',
      message:
        'Con CUIT/CUIL (docTipo 80) y condición Consumidor final (5) solo corresponde Factura B a un consumidor final identificado. Para RI usá Factura A (tipo 1) con condición 1.',
      suggestedTipo: 1,
      suggestedLabel: WSFE_TIPOS[1].label
    };
  }

  if (tieneCuit && condicion === 1 && getWsfeComprobanteClase(tipo) === 'B') {
    return {
      code: 'RECEPTOR_RI_USAR_FACTURA_A',
      message:
        'El receptor es Responsable Inscripto (condición 1): corresponde Factura A (tipo 1), no Factura B con consumidor final.',
      suggestedTipo: 1,
      suggestedLabel: WSFE_TIPOS[1].label
    };
  }

  return null;
}

/**
 * Tipo WSFE sugerido según régimen del emisor y condición IVA del receptor.
 */
export function suggestTipoComprobante(
  condicionIvaReceptor: number,
  emisorRegimen: EmisorRegimenFiscal = getEmisorRegimenFromEnv()
): { tipo: number; label: string; motivo: string } {
  if (emisorRegimen === 'monotributo' || emisorRegimen === 'exento') {
    return {
      tipo: 11,
      label: WSFE_TIPOS[11].label,
      motivo:
        emisorRegimen === 'monotributo'
          ? 'Emisor monotributo: se factura con Factura C.'
          : 'Emisor exento: se factura con Factura C.'
    };
  }

  if (condicionIvaReceptor === 1) {
    return {
      tipo: 1,
      label: WSFE_TIPOS[1].label,
      motivo: 'Emisor RI y receptor responsable inscripto: corresponde Factura A.'
    };
  }

  if (CONDICION_IVA_MONOTRIBUTO_ERP.has(condicionIvaReceptor)) {
    return {
      tipo: 1,
      label: WSFE_TIPOS[1].label,
      motivo: 'Emisor RI y receptor monotributo: corresponde Factura A (tabla ARCA).'
    };
  }

  return {
    tipo: 6,
    label: WSFE_TIPOS[6].label,
    motivo:
      'Emisor responsable inscripto frente a consumidor final o exento: corresponde Factura B (con IVA discriminado).'
  };
}

export function validateComprobanteFiscal(input: ComprobanteFiscalInput): ComprobanteValidationResult {
  const emisorRegimen = input.emisorRegimen ?? getEmisorRegimenFromEnv();
  const condicionIvaReceptor = input.condicionIvaReceptor;
  const suggestion = suggestTipoComprobante(condicionIvaReceptor, emisorRegimen);
  const issues: ComprobanteIssue[] = [];
  const tipo = input.tipo;

  if (!isWsfeTipoSupported(tipo)) {
    issues.push({
      code: 'TIPO_COMPROBANTE_INVALIDO',
      message: `El tipo ${tipo} no es un comprobante WSFE soportado. Usá 1, 6 u 11 (A, B o C).`,
      suggestedTipo: suggestion.tipo,
      suggestedLabel: suggestion.label
    });
  }

  const tipoMeta = WSFE_TIPOS[tipo as WsfeTipo];

  if (emisorRegimen === 'responsable_inscripto' && tipo === 11) {
    issues.push({
      code: 'FACTURA_C_NO_APLICA_EMISOR_RI',
      message:
        'Factura C (tipo 11) no corresponde cuando el emisor es Responsable Inscripto. Para consumidor final o exento usá Factura B (tipo 6); para monotributo o RI, Factura A (tipo 1).',
      suggestedTipo: 6,
      suggestedLabel: WSFE_TIPOS[6].label
    });
  }

  if (
    (emisorRegimen === 'monotributo' || emisorRegimen === 'exento') &&
    tipo !== 11 &&
    [1, 2, 3, 6, 7, 8].includes(tipo)
  ) {
    issues.push({
      code: 'FACTURA_AB_NO_APLICA_EMISOR_MONOTRIBUTO',
      message: `Con emisor ${emisorRegimen === 'monotributo' ? 'monotributo' : 'exento'} no se emiten Facturas A/B; usá Factura C (tipo 11).`,
      suggestedTipo: 11,
      suggestedLabel: WSFE_TIPOS[11].label
    });
  }

  if (condicionIvaReceptor === 1 && tipo === 11) {
    issues.push({
      code: 'RECEPTOR_RI_NO_FACTURA_C',
      message:
        'El receptor es Responsable Inscripto: no se usa Factura C. Usá Factura A (tipo 1).',
      suggestedTipo: 1,
      suggestedLabel: WSFE_TIPOS[1].label
    });
  }

  if (condicionIvaReceptor === 1 && tipo === 6) {
    issues.push({
      code: 'RECEPTOR_RI_USAR_FACTURA_A',
      message:
        'El receptor es Responsable Inscripto: corresponde Factura A (tipo 1), no Factura B.',
      suggestedTipo: 1,
      suggestedLabel: WSFE_TIPOS[1].label
    });
  }

  if (tipo !== suggestion.tipo && issues.length === 0) {
    issues.push({
      code: 'TIPO_DISTINTO_AL_SUGERIDO',
      message: `Para este receptor (${CONDICION_IVA[condicionIvaReceptor as keyof typeof CONDICION_IVA] ?? condicionIvaReceptor}) se suele usar ${suggestion.label} (tipo ${suggestion.tipo}). Elegiste ${getTipoLabel(tipo)} (tipo ${tipo}).`,
      suggestedTipo: suggestion.tipo,
      suggestedLabel: suggestion.label
    });
  }

  const docCondicionIssue = validateReceptorDocumentoCondicion({
    docTipo: input.docTipo,
    docNro: input.docNro,
    condicionIvaReceptor,
    tipo: input.tipo
  });
  if (docCondicionIssue) {
    issues.unshift(docCondicionIssue);
  }

  const blocking = issues.filter((i) =>
    [
      'FACTURA_C_NO_APLICA_EMISOR_RI',
      'FACTURA_AB_NO_APLICA_EMISOR_MONOTRIBUTO',
      'RECEPTOR_RI_NO_FACTURA_C',
      'RECEPTOR_RI_USAR_FACTURA_A',
      'TIPO_COMPROBANTE_INVALIDO',
      'RECEPTOR_CUIT_CONDICION_INVALIDA',
      'RECEPTOR_CF_CON_CONDICION_ERP'
    ].includes(i.code)
  );

  return {
    valid: blocking.length === 0,
    issues,
    suggestedTipo: suggestion.tipo,
    suggestedLabel: suggestion.label,
    tipoUsado: tipo,
    condicionIvaReceptor
  };
}

export function formatComprobanteIssuesForUser(issues: ComprobanteIssue[]): string {
  return issues.map((i) => i.message).join(' ');
}
