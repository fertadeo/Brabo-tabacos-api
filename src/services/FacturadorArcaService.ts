import crypto from 'crypto';
import {
  isCaeValid,
  resolveFacturadorError
} from '../utils/facturadorErrors';

export interface FacturadorDetalleItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

export interface FacturadorCbteAsoc {
  tipo: number;
  ptoVta: number;
  nro: number;
}

export interface FacturadorEmitirPayload {
  cuitEmisor: number;
  tipo: number;
  puntoVenta: number;
  docTipo: number;
  docNro?: string;
  condicionIvaReceptor: number;
  concepto: number;
  importe: number;
  iva?: Array<{ id: number; base: number; cuota: number }>;
  fechaServicioDesde?: string;
  fechaServicioHasta?: string;
  fechaVencimientoPago?: string;
  /** Texto comercial para PDF (no va a WSFE). */
  condicionVenta?: string;
  receptorRazonSocial?: string;
  receptorDomicilio?: string;
  leyendaComprobante?: string;
  omitirPdf?: boolean;
  /** Desglose por línea de venta (PDF / auditoría; manual usa codigo "0") */
  detalle?: FacturadorDetalleItem[];
  /** Comprobantes asociados (obligatorio en notas de crédito / débito WSFE) */
  cbtesAsoc?: FacturadorCbteAsoc[];
  /** Moneda WSFE: PES (default) o DOL */
  monedaId?: 'PES' | 'DOL';
  /** Cotización de la moneda (1 si PES) */
  tipoCambio?: number;
  /** Consulta padrón ARCA para sugerencia de condición IVA (docTipo 80 + CUIT). */
  consultarSugerenciaCondicionIva?: boolean;
}

export interface FacturadorSugerenciaCondicionIvaBlock {
  sugerencia?: number | null;
  advertencias?: string[];
  trazas?: string[];
}

export interface FacturadorPreviewResponse extends FacturadorResponseShape {
  preview?: boolean;
  sugerenciaCondicionIva?: FacturadorSugerenciaCondicionIvaBlock;
}

export interface FacturadorErrorShape {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface FacturadorResponseShape {
  ok?: boolean;
  data?: Record<string, unknown>;
  error?: FacturadorErrorShape;
  persistencia?: { facturaId?: string };
  requestId?: string;
}

export interface FacturadorApiError extends Error {
  status: number;
  code: string;
  /** Mensaje original del facturador / ARCA */
  remoteMessage?: string | null;
  action?: string;
  retryable?: boolean;
  suggestions?: string[];
  retryAfter?: number | null;
  details?: Record<string, unknown> | null;
  requestId?: string | null;
  responseBody?: unknown;
}

export class FacturadorArcaService {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor() {
    this.baseUrl = (process.env.FACTURADOR_BASE_URL || '').trim().replace(/\/+$/, '');
    this.apiKey = (process.env.FACTURADOR_API_KEY || '').trim();
    this.timeoutMs = Number(process.env.FACTURADOR_TIMEOUT_MS || 15000);
  }

  /** URL base efectiva (solo diagnóstico / logs). */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /** Key efectiva por request (cabecera opcional) o variable de entorno. */
  private effectiveApiKey(apiKeyOverride?: string | null): string {
    const fromEnv = this.apiKey;
    const fromReq = (apiKeyOverride ?? '').trim();
    return fromReq || fromEnv;
  }

  /** Base URL + al menos una API key (env o override). */
  hasCredentials(apiKeyOverride?: string | null): boolean {
    return Boolean(this.baseUrl && this.effectiveApiKey(apiKeyOverride));
  }

  isConfigured(): boolean {
    return this.hasCredentials();
  }

  private ensureConfiguredForEmit(apiKeyOverride?: string | null): void {
    const key = this.effectiveApiKey(apiKeyOverride);
    if (!this.baseUrl) {
      console.error('[FacturadorEnv] Falta FACTURADOR_BASE_URL — no se puede POST /api/facturas');
      throw new Error(
        'Facturador ARCA no configurado. Definí FACTURADOR_BASE_URL y FACTURADOR_API_KEY (o cabecera x-facturador-api-key si está permitida).'
      );
    }
    if (!key) {
      console.error(
        '[FacturadorEnv] Falta API key — FACTURADOR_API_KEY vacío y sin override (cabecera no enviada o no permitida)'
      );
      throw new Error(
        'Facturador ARCA no configurado. Definí FACTURADOR_BASE_URL y FACTURADOR_API_KEY (o cabecera x-facturador-api-key si está permitida).'
      );
    }
  }

