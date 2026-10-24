/**
 * Mensajes y acciones recomendadas para errores del facturador MultiCUIT / ARCA.
 * Alineado con integración ERP (emisión WSFE, CAE y vencimiento).
 */

export interface FacturadorResolvedError {
  code: string;
  /** Mensaje principal para operador / frontend */
  message: string;
  /** Texto original del facturador o ARCA, si difiere */
  detail?: string;
  /** Qué hacer a continuación */
  action: string;
  retryable: boolean;
  httpStatus: number;
  suggestions?: string[];
}

export interface ResolveFacturadorErrorInput {
  code?: string | null;
  remoteMessage?: string | null;
  httpStatus?: number;
  details?: Record<string, unknown> | null;
}

const DEFAULT: Omit<FacturadorResolvedError, 'code' | 'detail'> = {
  message: 'No se pudo emitir la factura en ARCA.',
  action: 'Revisá el detalle del error o contactá a soporte con el código y requestId.',
  retryable: false,
  httpStatus: 502
};

/** Códigos de negocio del facturador y errores locales de MF API */
const BY_CODE: Record<string, Omit<FacturadorResolvedError, 'code' | 'detail'>> = {
  VALIDATION_ERROR: {
    message: 'Los datos del comprobante no son válidos para ARCA.',
    action: 'Corregí tipo, importe, IVA, documento del receptor y demás campos; no reintentés con el mismo payload.',
    retryable: false,
    httpStatus: 400,
    suggestions: [
      'Revisá tipo de comprobante, punto de venta y condición IVA del receptor.',
      'Para concepto 2 o 3 incluí fechaServicioDesde y fechaServicioHasta.',
      'Factura A/B requiere desglose de IVA correcto.'
    ]
  },
  IDEMPOTENCY_CONFLICT: {
    message: 'Ya existe una emisión con la misma clave de idempotencia pero con datos distintos.',
    action: 'No reintentés a ciegas: revisá si la factura ya se emitió o usá otra Idempotency-Key solo si corresponde un comprobante nuevo.',
    retryable: false,
    httpStatus: 409,
    suggestions: [
      'Consultá en el facturador si el comprobante ya tiene CAE.',
      'Si fue un error de datos, corregí el payload antes de cambiar la clave.'
    ]
  },
  IDEMPOTENCY_REQUIRES_DB: {
    message: 'El facturador no puede registrar idempotencia (base de datos no disponible).',
    action: 'Reintentá más tarde; evitá duplicar emisiones hasta que el servicio esté estable.',
    retryable: true,
    httpStatus: 400
  },
  WSFE_NO_CAE: {
    message: 'ARCA no devolvió CAE para este comprobante.',
    action: 'No marques la venta como facturada. Revisá punto de venta, tipo, homologación/producción y certificados del CUIT emisor.',
    retryable: false,
    httpStatus: 502,
    suggestions: [
      'Verificá GET /api/facturas/health/:cuit en el facturador.',
      'Confirmá que AFIP_ENV y certificados coincidan (testing vs producción).'
    ]
  },
  CAE_MISSING: {
    message: 'La respuesta de emisión no incluye un CAE válido.',
    action: 'No autorices el comprobante en el ERP. Revisá en ARCA o consultá el detalle por facturaId antes de reemitir.',
    retryable: false,
    httpStatus: 502,
    suggestions: ['Podés tratarse de WSFE_NO_CAE: no asignes un nuevo número sin reconciliar.']
  },
  PERSIST_DB_ERROR: {
    message: 'La factura pudo autorizarse en AFIP pero falló el guardado en el facturador.',
    action: 'No reemitas con un número nuevo. Guardá el requestId y consultá soporte o GET /api/facturas/:facturaId si tenés facturaId.',
    retryable: false,
    httpStatus: 500,
    suggestions: [
      'El CAE puede existir en ARCA aunque no esté en la base del facturador.',
      'Reconciliá antes de volver a POST /api/facturas.'
    ]
  },
  AUTH_MISSING_KEY: {
    message: 'Falta autenticación con el facturador.',
    action: 'Configurá FACTURADOR_API_KEY en el servidor o la cabecera autorizada x-facturador-api-key.',
    retryable: false,
    httpStatus: 401
  },
  AUTH_INVALID_KEY: {
    message: 'La API key del facturador no es válida o fue revocada.',
    action: 'Verificá FACTURADOR_API_KEY (formato mck_…) o generá una nueva en el panel MultiCUIT.',
    retryable: false,
    httpStatus: 401
  },
  CUIT_NO_AUTORIZADO: {
    message: 'El CUIT emisor no está habilitado para esta organización en el facturador.',
    action: 'Usá un CUIT dado de alta en la org o corregí cuitEmisor / FACTURADOR_CUIT_EMISOR.',
    retryable: false,
    httpStatus: 403
  },
  ARCA_ERROR: {
    message: 'ARCA rechazó la solicitud de facturación.',
    action: 'Leé el mensaje de ARCA en el detalle; corregí datos o esperá si es un error transitorio.',
    retryable: false,
    httpStatus: 502
  },
  RATE_LIMIT_EXCEEDED: {
    message: 'Se superó el límite de solicitudes al facturador.',
    action: 'Esperá el tiempo indicado en retryAfter y reintentá la misma Idempotency-Key.',
    retryable: true,
    httpStatus: 429
  },
  FACTURADOR_TIMEOUT: {
    message: 'Tiempo de espera agotado al conectar con el facturador.',
    action: 'Reintentá con la misma Idempotency-Key; si persiste, revisá red y FACTURADOR_BASE_URL.',
    retryable: true,
    httpStatus: 504
  },
  FACTURADOR_CONNECTION_ERROR: {
    message: 'No se pudo conectar con el facturador.',
    action: 'Verificá URL, firewall y que el servicio esté en línea; reintentá con la misma Idempotency-Key.',
    retryable: true,
    httpStatus: 502
  },
  FACTURADOR_UNAVAILABLE: {
    message: 'El facturador no respondió al control de disponibilidad.',
    action: 'Reintentá en unos minutos; si continúa, revisá FACTURADOR_BASE_URL y estado del servicio.',
    retryable: true,
    httpStatus: 503
  },
  FACTURADOR_NOT_CONFIGURED: {
    message: 'El facturador ARCA no está configurado en este servidor.',
    action: 'Definí FACTURADOR_BASE_URL y FACTURADOR_API_KEY (o cabecera x-facturador-api-key si está permitida).',
    retryable: false,
    httpStatus: 503
  },
  FACTURACION_ERROR: {
    message: 'Error al facturar la venta en ARCA.',
    action: 'Revisá el código de error y el detalle; contactá soporte si no podés resolverlo.',
    retryable: false,
    httpStatus: 500
  },
  INVALID_CUIT: {
    message: 'El CUIT debe tener 11 dígitos.',
    action: 'Ingresá un CUIT válido de 11 dígitos (con o sin guiones).',
    retryable: false,
    httpStatus: 400
  },
  QUOTA_FEATURE_DISABLED: {
    message: 'El plan del facturador no incluye consulta de padrón ARCA.',
    action: 'Contactá al operador de MultiCUIT para habilitar padron_habilitado en el plan.',
    retryable: false,
    httpStatus: 403
  },
  PADRON_MULTI_SCOPE_FAILED: {
    message: 'No se pudo consultar el padrón ARCA (A13 y constancia fallaron).',
    action: 'Verificá que el certificado del CUIT emisor tenga autorizado padrón A13 y constancia de inscripción.',
    retryable: true,
    httpStatus: 502
  },
  EMPRESA_NO_REGISTRADA: {
    message: 'El CUIT emisor no está registrado en el facturador.',
    action: 'Dá de alta el CUIT emisor en MultiCUIT o corregí cuitEmisor / FACTURADOR_CUIT_EMISOR.',
    retryable: false,
    httpStatus: 422
  },
  COMPROBANTE_TIPO_INVALIDO: {
    message: 'El tipo de comprobante no es válido para tu régimen fiscal o el receptor.',
    action: 'Revisá tipo (6=Factura B, 11=Factura C, 1=Factura A) y condicionIvaReceptor; usá GET /api/sales/:id/facturar/sugerencia.',
    retryable: false,
    httpStatus: 400,
    suggestions: [
      'Emisor Responsable Inscripto → Factura B (6) a consumidor final; Factura A (1) a otro RI.',
      'Emisor monotributo → Factura C (11).',
      'Configurá FACTURADOR_EMISOR_REGIMEN y FACTURADOR_TIPO_DEFAULT en el servidor.'
    ]
  },
  RECEPTOR_CUIT_CONDICION_INVALIDA: {
    message:
      'Con CUIT/CUIL (docTipo 80) la condición Consumidor final (5) solo es válida en Factura B para un consumidor final real.',
    action:
      'No emitas como consumidor final si el cliente tiene otra condición fiscal. Monotributo en Factura B: condición 6 en ERP/padrón, 5 en WSFE.',
    retryable: false,
    httpStatus: 400,
    suggestions: [
      'Factura B + monotributo con CUIT → condicionIvaReceptor 5 en WSFE (monotributo 6 en ERP).',
      'Factura C + monotributo → condicionIvaReceptor 6.',
      'Responsable inscripto → Factura A con condición 1.'
    ]
  },
  RECEPTOR_CF_CON_CONDICION_ERP: {
    message: 'No se puede facturar como Consumidor final si el cliente tiene otra condición IVA en el ERP.',
    action: 'Revisá tax_condition / condicion_iva_receptor del cliente o consultá padrón ARCA.',
    retryable: false,
    httpStatus: 400,
    suggestions: [
      'Monotributo → condición 6 (Factura B tipo 6 o Factura C tipo 11 según emisor).',
      'Responsable inscripto → condición 1 y Factura A.',
      'Consumidor final sin CUIT → docTipo 99, docNro 0, condición 5.'
    ]
  },
  IVA_PAYLOAD_INVALID: {
    message:
      'El desglose IVA del comprobante no es válido para WSFE (importe ≠ suma de bases + cuotas, o sin alícuotas).',
    action:
      'Revisá alícuota IVA por ítem (21%, 10,5% o 0%), precios con IVA incluido y que el total de la venta coincida con la suma de líneas.',
    retryable: false,
    httpStatus: 400,
    suggestions: [
      'importe = suma(iva[].base + iva[].cuota) con redondeo a centavos WSFE.',
      'Precio con IVA incluido: neto = round(total / (1 + alícuota/100)); cuota = total − neto.',
      'Ejemplo MultiFacturador: 0,55 al 10,5% → base 0,50 cuota 0,05; 0,61 al 21% → base 0,50 cuota 0,11; importe 1,16.'
    ]
  },
  WSFE_PREFLIGHT_VALIDATION: {
    message: 'Los datos del comprobante no coinciden con las tablas WSFE habilitadas para este CUIT.',
    action:
      'Revisá el detalle técnico del error (condiciones permitidas / condición esperada). En Factura B, monotributo del padrón (6) se envía como consumidor final (5) a WSFE.',
    retryable: true,
    httpStatus: 400,
    suggestions: [
      'Consultá GET .../sugerencia-condicion-iva para el CUIT receptor.',
      'Probá POST /api/facturas/preview con consultarSugerenciaCondicionIva: true.',
      'Factura B + monotributo: ERP/padrón 6 → WSFE condicionIvaReceptor 5.'
    ]
  },
  RECEPTOR_CONDICION_PADRON_MISMATCH: {
    message: 'La condición IVA del comprobante no coincide con el padrón ARCA del receptor.',
    action:
      'Consultá el padrón ARCA y ajustá condicionIvaReceptor antes de emitir. Monotributo=6, consumidor final=5, responsable inscripto=1.',
    retryable: false,
    httpStatus: 400,
    suggestions: [
      'GET /api/emisores/:cuit/contribuyentes/:cuit/sugerencia-condicion-iva',
      'Actualizá tax_condition / condicion_iva_receptor del cliente en el ERP.',
      'El tipo de comprobante (A/B/C) es independiente de la condición IVA.'
    ]
  },
  PADRON_CONDICION_UNAVAILABLE: {
    message: 'No se pudo consultar el padrón ARCA para validar la condición IVA del receptor.',
    action:
      'Reintentá en unos minutos o consultá el padrón manualmente antes de emitir. Solo en casos excepcionales podés enviar skipPadronCondicionCheck=true.',
    retryable: true,
    httpStatus: 503,
    suggestions: [
      'Verificá conectividad con MultiCUIT y que el plan tenga padrón habilitado.',
      'Usá «Buscar en ARCA» en el modal de emisión para validar el CUIT.'
    ]
  }
};

