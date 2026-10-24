import { Sale } from '../entities/Sale';
import {
  FacturadorEmisionData,
  parseFacturadorEmisionData,
  vencimientoCaeAfipAIso
} from './facturadorErrors';

/** Snapshot AFIP para PDF / vista de comprobante (campos planos + alias frontend). */
export interface ArcaComprobanteSnapshot {
  cae: string | null;
  puntoVenta: number | null;
  tipo: number | null;
  numero: number | null;
  cuitEmisor: string | null;
  fechaEmision: string | null;
  caeVto: string | null;
  caeVtoIso: string | null;
  qrUrl: string | null;
  facturaId: string | null;
  idempotencyKey: string | null;
}

function toIntOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function cuitAsString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const d = String(v).replace(/\D/g, '');
  return d.length === 11 ? d : null;
}

/**
 * Extrae datos de emisión desde respuesta del facturador y/o payload enviado.
 */
/** Normaliza campos de GET /api/facturas/:id (cae_vto, cbteNro, etc.) al shape de emisión. */
export function normalizeFacturadorDetailData(
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const caeVtoRaw = data.vencimientoCae ?? data.cae_vto ?? data.caeVto;
  let vencimientoCae: string | null = null;
  if (caeVtoRaw != null) {
    const s = String(caeVtoRaw);
    vencimientoCae = s.includes('-') ? s.replace(/-/g, '') : s.replace(/\D/g, '').slice(0, 8);
  }
  return {
    ...data,
    cae: data.cae,
    numero: data.numero ?? data.cbteNro ?? data.nroComprobante,
    puntoVenta: data.puntoVenta ?? data.punto_venta,
    tipo: data.tipo ?? data.tipoCbte ?? data.tipo_cbte,
    cuitEmisor: data.cuitEmisor ?? data.cuit_emisor,
    fechaEmision: data.fechaEmision ?? data.fecha_emision ?? data.fechaCbte,
    qrUrl: data.qrUrl ?? data.qr_url,
    vencimientoCae: vencimientoCae || data.vencimientoCae
  };
}

export function parseEmisionFromFacturador(
  responseData: Record<string, unknown> | undefined,
  requestPayload?: Record<string, unknown> | null
): FacturadorEmisionData | null {
  const normalized = normalizeFacturadorDetailData(responseData);
  const parsed = parseFacturadorEmisionData(normalized);
  if (!parsed) return null;

  const req = requestPayload || {};
  return {
    ...parsed,
    puntoVenta: parsed.puntoVenta ?? toIntOrNull(req.puntoVenta),
    tipo: parsed.tipo ?? toIntOrNull(req.tipo),
    cuitEmisor:
      parsed.cuitEmisor ??
      (cuitAsString(req.cuitEmisor) ? Number(cuitAsString(req.cuitEmisor)) : null)
  };
}

/**
 * Arma snapshot desde columnas persistidas + JSON guardado (ventas antiguas).
 */
export function buildArcaComprobanteSnapshot(sale: Sale): ArcaComprobanteSnapshot | null {
  if (sale.arca_status !== 'success' && !sale.arca_cae) {
    return null;
  }

  const resp = sale.arca_response_json as { data?: Record<string, unknown> } | null;
  const fromJson = parseEmisionFromFacturador(
    resp?.data,
    sale.arca_request_json as Record<string, unknown> | null
  );

  const caeVtoIso =
    sale.arca_cae_vto != null
      ? String(sale.arca_cae_vto).slice(0, 10)
      : fromJson?.vencimientoCaeIso ?? null;

  return {
    cae: sale.arca_cae ?? fromJson?.cae ?? null,
    puntoVenta: sale.arca_punto_venta ?? fromJson?.puntoVenta ?? null,
    tipo: sale.arca_tipo ?? fromJson?.tipo ?? null,
    numero: sale.arca_numero ?? fromJson?.numero ?? null,
    cuitEmisor:
      sale.arca_cuit_emisor ??
      (fromJson?.cuitEmisor != null ? String(fromJson.cuitEmisor).replace(/\D/g, '') : null),
    fechaEmision:
      sale.arca_fecha_emision != null
        ? String(sale.arca_fecha_emision).slice(0, 10)
        : fromJson?.fechaEmision ?? null,
    caeVto: fromJson?.vencimientoCae ?? null,
    caeVtoIso,
    qrUrl: sale.arca_qr_url ?? fromJson?.qrUrl ?? null,
    facturaId: sale.arca_factura_id ?? null,
    idempotencyKey: sale.arca_idempotency_key ?? null
  };
}