  private buildApiError(
    remoteMessage: string,
    status: number,
    code: string,
    extras: Partial<FacturadorApiError> = {}
  ): FacturadorApiError {
    const resolved = resolveFacturadorError({
      code,
      remoteMessage,
      httpStatus: status,
      details: extras.details ?? null
    });
    const error = new Error(resolved.message) as FacturadorApiError;
    error.status = resolved.httpStatus;
    error.code = resolved.code;
    error.remoteMessage = remoteMessage || null;
    error.action = resolved.action;
    error.retryable = resolved.retryable;
    error.suggestions = resolved.suggestions;
    error.retryAfter = extras.retryAfter ?? null;
    error.details = extras.details ?? null;
    error.requestId = extras.requestId ?? null;
    error.responseBody = extras.responseBody;
    return error;
  }

  private buildIdempotencyKey(saleId: number, payload: FacturadorEmitirPayload): string {
    const digest = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .slice(0, 16);
    return `sale-${saleId}-${digest}`;
  }

  /** No loguear la API key completa (solo prefijo + últimos 4 caracteres). */
  private redactBearerToken(apiKey: string): string {
    const k = apiKey;
    if (!k) return 'Bearer <vacío>';
    if (k.length <= 8) return 'Bearer ***';
    return `Bearer ${k.slice(0, 4)}***${k.slice(-4)}`;
  }

  /** Prefijo unificado para filtrar en PM2: grep MultiFacturador */
  private static readonly LOG_TAG = '[MultiFacturador]';

  private static readonly MAX_RAW_RESPONSE_LOG_CHARS = 8000;

  /** Log del cuerpo JSON enviado a POST /api/facturas */
  private logCuerpoFacturaEnviado(
    saleId: number,
    url: string,
    idempotencyKey: string,
    authHeader: string,
    payload: FacturadorEmitirPayload,
    bodyJson: string
  ): void {
    console.log(`${FacturadorArcaService.LOG_TAG} >>> CUERPO FACTURA ENVIADO saleId=${saleId}`, {
      saleId,
      method: 'POST',
      url,
      idempotencyKey,
      authorization: authHeader,
      resumen: {
        cuitEmisor: payload.cuitEmisor,
        tipo: payload.tipo,
        puntoVenta: payload.puntoVenta,
        docTipo: payload.docTipo,
        docNro: payload.docNro ?? null,
        condicionIvaReceptor: payload.condicionIvaReceptor,
        concepto: payload.concepto,
        importe: payload.importe,
        omitirPdf: payload.omitirPdf ?? false,
        fechaServicioDesde: payload.fechaServicioDesde ?? null,
        fechaServicioHasta: payload.fechaServicioHasta ?? null,
        lineasIva: payload.iva?.length ?? 0,
        lineasDetalle: payload.detalle?.length ?? 0,
        lineasCbtesAsoc: payload.cbtesAsoc?.length ?? 0
      },
      iva: payload.iva ?? null,
      detalle: payload.detalle ?? null,
      cbtesAsoc: payload.cbtesAsoc ?? null
    });
    console.log(`${FacturadorArcaService.LOG_TAG} >>> CUERPO FACTURA JSON saleId=${saleId}`, bodyJson);
  }

