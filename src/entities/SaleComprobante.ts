export type SaleComprobanteKind = 'factura' | 'nota_credito';
export type SaleComprobanteStatus = 'pending' | 'success' | 'error';

export interface SaleComprobanteItemSnapshot {
  product_id: number | null;
  product_name?: string | null;
  product_code?: string | null;
  description?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  iva_rate?: number;
}

export interface SaleComprobante {
  id: number;
  sale_id: number;
  sequence: number;
  kind: SaleComprobanteKind;
  status: SaleComprobanteStatus;
  factura_id?: string | null;
  cae?: string | null;
  cae_vto?: string | null;
  tipo?: number | null;
  punto_venta?: number | null;
  numero?: number | null;
  cuit_emisor?: string | null;
  fecha_emision?: string | null;
  qr_url?: string | null;
  idempotency_key?: string | null;
  motivo?: string | null;
  observaciones?: string | null;
  related_comprobante_id?: number | null;
  request_json?: Record<string, unknown> | null;
  response_json?: Record<string, unknown> | null;
  items_json?: SaleComprobanteItemSnapshot[] | null;
  error_code?: string | null;
  error_message?: string | null;
  emitted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSaleComprobanteData {
  sale_id: number;
  kind: SaleComprobanteKind;
  status?: SaleComprobanteStatus;
  factura_id?: string | null;
  cae?: string | null;
  cae_vto?: string | null;
  tipo?: number | null;
  punto_venta?: number | null;
  numero?: number | null;
  cuit_emisor?: string | null;
  fecha_emision?: string | null;
  qr_url?: string | null;
  idempotency_key?: string | null;
  motivo?: string | null;
  observaciones?: string | null;
  related_comprobante_id?: number | null;
  request_json?: Record<string, unknown> | null;
  response_json?: Record<string, unknown> | null;
  items_json?: SaleComprobanteItemSnapshot[] | null;
  error_code?: string | null;
  error_message?: string | null;
  emitted_at?: string | null;
}

/** DTO expuesto en GET /api/sales (historial de comprobantes). */
export interface SaleComprobantePublic {
  id: number | null;
  sequence: number;
  kind: SaleComprobanteKind;
  status: SaleComprobanteStatus;
  factura_id?: string | null;
  cae: string | null;
  cae_vto?: string | null;
  tipo?: number | null;
  punto_venta?: number | null;
  numero?: number | null;
  cuit_emisor?: string | null;
  fecha_emision?: string | null;
  qr_url?: string | null;
  motivo?: string | null;
  observaciones?: string | null;
  related_comprobante_id?: number | null;
  request_json?: Record<string, unknown> | null;
  response_json?: Record<string, unknown> | null;
  items_json?: SaleComprobanteItemSnapshot[] | null;
  emitted_at?: string | null;
  /** Última factura no anulada por una NC posterior. */
  vigente: boolean;
}
