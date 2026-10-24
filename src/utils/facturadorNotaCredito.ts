import { Sale } from '../entities/Sale';
import {
  buildArcaComprobanteSnapshot,
  parseEmisionFromFacturador
} from './arcaComprobante';
import type { FacturadorCbteAsoc, FacturadorEmitirPayload } from '../services/FacturadorArcaService';
import { resolveCondicionIvaReceptorForWsfe } from './facturadorComprobante';

/** Tipo WSFE de NC asociada a la factura (misma letra). */
const FACTURA_A_NOTA_CREDITO: Record<number, number> = {
  1: 3,
  2: 2,
  3: 3,
  6: 8,
  7: 7,
  8: 8,
  11: 13,
  12: 12,
  13: 13
};

export type NotaCreditoMotivo = 'error_emision' | 'devolucion' | 'descuento' | 'otro';

export const NOTA_CREDITO_MOTIVOS: NotaCreditoMotivo[] = [
  'error_emision',
  'devolucion',
  'descuento',
  'otro'
];

export interface FacturaOriginalRef {
  tipo: number;
  puntoVenta: number;
  numero: number;
}

function toIntOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function getNotaCreditoTipoForFactura(tipoFactura: number): number | null {
  return FACTURA_A_NOTA_CREDITO[tipoFactura] ?? null;
}

export function facturadorTipoRequiereIva(tipo: number): boolean {
  return tipo !== 11 && tipo !== 13;
}

export function buildNotaCreditoIdempotencyKey(
  saleId: number,
  motivo: string,
  facturaRef?: FacturaOriginalRef | null
): string {
  const m = motivo.trim().slice(0, 64) || 'error_emision';
  if (facturaRef) {
    return `sale-${saleId}-nc-${facturaRef.tipo}-${facturaRef.puntoVenta}-${facturaRef.numero}-${m}`;
  }
  return `sale-${saleId}-nc-${m}`;
}

/** Referencia AFIP de la factura original (tipo, PV, número). */
export function resolveFacturaOriginalRef(sale: Sale): FacturaOriginalRef | null {
  const snap = buildArcaComprobanteSnapshot(sale);
  const req = (sale.arca_request_json ?? null) as Record<string, unknown> | null;
  const resp = sale.arca_response_json as { data?: Record<string, unknown> } | null;
  const fromResp = parseEmisionFromFacturador(resp?.data, req);

  const tipo =
    toIntOrNull(sale.arca_tipo) ??
    snap?.tipo ??
    toIntOrNull(req?.tipo) ??
    fromResp?.tipo ??
    null;
  const puntoVenta =
    toIntOrNull(sale.arca_punto_venta) ??
    snap?.puntoVenta ??
    toIntOrNull(req?.puntoVenta) ??
    fromResp?.puntoVenta ??
    null;
  const numero =
    toIntOrNull(sale.arca_numero) ??
    snap?.numero ??
    toIntOrNull(req?.numero) ??
    fromResp?.numero ??
    null;

  if (tipo == null || puntoVenta == null || numero == null || numero < 1) {
    return null;
  }

  return { tipo, puntoVenta, numero };
}

export function buildCbtesAsocFromFactura(ref: FacturaOriginalRef): FacturadorCbteAsoc[] {
  return [{ tipo: ref.tipo, ptoVta: ref.puntoVenta, nro: ref.numero }];
}

/** Arma payload NC reutilizando la factura original y agregando cbtesAsoc. */
export function buildNotaCreditoPayload(
  originalRequest: FacturadorEmitirPayload | Record<string, unknown> | null | undefined,
  ref: FacturaOriginalRef,
  ncTipo: number,
  puntoVentaEmision: number,
  importeOverride?: number | null
): FacturadorEmitirPayload {
  const base =
    originalRequest && typeof originalRequest === 'object'
      ? ({ ...originalRequest } as FacturadorEmitirPayload)
      : ({} as FacturadorEmitirPayload);

  const condicionRaw = Number(base.condicionIvaReceptor ?? 5);
  const payload: FacturadorEmitirPayload = {
    ...base,
    tipo: ncTipo,
    puntoVenta: puntoVentaEmision,
    concepto: Number(base.concepto ?? 1),
    docTipo: Number(base.docTipo ?? 99),
    condicionIvaReceptor: resolveCondicionIvaReceptorForWsfe(ncTipo, condicionRaw),
    cuitEmisor: Number(base.cuitEmisor),
    importe:
      importeOverride != null && Number.isFinite(Number(importeOverride))
        ? Math.round(Number(importeOverride) * 100) / 100
        : Number(base.importe)
  };

  if (base.docNro !== undefined && base.docNro !== null && String(base.docNro).replace(/\D/g, '')) {
    payload.docNro = String(base.docNro).replace(/\D/g, '');
  } else {
    delete payload.docNro;
  }

  if (facturadorTipoRequiereIva(ncTipo)) {
    payload.iva = Array.isArray(base.iva) ? [...base.iva] : undefined;
  } else {
    delete payload.iva;
  }

  if (base.fechaServicioDesde) payload.fechaServicioDesde = base.fechaServicioDesde;
  if (base.fechaServicioHasta) payload.fechaServicioHasta = base.fechaServicioHasta;
  if (Array.isArray(base.detalle) && base.detalle.length > 0) {
    payload.detalle = base.detalle.map((line) => ({ ...line }));
  }

  payload.omitirPdf = true;
  payload.cbtesAsoc = buildCbtesAsocFromFactura(ref);

  return payload;
}
