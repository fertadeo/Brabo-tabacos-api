import crypto from 'crypto';
import type { Sale, SaleItem, SaleWithDetails } from '../entities/Sale';
import type {
  CreateSaleComprobanteData,
  SaleComprobante,
  SaleComprobanteItemSnapshot,
  SaleComprobantePublic
} from '../entities/SaleComprobante';

/** Sale o detalle con ítems opcionales (getSaleById suele devolver SaleWithDetails). */
type SaleWithOptionalItems = Sale & { items?: SaleItem[] | null };

export function saleHasNotaCreditoEmitida(
  sale: Pick<Sale, 'arca_nc_status' | 'arca_nc_cae'>
): boolean {
  return sale.arca_nc_status === 'success' && Boolean(String(sale.arca_nc_cae ?? '').trim());
}

/** Factura vigente anulada con NC: se puede corregir la venta y emitir otra factura. */
export function saleCanRefacturar(
  sale: Pick<Sale, 'arca_status' | 'arca_cae' | 'arca_nc_status' | 'arca_nc_cae'>
): boolean {
  return sale.arca_status === 'success' && Boolean(String(sale.arca_cae ?? '').trim()) && saleHasNotaCreditoEmitida(sale);
}

/** Bloquea edición mientras hay factura ARCA vigente (sin NC que la anule). */
export function saleHasFiscalLock(
  sale: Pick<Sale, 'arca_status' | 'arca_nc_status' | 'arca_nc_cae'>
): boolean {
  return sale.arca_status === 'success' && !saleHasNotaCreditoEmitida(sale);
}

export function itemsSnapshotFromSale(sale: SaleWithOptionalItems | SaleWithDetails): SaleComprobanteItemSnapshot[] {
  return (sale.items ?? []).map((item) => ({
    product_id: item.product_id ?? null,
    product_name: item.product_name ?? null,
    product_code: item.product_code ?? null,
    description: item.description ?? null,
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    total_price: Number(item.total_price ?? item.subtotal) || 0,
    iva_rate: item.iva_rate
  }));
}

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export function snapshotFacturaFromSale(sale: SaleWithOptionalItems): CreateSaleComprobanteData | null {
  const cae = trimOrNull(sale.arca_cae);
  if (sale.arca_status !== 'success' || !cae) return null;
  return {
    sale_id: sale.id,
    kind: 'factura',
    status: 'success',
    factura_id: trimOrNull(sale.arca_factura_id),
    cae,
    cae_vto: trimOrNull(sale.arca_cae_vto)?.slice(0, 10) ?? null,
    tipo: sale.arca_tipo ?? null,
    punto_venta: sale.arca_punto_venta ?? null,
    numero: sale.arca_numero ?? null,
    cuit_emisor: trimOrNull(sale.arca_cuit_emisor),
    fecha_emision: trimOrNull(sale.arca_fecha_emision)?.slice(0, 10) ?? null,
    qr_url: trimOrNull(sale.arca_qr_url),
    idempotency_key: trimOrNull(sale.arca_idempotency_key),
    request_json: sale.arca_request_json ?? null,
    response_json: sale.arca_response_json ?? null,
    items_json: itemsSnapshotFromSale(sale),
    emitted_at: trimOrNull(sale.arca_last_attempt_at) ?? trimOrNull(sale.updated_at)
  };
}

export function snapshotNotaCreditoFromSale(sale: SaleWithOptionalItems): CreateSaleComprobanteData | null {
  const cae = trimOrNull(sale.arca_nc_cae);
  if (!saleHasNotaCreditoEmitida(sale) || !cae) return null;
  return {
    sale_id: sale.id,
    kind: 'nota_credito',
    status: 'success',
    factura_id: trimOrNull(sale.arca_nc_factura_id),
    cae,
    cae_vto: trimOrNull(sale.arca_nc_cae_vto)?.slice(0, 10) ?? null,
    tipo: sale.arca_nc_tipo ?? null,
    punto_venta: sale.arca_nc_punto_venta ?? null,
    numero: sale.arca_nc_numero ?? null,
    idempotency_key: trimOrNull(sale.arca_nc_idempotency_key),
    motivo: trimOrNull(sale.arca_nc_motivo),
    observaciones: trimOrNull(sale.arca_nc_observaciones),
    request_json: sale.arca_nc_request_json ?? null,
    response_json: sale.arca_nc_response_json ?? null,
    items_json: itemsSnapshotFromSale(sale),
    emitted_at: trimOrNull(sale.arca_nc_last_attempt_at) ?? trimOrNull(sale.updated_at)
  };
}