/** Códigos numéricos frecuentes de ARCA en error.code o en el mensaje */
const ARCA_NUMERIC: Record<string, Omit<FacturadorResolvedError, 'code' | 'detail'>> = {
  '10003': {
    message: 'ARCA indica posible comprobante duplicado (código 10003).',
    action: 'No reemitas con nuevo número sin verificar si el comprobante ya existe en AFIP.',
    retryable: false,
    httpStatus: 409,
    suggestions: ['Consultá el último número autorizado o el detalle por facturaId en el facturador.']
  },
  '10016': {
    message: 'ARCA rechazó el comprobante (código 10016).',
    action: 'Revisá datos del receptor, fechas, importes y tipo de comprobante según el mensaje de ARCA.',
    retryable: false,
    httpStatus: 400
  },
  '10048': {
    message: 'ARCA: fecha del comprobante fuera de rango permitido (10048).',
    action: 'Ajustá la fecha de emisión o las fechas de servicio según normativa WSFE.',
    retryable: false,
    httpStatus: 400
  },
  '10051': {
    message: 'ARCA: punto de venta no habilitado o inconsistente (10051).',
    action: 'Verificá puntoVenta y homologación/producción del CUIT emisor.',
    retryable: false,
    httpStatus: 400
  },
  '10054': {
    message: 'ARCA: documento del receptor inválido (10054).',
    action: 'Corregí docTipo y docNro del cliente o usá consumidor final (docTipo 99).',
    retryable: false,
    httpStatus: 400
  },
  '10056': {
    message: 'ARCA: condición frente al IVA del receptor incorrecta (10056).',
    action: 'Ajustá condicionIvaReceptor según el tipo de cliente.',
    retryable: false,
    httpStatus: 400
  }
};