/** Completa columnas faltantes en memoria para GET (sin escribir BD). */
export function attachArcaComprobanteToSale<T extends Sale>(sale: T): T {
  const enriched = enrichSaleArcaFields(sale);
  const snap = buildArcaComprobanteSnapshot(enriched);
  if (!snap) return enriched as T;
  return { ...enriched, arca_comprobante: snap } as T;
}

export function enrichSaleArcaFields(sale: Sale): Sale {
  if (sale.arca_status !== 'success') return sale;

  const snap = buildArcaComprobanteSnapshot(sale);
  const req = sale.arca_request_json as Record<string, unknown> | null | undefined;
  const docTipoRaw = req?.docTipo;
  const docNroRaw = req?.docNro;
  const docNroDigits =
    docNroRaw != null && String(docNroRaw).replace(/\D/g, '') !== '0'
      ? String(docNroRaw).replace(/\D/g, '')
      : null;
  const receptorDocFields =
    docTipoRaw != null || docNroDigits
      ? {
          arca_receptor_doc_tipo:
            docTipoRaw != null && Number.isFinite(Number(docTipoRaw))
              ? Number(docTipoRaw)
              : null,
          arca_receptor_doc_nro: docNroDigits
        }
      : {};

  if (!snap) {
    return Object.keys(receptorDocFields).length ? { ...sale, ...receptorDocFields } : sale;
  }

  return {
    ...sale,
    ...receptorDocFields,
    arca_punto_venta: sale.arca_punto_venta ?? snap.puntoVenta ?? null,
    arca_tipo: sale.arca_tipo ?? snap.tipo ?? null,
    arca_numero: sale.arca_numero ?? snap.numero ?? null,
    arca_cuit_emisor: sale.arca_cuit_emisor ?? snap.cuitEmisor ?? null,
    arca_fecha_emision: sale.arca_fecha_emision ?? snap.fechaEmision ?? null,
    arca_cae_vto: sale.arca_cae_vto ?? snap.caeVtoIso ?? null,
    arca_qr_url: sale.arca_qr_url ?? snap.qrUrl ?? null,
    arca_idempotency_key: sale.arca_idempotency_key ?? snap.idempotencyKey ?? null
  };
}

export interface PersistArcaComprobanteInput {
  emision: FacturadorEmisionData;
  facturaId?: string | null;
  idempotencyKey?: string | null;
}

/** Campos para UPDATE sales tras emisión exitosa. */
/** Campos mínimos para PDF local en el frontend. */
export function comprobanteSnapshotIncomplete(snap: ArcaComprobanteSnapshot | null): string[] {
  if (!snap) return ['comprobante'];
  const missing: string[] = [];
  if (!snap.cae) missing.push('cae');
  if (snap.numero == null) missing.push('numero');
  if (snap.puntoVenta == null) missing.push('puntoVenta');
  if (snap.tipo == null) missing.push('tipo');
  if (!snap.qrUrl) missing.push('qrUrl');
  if (!snap.caeVtoIso) missing.push('caeVto');
  return missing;
}

export function toPersistArcaComprobanteFields(
  input: PersistArcaComprobanteInput
): Pick<
  Sale,
  | 'arca_cae'
  | 'arca_punto_venta'
  | 'arca_tipo'
  | 'arca_numero'
  | 'arca_cuit_emisor'
  | 'arca_fecha_emision'
  | 'arca_cae_vto'
  | 'arca_qr_url'
  | 'arca_idempotency_key'
  | 'arca_factura_id'
> {
  const { emision } = input;
  const cuitStr =
    emision.cuitEmisor != null
      ? String(emision.cuitEmisor).replace(/\D/g, '').slice(0, 11)
      : null;

  return {
    arca_factura_id: input.facturaId ?? null,
    arca_cae: emision.cae,
    arca_punto_venta: emision.puntoVenta,
    arca_tipo: emision.tipo,
    arca_numero: emision.numero,
    arca_cuit_emisor: cuitStr && cuitStr.length === 11 ? cuitStr : null,
    arca_fecha_emision: emision.fechaEmision ?? null,
    arca_cae_vto: emision.vencimientoCaeIso ?? vencimientoCaeAfipAIso(emision.vencimientoCae),
    arca_qr_url: emision.qrUrl,
    arca_idempotency_key: input.idempotencyKey ?? null
  };
}
