// =====================================================
// ENTITIES - SALES MODULE (Point of Sale)
// =====================================================

import type { CreateSaleLineInput } from '../utils/saleItems';

export type SaleCurrency = 'ARS' | 'USD';

export interface Sale {
  id: number;
  sale_number: string;
  client_id: number;
  total_amount: number;
  /** Moneda de cobro y facturación (default ARS). */
  currency?: SaleCurrency;
  /** Cotización USD/ARS al momento de la venta (solo si currency = USD). */
  exchange_rate?: number | null;
  payment_method: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
  payment_details?: {
    efectivo?: number;
    tarjeta?: number;
    transferencia?: number;
  } | null;
  sale_date: string;
  woocommerce_order_id?: number | null;
  sync_status: 'pending' | 'synced' | 'error';
  sync_error?: string | null;
  arca_status?: 'pending' | 'success' | 'error' | null;
  arca_factura_id?: string | null;
  arca_cae?: string | null;
  arca_punto_venta?: number | null;
  arca_tipo?: number | null;
  arca_numero?: number | null;
  arca_cuit_emisor?: string | null;
  arca_fecha_emision?: string | null;
  arca_cae_vto?: string | null;
  arca_qr_url?: string | null;
  arca_idempotency_key?: string | null;
  /** Denormalizado desde arca_request_json para PDF en frontend */
  arca_receptor_doc_tipo?: number | null;
  arca_receptor_doc_nro?: string | null;
  /** Snapshot listo para PDF / vista (relleno desde columnas o arca_response_json) */
  arca_comprobante?: import('../utils/arcaComprobante').ArcaComprobanteSnapshot | null;
  arca_last_attempt_at?: string | null;
  arca_error_code?: string | null;
  arca_error_message?: string | null;
  arca_request_json?: Record<string, unknown> | null;
  arca_response_json?: Record<string, unknown> | null;
  condicion_venta_codigo?: string | null;
  condicion_venta_texto?: string | null;
  fecha_vencimiento_pago?: string | null;
  arca_nc_status?: 'pending' | 'success' | 'error' | null;
  arca_nc_cae?: string | null;
  arca_nc_cae_vto?: string | null;
  arca_nc_factura_id?: string | null;
  arca_nc_tipo?: number | null;
  arca_nc_punto_venta?: number | null;
  arca_nc_numero?: number | null;
  arca_nc_motivo?: string | null;
  arca_nc_observaciones?: string | null;
  arca_nc_idempotency_key?: string | null;
  arca_nc_error_code?: string | null;
  arca_nc_error_message?: string | null;
  arca_nc_request_json?: Record<string, unknown> | null;
  arca_nc_response_json?: Record<string, unknown> | null;
  arca_nc_last_attempt_at?: string | null;
  /** Historial de facturas y notas de crédito (Factura 1 → NC → Factura 2). */
  arca_historial?: import('./SaleComprobante').SaleComprobantePublic[];
  /** Oculta la venta en el módulo de facturación (superadmin). */
  facturacion_archived?: boolean | number | null;
  facturacion_archived_at?: string | null;
  facturacion_archived_by?: number | null;
  notes?: string | null;
  sale_source?: 'pos' | 'imported' | 'pos_external';
  source_file_path?: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateSaleFacturacionData {
  arca_status: 'pending' | 'success' | 'error';
  arca_factura_id?: string | null;
  arca_cae?: string | null;
  arca_punto_venta?: number | null;
  arca_tipo?: number | null;
  arca_numero?: number | null;
  arca_cuit_emisor?: string | null;
  arca_fecha_emision?: string | null;
  arca_cae_vto?: string | null;
  arca_qr_url?: string | null;
  arca_idempotency_key?: string | null;
  arca_error_code?: string | null;
  arca_error_message?: string | null;
  arca_request_json?: Record<string, unknown> | null;
  arca_response_json?: Record<string, unknown> | null;
  condicion_venta_codigo?: string | null;
  condicion_venta_texto?: string | null;
  fecha_vencimiento_pago?: string | null;
}

export interface UpdateSaleNotaCreditoData {
  arca_nc_status: 'pending' | 'success' | 'error';
  arca_nc_cae?: string | null;
  arca_nc_cae_vto?: string | null;
  arca_nc_factura_id?: string | null;
  arca_nc_tipo?: number | null;
  arca_nc_punto_venta?: number | null;
  arca_nc_numero?: number | null;
  arca_nc_motivo?: string | null;
  arca_nc_observaciones?: string | null;
  arca_nc_idempotency_key?: string | null;
  arca_nc_error_code?: string | null;
  arca_nc_error_message?: string | null;
  arca_nc_request_json?: Record<string, unknown> | null;
  arca_nc_response_json?: Record<string, unknown> | null;
}

export interface SaleWithDetails extends Sale {
  client_name?: string;
  client_code?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_cuil_cuit?: string;
  items?: SaleItem[];
  created_by_name?: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number | null;
  product_name?: string | null;
  product_code?: string | null;
  /** Texto de línea manual (product_id null) */
  description?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  /** Alícuota IVA de la línea (snapshot; 21, 10.5 o 0) */
  iva_rate?: number;
  /** Alias de total_price para el frontend */
  subtotal?: number;
  created_at: string;
}

export interface CreateSaleData {
  client_id?: number; // Opcional, si no se envía usar cliente genérico "Consumidor Final"
  items: CreateSaleLineInput[];
  /** Moneda de cobro (default ARS). */
  currency?: SaleCurrency;
  /** Cotización USD/ARS obligatoria si currency = USD. */
  exchange_rate?: number;
  payment_method: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
  payment_details?: {
    efectivo?: number;
    tarjeta?: number;
    transferencia?: number;
  };
  notes?: string;
  sync_to_woocommerce?: boolean; // Por defecto true
  /** Si es true, permite vender productos marcados como inactivos (útil en POS para último stock) */
  allow_inactive?: boolean;
}

export interface UpdateSaleData {
  /** Corregir cliente asignado (p. ej. reemplazar Consumidor Final) */
  client_id?: number;
  /** Reemplazo completo de líneas (catálogo o manual). Ajusta stock y total. */
  items?: CreateSaleLineInput[];
  payment_method?: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
  payment_details?: {
    efectivo?: number;
    tarjeta?: number;
    transferencia?: number;
  };
  notes?: string;
  /** Si es true, permite incluir productos inactivos al reemplazar ítems */
  allow_inactive?: boolean;
  sync_to_woocommerce?: boolean; // Para reintentar sincronización tras editar
  /** Cambiar moneda de cobro (solo ventas sin factura emitida). */
  currency?: SaleCurrency;
  /** Cotización USD/ARS obligatoria si currency = USD. */
  exchange_rate?: number;
}

export interface SaleFilters {
  client_id?: number;
  payment_method?: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
  sync_status?: 'pending' | 'synced' | 'error';
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  /** Si false, no carga ítems por venta (más rápido; suficiente para listados / facturación). Default false. */
  include_items?: boolean;
  /** Incluir ventas archivadas en facturación (solo útil para superadmin). */
  include_facturacion_archived?: boolean;
}

export interface SaleStats {
  total_sales: number;
  total_amount: number;
  average_sale_amount: number;
  sales_by_payment_method: {
    efectivo: { count: number; total: number };
    tarjeta: { count: number; total: number };
    transferencia: { count: number; total: number };
    mixto: { count: number; total: number };
  };
  sales_today: number;
  sales_this_month: number;
  pending_sync: number;
  sync_errors: number;
}