function normalizeCode(code?: string | null): string {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/^HTTP_/, '');
}

function extractArcaNumericCode(
  code?: string | null,
  remoteMessage?: string | null,
  details?: Record<string, unknown> | null
): string | null {
  const c = String(code || '').trim();
  if (/^\d{4,6}$/.test(c)) return c;

  const fromDetails =
    details?.codigo ?? details?.code ?? details?.arcaCode ?? details?.numero;
  if (fromDetails != null && /^\d{4,6}$/.test(String(fromDetails))) {
    return String(fromDetails);
  }

  const msg = remoteMessage || '';
  const m = msg.match(/\b(100\d{2})\b/);
  return m ? m[1] : null;
}

function mergeSuggestions(
  base: string[] | undefined,
  details?: Record<string, unknown> | null
): string[] | undefined {
  const fromDetails = details?.sugerencias;
  if (Array.isArray(fromDetails) && fromDetails.length > 0) {
    const extra = fromDetails.map(String);
    return base ? [...base, ...extra] : extra;
  }
  return base;
}

/**
 * Convierte vencimientoCae AFIP (YYYYMMDD) a ISO YYYY-MM-DD.
 */
export function vencimientoCaeAfipAIso(yyyymmdd: unknown): string | null {
  const s = String(yyyymmdd ?? '').replace(/\D/g, '');
  if (s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** Regla de negocio ERP: CAE presente y no solo espacios */
export function isCaeValid(cae: unknown): boolean {
  if (cae == null) return false;
  const s = String(cae).trim();
  return s.length > 0;
}

export function resolveFacturadorError(input: ResolveFacturadorErrorInput): FacturadorResolvedError {
  const rawCode = input.code || (input.httpStatus === 429 ? 'RATE_LIMIT_EXCEEDED' : '');
  let code = normalizeCode(rawCode);
  if (code === '429' || code === 'HTTP_429') code = 'RATE_LIMIT_EXCEEDED';
  if (!code && input.httpStatus) {
    code = `HTTP_${input.httpStatus}`;
    if (input.httpStatus === 429) code = 'RATE_LIMIT_EXCEEDED';
  }
  if (!code) code = 'FACTURACION_ERROR';

  const remoteMessage = input.remoteMessage?.trim() || undefined;
  const arcaNum = extractArcaNumericCode(code, remoteMessage, input.details);

  let template =
    BY_CODE[code] ||
    (arcaNum ? ARCA_NUMERIC[arcaNum] : undefined) ||
    (code.startsWith('HTTP_')
      ? {
          ...DEFAULT,
          httpStatus: Number(code.replace('HTTP_', '')) || DEFAULT.httpStatus,
          message: remoteMessage || `Error del facturador (${code}).`
        }
      : undefined) ||
    BY_CODE.FACTURACION_ERROR;

  if (!BY_CODE[code] && arcaNum && ARCA_NUMERIC[arcaNum]) {
    code = arcaNum;
    template = ARCA_NUMERIC[arcaNum];
  } else if (!BY_CODE[code] && !arcaNum && remoteMessage) {
    template = {
      ...DEFAULT,
      httpStatus: input.httpStatus && input.httpStatus >= 400 ? input.httpStatus : DEFAULT.httpStatus,
      message: remoteMessage.length > 200 ? `${remoteMessage.slice(0, 197)}...` : remoteMessage
    };
  }

  const suggestions = mergeSuggestions(template.suggestions, input.details);
  const resolvedCode = BY_CODE[code]
    ? code
    : arcaNum && ARCA_NUMERIC[arcaNum]
      ? arcaNum
      : code;

  return {
    code: resolvedCode,
    message: template.message,
    detail: remoteMessage && remoteMessage !== template.message ? remoteMessage : undefined,
    action: template.action,
    retryable: template.retryable,
    httpStatus:
      input.httpStatus && input.httpStatus >= 400 ? input.httpStatus : template.httpStatus,
    suggestions
  };
}

export interface FacturadorEmisionData {
  cae: string;
  vencimientoCae: string | null;
  vencimientoCaeIso: string | null;
  numero: number | null;
  tipo: number | null;
  puntoVenta: number | null;
  cuitEmisor: number | null;
  fechaEmision: string | null;
  qrUrl: string | null;
}

export function parseFacturadorEmisionData(
  data: Record<string, unknown> | undefined
): FacturadorEmisionData | null {
  if (!data || !isCaeValid(data.cae)) return null;
  const vencimientoRaw =
    data.vencimientoCae != null ? String(data.vencimientoCae) : null;
  return {
    cae: String(data.cae).trim(),
    vencimientoCae: vencimientoRaw,
    vencimientoCaeIso: vencimientoCaeAfipAIso(vencimientoRaw),
    numero: data.numero != null ? Number(data.numero) : null,
    tipo: data.tipo != null ? Number(data.tipo) : null,
    puntoVenta: data.puntoVenta != null ? Number(data.puntoVenta) : null,
    cuitEmisor: data.cuitEmisor != null ? Number(data.cuitEmisor) : null,
    fechaEmision:
      data.fechaEmision != null ? String(data.fechaEmision) : null,
    qrUrl: data.qrUrl != null ? String(data.qrUrl) : null
  };
}