export function toPublicComprobante(
  row: SaleComprobante,
  vigente: boolean
): SaleComprobantePublic {
  return {
    id: row.id,
    sequence: row.sequence,
    kind: row.kind,
    status: row.status,
    factura_id: row.factura_id ?? null,
    cae: row.cae ?? null,
    cae_vto: row.cae_vto ?? null,
    tipo: row.tipo ?? null,
    punto_venta: row.punto_venta ?? null,
    numero: row.numero ?? null,
    cuit_emisor: row.cuit_emisor ?? null,
    fecha_emision: row.fecha_emision ?? null,
    qr_url: row.qr_url ?? null,
    motivo: row.motivo ?? null,
    observaciones: row.observaciones ?? null,
    related_comprobante_id: row.related_comprobante_id ?? null,
    request_json: row.request_json ?? null,
    response_json: row.response_json ?? null,
    items_json: row.items_json ?? null,
    emitted_at: row.emitted_at ?? null,
    vigente
  };
}

function syntheticFromCreate(
  data: CreateSaleComprobanteData,
  sequence: number,
  vigente: boolean
): SaleComprobantePublic {
  return {
    id: null,
    sequence,
    kind: data.kind,
    status: data.status ?? 'success',
    factura_id: data.factura_id ?? null,
    cae: data.cae ?? null,
    cae_vto: data.cae_vto ?? null,
    tipo: data.tipo ?? null,
    punto_venta: data.punto_venta ?? null,
    numero: data.numero ?? null,
    cuit_emisor: data.cuit_emisor ?? null,
    fecha_emision: data.fecha_emision ?? null,
    qr_url: data.qr_url ?? null,
    motivo: data.motivo ?? null,
    observaciones: data.observaciones ?? null,
    related_comprobante_id: data.related_comprobante_id ?? null,
    request_json: data.request_json ?? null,
    response_json: data.response_json ?? null,
    items_json: data.items_json ?? null,
    emitted_at: data.emitted_at ?? null,
    vigente
  };
}

function markVigente(rows: SaleComprobantePublic[]): SaleComprobantePublic[] {
  let lastFacturaIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].kind === 'factura' && rows[i].status === 'success') lastFacturaIdx = i;
    if (rows[i].kind === 'nota_credito' && rows[i].status === 'success') lastFacturaIdx = -1;
  }
  return rows.map((row, i) => ({
    ...row,
    vigente: row.kind === 'factura' && row.status === 'success' && i === lastFacturaIdx
  }));
}

/** Une filas persistidas con la factura/NC actuales (por si el último insert falló). */
export function mergeSaleComprobanteHistorial(
  stored: SaleComprobante[],
  sale: SaleWithOptionalItems
): SaleComprobantePublic[] {
  const byCae = new Map<string, SaleComprobantePublic>();
  const ordered: SaleComprobantePublic[] = stored
    .filter((row) => row.status === 'success' && trimOrNull(row.cae))
    .sort((a, b) => a.sequence - b.sequence)
    .map((row) => toPublicComprobante(row, false));

  for (const row of ordered) {
    const cae = trimOrNull(row.cae);
    if (cae) byCae.set(cae, row);
  }

  const factura = snapshotFacturaFromSale(sale);
  if (factura?.cae && !byCae.has(factura.cae)) {
    ordered.push(syntheticFromCreate(factura, ordered.length + 1, false));
    byCae.set(factura.cae, ordered[ordered.length - 1]);
  }

  const nc = snapshotNotaCreditoFromSale(sale);
  if (nc?.cae && !byCae.has(nc.cae)) {
    ordered.push(syntheticFromCreate(nc, ordered.length + 1, false));
  }

  return markVigente(ordered);
}

export function buildRefacturacionIdempotencyKey(
  saleId: number,
  sequence: number,
  payload: unknown
): string {
  const digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
  return `sale-${saleId}-refact-${sequence}-${digest}`;
}