  /** Log de la respuesta HTTP del MultiFacturador (JSON parseado o raw si falla). */
  private logRespuestaFacturaRecibida(
    saleId: number,
    httpStatus: number,
    responseOk: boolean,
    raw: string,
    parsed: FacturadorResponseShape | null
  ): void {
    const logFn = responseOk && parsed?.ok !== false ? console.log : console.error;
    const meta = {
      saleId,
      httpStatus,
      responseOk,
      rawBytes: raw.length,
      requestId: parsed?.requestId ?? null,
      facturadorOk: parsed?.ok ?? null,
      errorCode: parsed?.error?.code ?? null,
      errorMessage: parsed?.error?.message ?? null,
      cae: parsed?.data?.cae ?? null,
      vencimientoCae: parsed?.data?.vencimientoCae ?? null,
      numero: parsed?.data?.numero ?? null,
      puntoVenta: parsed?.data?.puntoVenta ?? null,
      tipo: parsed?.data?.tipo ?? null,
      fechaEmision: parsed?.data?.fechaEmision ?? null,
      facturaId: parsed?.persistencia?.facturaId ?? null,
      pdfGenerado: (parsed as { pdf?: { generado?: boolean } })?.pdf?.generado ?? null
    };
    logFn(`${FacturadorArcaService.LOG_TAG} <<< RESPUESTA FACTURA RECIBIDA saleId=${saleId}`, meta);
    if (parsed) {
      logFn(
        `${FacturadorArcaService.LOG_TAG} <<< RESPUESTA FACTURA JSON saleId=${saleId}`,
        JSON.stringify(parsed, null, 2)
      );
      return;
    }
    const max = FacturadorArcaService.MAX_RAW_RESPONSE_LOG_CHARS;
    const preview =
      raw.length > max ? `${raw.slice(0, max)}...[truncado ${raw.length - max} chars]` : raw;
    logFn(`${FacturadorArcaService.LOG_TAG} <<< RESPUESTA FACTURA RAW (no JSON) saleId=${saleId}`, preview);
  }

