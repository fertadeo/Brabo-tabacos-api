import { ComprobanteIssue, getCondicionIvaLabel, resolveCondicionIvaReceptorForWsfe } from './facturadorComprobante';

export interface PadronCondicionValidationResult {
  checked: boolean;
  coincide: boolean;
  condicionEnviada: number;
  condicionSugerida?: number | null;
  condicionSugeridaLabel?: string | null;
  issue?: ComprobanteIssue;
  advertencias?: string[];
  unavailable?: boolean;
}

export function shouldConsultarPadronCondicionIva(
  docTipo?: number,
  docNro?: number | string | null
): boolean {
  const tipo = Number(docTipo ?? 99);
  if (tipo !== 80) return false;
  const digits = String(docNro ?? '').replace(/\D/g, '');
  return digits.length === 11 && digits !== '0';
}

export function buildCondicionPadronMismatchIssue(
  condicionEnviada: number,
  condicionSugerida: number
): ComprobanteIssue {
  const enviadaLabel = getCondicionIvaLabel(condicionEnviada) ?? String(condicionEnviada);
  const sugeridaLabel = getCondicionIvaLabel(condicionSugerida) ?? String(condicionSugerida);
  return {
    code: 'RECEPTOR_CONDICION_PADRON_MISMATCH',
    message: `La condición IVA del receptor (${condicionEnviada} — ${enviadaLabel}) no coincide con el padrón ARCA (${condicionSugerida} — ${sugeridaLabel}).`
  };
}

/** Texto legible desde error.details del facturador (preflight WSFE). */
export function formatFacturadorPreflightDetails(
  details: Record<string, unknown> | null | undefined
): string | null {
  if (!details || typeof details !== 'object') return null;

  const parts: string[] = [];
  const push = (label: string, value: unknown) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      parts.push(`${label}: ${value.map(String).join(', ')}`);
      return;
    }
    if (typeof value === 'object') {
      parts.push(`${label}: ${JSON.stringify(value)}`);
      return;
    }
    parts.push(`${label}: ${String(value)}`);
  };

  push('condición enviada', details.condicionEnviada ?? details.condicionIvaReceptor);
  push('condición esperada', details.condicionEsperada ?? details.condicionSugerida);
  push('condiciones permitidas', details.condicionesPermitidas ?? details.condicionesValidas);
  push('tipo comprobante', details.tipo ?? details.tipoComprobante);

  const errores = details.errores;
  if (Array.isArray(errores)) {
    for (const e of errores) {
      if (typeof e === 'string' && e.trim()) parts.push(e.trim());
    }
  }

  if (typeof details.mensaje === 'string' && details.mensaje.trim()) {
    parts.push(details.mensaje.trim());
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

export function enrichPayloadWithPadronHints(
  payload: { docTipo?: number; docNro?: string; consultarSugerenciaCondicionIva?: boolean }
): void {
  if (shouldConsultarPadronCondicionIva(payload.docTipo, payload.docNro)) {
    payload.consultarSugerenciaCondicionIva = true;
  }
}

export function validateCondicionIvaConPadronSugerencia(
  condicionEnviada: number,
  sugerenciaPadron: number | null | undefined,
  advertencias?: string[],
  tipoComprobante?: number
): PadronCondicionValidationResult {
  const condicion = Number(condicionEnviada);
  if (sugerenciaPadron == null || !Number.isFinite(Number(sugerenciaPadron))) {
    return {
      checked: false,
      coincide: false,
      condicionEnviada: condicion,
      unavailable: true,
      advertencias: [
        ...(advertencias ?? []),
        'No se pudo obtener la condición IVA sugerida desde el padrón ARCA.'
      ]
    };
  }

  const sugerida = Number(sugerenciaPadron);
  const coincide =
    condicion === sugerida ||
    (tipoComprobante != null &&
      resolveCondicionIvaReceptorForWsfe(tipoComprobante, sugerida) === condicion);
  return {
    checked: true,
    coincide,
    condicionEnviada: condicion,
    condicionSugerida: sugerida,
    condicionSugeridaLabel: getCondicionIvaLabel(sugerida) ?? undefined,
    issue: coincide ? undefined : buildCondicionPadronMismatchIssue(condicion, sugerida),
    advertencias
  };
}

export function extractFacturadorErrorDetails(
  responseBody: unknown,
  details?: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (details && typeof details === 'object') return details;
  if (!responseBody || typeof responseBody !== 'object') return null;
  const body = responseBody as Record<string, unknown>;
  const err = body.error;
  if (err && typeof err === 'object') {
    const nested = (err as Record<string, unknown>).details;
    if (nested && typeof nested === 'object') return nested as Record<string, unknown>;
  }
  return null;
}