  /** GET /ping del facturador (no exige API key según guía). Solo valida URL base. */
  async ping(): Promise<boolean> {
    if (!this.baseUrl) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/ping`, {
        method: 'GET',
        signal: controller.signal
      });
      return response.ok;
    } catch (error) {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async emitirFactura(
    saleId: number,
    payload: FacturadorEmitirPayload,
    options?: { apiKey?: string | null; idempotencyKey?: string }
  ): Promise<{ response: FacturadorResponseShape; idempotencyKey: string }> {
    const token = this.effectiveApiKey(options?.apiKey);
    this.ensureConfiguredForEmit(options?.apiKey);
    const idempotencyKey =
      options?.idempotencyKey?.trim() || this.buildIdempotencyKey(saleId, payload);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const url = `${this.baseUrl}/api/facturas`;
    const bodyJson = JSON.stringify(payload);
    const authHeader = this.redactBearerToken(token);

    this.logCuerpoFacturaEnviado(saleId, url, idempotencyKey, authHeader, payload, bodyJson);

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: bodyJson
      });

      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : null;

      const raw = await response.text();
      let parsed: FacturadorResponseShape | null = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw) as FacturadorResponseShape;
        } catch {
          this.logRespuestaFacturaRecibida(saleId, response.status, response.ok, raw, null);
          const isHtmlGateway =
            raw.trimStart().startsWith('<!DOCTYPE') ||
            raw.trimStart().startsWith('<html') ||
            /cloudflare|bad gateway/i.test(raw.slice(0, 500));
          throw this.buildApiError(
            isHtmlGateway
              ? 'El facturador no respondió (502 del proxy/servicio caído o timeout)'
              : 'El facturador devolvió una respuesta inválida (no JSON)',
            502,
            'FACTURADOR_CONNECTION_ERROR',
            {
              responseBody: {
                rawPreview: raw.slice(0, 500),
                isHtmlGateway
              }
            }
          );
        }
      }

      this.logRespuestaFacturaRecibida(saleId, response.status, response.ok, raw, parsed);

      const parsedSafe = parsed ?? {};

      if (!response.ok) {
        const remoteCode = parsedSafe?.error?.code || `HTTP_${response.status}`;
        const remoteMessage = parsedSafe?.error?.message || `Error HTTP ${response.status} en facturador`;
        throw this.buildApiError(remoteMessage, response.status, remoteCode, {
          retryAfter: Number.isFinite(retryAfter) ? retryAfter : null,
          details: parsedSafe?.error?.details || null,
          requestId: parsedSafe?.requestId || null,
          responseBody: parsedSafe
        });
      }

      if (parsedSafe.ok === false) {
        const remoteCode = parsedSafe?.error?.code || 'FACTURACION_ERROR';
        const remoteMessage =
          parsedSafe?.error?.message || 'El facturador respondió sin autorizar el comprobante';
        throw this.buildApiError(remoteMessage, 502, remoteCode, {
          details: parsedSafe?.error?.details || null,
          requestId: parsedSafe?.requestId || null,
          responseBody: parsedSafe
        });
      }

      const cae = parsedSafe?.data?.cae;
      if (!isCaeValid(cae)) {
        throw this.buildApiError(
          'La emisión no devolvió CAE válido (equivalente a WSFE sin CAE)',
          502,
          'WSFE_NO_CAE',
          {
            requestId: parsedSafe?.requestId || null,
            responseBody: parsedSafe,
            details: {
              categoria: 'wsfe_sin_cae',
              sugerencias: [
                'No marques la venta como facturada.',
                'Revisá punto de venta, tipo de comprobante y certificados del CUIT emisor.'
              ]
            }
          }
        );
      }

      return { response: parsedSafe, idempotencyKey };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.error(`${FacturadorArcaService.LOG_TAG} <<< TIMEOUT saleId=${saleId}`, {
          saleId,
          timeoutMs: this.timeoutMs,
          url: `${this.baseUrl}/api/facturas`
        });
        throw this.buildApiError(
          'Timeout al conectar con facturador ARCA',
          504,
          'FACTURADOR_TIMEOUT'
        );
      }
      if ((error as FacturadorApiError).status) {
        throw error;
      }
      console.error(`${FacturadorArcaService.LOG_TAG} <<< ERROR RED saleId=${saleId}`, {
        saleId,
        message: error instanceof Error ? error.message : String(error)
      });
      throw this.buildApiError(
        error instanceof Error ? error.message : 'Error desconocido conectando facturador',
        502,
        'FACTURADOR_CONNECTION_ERROR'
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** POST /api/facturas/preview — validación WSFE sin emitir (mismo cuerpo que emisión). */
  async previewFactura(
    payload: FacturadorEmitirPayload,
    options?: { apiKey?: string | null }
  ): Promise<FacturadorPreviewResponse> {
    const token = this.effectiveApiKey(options?.apiKey);
    this.ensureConfiguredForEmit(options?.apiKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = `${this.baseUrl}/api/facturas/preview`;
    const bodyJson = JSON.stringify(payload);

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: bodyJson
      });

      const raw = await response.text();
      let parsed: FacturadorPreviewResponse | null = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw) as FacturadorPreviewResponse;
        } catch {
          throw this.buildApiError(
            'El facturador devolvió una respuesta inválida en preview (no JSON)',
            502,
            'FACTURADOR_CONNECTION_ERROR',
            { responseBody: { rawPreview: raw.slice(0, 500) } }
          );
        }
      }

      const parsedSafe = parsed ?? {};

      if (!response.ok) {
        const remoteCode = parsedSafe?.error?.code || `HTTP_${response.status}`;
        const remoteMessage = parsedSafe?.error?.message || `Error HTTP ${response.status} en preview`;
        throw this.buildApiError(remoteMessage, response.status, remoteCode, {
          details: parsedSafe?.error?.details || null,
          requestId: parsedSafe?.requestId || null,
          responseBody: parsedSafe
        });
      }

      if (parsedSafe.ok === false) {
        const remoteCode = parsedSafe?.error?.code || 'WSFE_PREFLIGHT_VALIDATION';
        const remoteMessage =
          parsedSafe?.error?.message || 'El preview WSFE rechazó el comprobante';
        throw this.buildApiError(remoteMessage, 400, remoteCode, {
          details: parsedSafe?.error?.details || null,
          requestId: parsedSafe?.requestId || null,
          responseBody: parsedSafe
        });
      }

      return parsedSafe;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw this.buildApiError('Timeout en preview del facturador ARCA', 504, 'FACTURADOR_TIMEOUT');
      }
      if ((error as FacturadorApiError).status) {
        throw error;
      }
      throw this.buildApiError(
        error instanceof Error ? error.message : 'Error en preview del facturador',
        502,
        'FACTURADOR_CONNECTION_ERROR'
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * GET /api/facturas/:facturaId?cuitEmisor=… — detalle persistido en MultiCUIT (reconciliar / completar datos).
   */
  async obtenerFactura(
    facturaId: string,
    cuitEmisor: number | string,
    options?: { apiKey?: string | null }
  ): Promise<FacturadorResponseShape> {
    const token = this.effectiveApiKey(options?.apiKey);
    this.ensureConfiguredForEmit(options?.apiKey);
    const cuit = String(cuitEmisor).replace(/\D/g, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = `${this.baseUrl}/api/facturas/${encodeURIComponent(facturaId)}?cuitEmisor=${cuit}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });

      const raw = await response.text();
      let parsed: FacturadorResponseShape = {};
      if (raw) {
        try {
          parsed = JSON.parse(raw) as FacturadorResponseShape;
        } catch {
          throw this.buildApiError(
            'Respuesta no JSON al consultar factura en facturador',
            502,
            'FACTURADOR_CONNECTION_ERROR',
            { responseBody: { rawPreview: raw.slice(0, 500) } }
          );
        }
      }

      if (!response.ok) {
        const remoteCode = parsed?.error?.code || `HTTP_${response.status}`;
        const remoteMessage = parsed?.error?.message || `Error HTTP ${response.status}`;
        throw this.buildApiError(remoteMessage, response.status, remoteCode, {
          requestId: parsed?.requestId || null,
          responseBody: parsed
        });
      }

      return parsed;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw this.buildApiError('Timeout consultando factura en facturador', 504, 'FACTURADOR_TIMEOUT');
      }
      if ((error as FacturadorApiError).status) {
        throw error;
      }
      throw this.buildApiError(
        error instanceof Error ? error.message : 'Error consultando facturador',
        502,
        'FACTURADOR_CONNECTION_ERROR'
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * GET genérico al facturador MultiCUIT (padrón, sugerencias, etc.).
   */
  private async getJson<T extends FacturadorResponseShape>(
    path: string,
    options?: { apiKey?: string | null }
  ): Promise<T> {
    const token = this.effectiveApiKey(options?.apiKey);
    this.ensureConfiguredForEmit(options?.apiKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });

      const raw = await response.text();
      let parsed = {} as T;
      if (raw) {
        try {
          parsed = JSON.parse(raw) as T;
        } catch {
          throw this.buildApiError(
            'Respuesta no JSON del facturador',
            502,
            'FACTURADOR_CONNECTION_ERROR',
            { responseBody: { rawPreview: raw.slice(0, 500) } }
          );
        }
      }

      if (!response.ok) {
        const remoteCode = parsed?.error?.code || `HTTP_${response.status}`;
        const remoteMessage = parsed?.error?.message || `Error HTTP ${response.status}`;
        throw this.buildApiError(remoteMessage, response.status, remoteCode, {
          requestId: parsed?.requestId || null,
          responseBody: parsed
        });
      }

      return parsed;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw this.buildApiError('Timeout consultando facturador', 504, 'FACTURADOR_TIMEOUT');
      }
      if ((error as FacturadorApiError).status) {
        throw error;
      }
      throw this.buildApiError(
        error instanceof Error ? error.message : 'Error consultando facturador',
        502,
        'FACTURADOR_CONNECTION_ERROR'
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** GET .../padron-completo — A13 + constancia de inscripción en paralelo. */
  async getPadronCompleto(
    cuitEmisor: number | string,
    cuitReceptor: number | string,
    options?: { apiKey?: string | null }
  ): Promise<PadronCompletoResponse> {
    const emisor = String(cuitEmisor).replace(/\D/g, '');
    const receptor = String(cuitReceptor).replace(/\D/g, '');
    return this.getJson<PadronCompletoResponse>(
      `/api/emisores/${emisor}/contribuyentes/${receptor}/padron-completo`,
      options
    );
  }

  /** GET .../sugerencia-condicion-iva — heurística orientativa para facturación. */
  async getSugerenciaCondicionIva(
    cuitEmisor: number | string,
    cuitReceptor: number | string,
    options?: { apiKey?: string | null }
  ): Promise<SugerenciaCondicionIvaResponse> {
    const emisor = String(cuitEmisor).replace(/\D/g, '');
    const receptor = String(cuitReceptor).replace(/\D/g, '');
    return this.getJson<SugerenciaCondicionIvaResponse>(
      `/api/emisores/${emisor}/contribuyentes/${receptor}/sugerencia-condicion-iva`,
      options
    );
  }
}

export interface PadronConsultaItem {
  alcancePadron: string;
  ok: boolean;
  reason: string;
  detalle?: Record<string, unknown> | null;
  error?: string;
}

export interface PadronCompletoResponse extends FacturadorResponseShape {
  parcial?: boolean;
  data?: {
    cuitEmisor: number;
    cuitReceptor: number;
    consultas: PadronConsultaItem[];
    trazas?: string[];
  };
}

export interface SugerenciaCondicionIvaResponse extends FacturadorResponseShape {
  sugerencia?: number | null;
  trazas?: string[];
  advertencias?: string[];
}
