export type SalesDocumentProvider = 'arca_afip' | 'generic';

export interface ParsedSalesInvoiceItem {
  line_number: number;
  quantity: number;
  description: string;
  product_code?: string;
  /** Precio unitario neto (sin IVA), como en columna «Precio Unit.» del PDF. */
  unit_price_net?: number;
  /** Precio unitario con IVA incluido (convención POS / venta). */
  unit_price?: number;
  bonif_percent?: number;
  bonif_amount?: number;
  /** Subtotal neto gravado de la línea. */
  subtotal_net?: number;
  /** Subtotal con IVA («Subtotal c/IVA»). */
  subtotal_gross?: number;
  /** Alias de subtotal_gross para totales y compatibilidad. */
  subtotal?: number;
  iva_rate?: number;
}

export interface ParsedSalesInvoice {
  provider: SalesDocumentProvider;
  document_type: 'factura' | 'nota_credito' | 'unknown';
  comprobante_tipo?: number;
  comprobante_letra?: string;
  punto_venta?: number;
  numero?: number;
  fecha_emision?: string;
  cae?: string;
  cae_vto?: string;
  cuit_emisor?: string;
  cuit_receptor?: string;
  receptor_razon_social?: string;
  receptor_condicion_iva?: string;
  total_amount?: number;
  qr_url?: string;
  items: ParsedSalesInvoiceItem[];
  raw_text_preview?: string;
}

export interface MatchedSalesInvoiceItem extends ParsedSalesInvoiceItem {
  product_id?: number;
  product_name?: string;
  product_code?: string;
  match_status: 'matched' | 'partial' | 'unmatched';
  match_method?: 'product_code' | 'description';
  warnings: string[];
}

export interface LinkableSaleSummary {
  id: number;
  sale_number: string;
  sale_date: string;
  total_amount: number;
  client_id?: number | null;
  client_name?: string | null;
  arca_status?: string | null;
}

export interface ParseSalesInvoiceResult {
  file_token: string;
  original_filename: string;
  parsed: ParsedSalesInvoice;
  items: MatchedSalesInvoiceItem[];
  suggested_client_id?: number;
  suggested_client_name?: string;
  linkable_sales?: LinkableSaleSummary[];
  suggested_link_sale_id?: number;
  duplicate_invoice?: boolean;
  existing_sale_id?: number;
  warnings: string[];
}

export interface ConfirmSalesInvoiceItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  product_id?: number;
  product_code?: string;
  iva_rate?: number;
}

export interface ConfirmSalesInvoiceInput {
  file_token: string;
  client_id: number;
  punto_venta: number;
  numero: number;
  comprobante_tipo: number;
  fecha_emision: string;
  cae: string;
  cae_vto?: string;
  cuit_emisor?: string;
  qr_url?: string;
  total_amount: number;
  payment_method?: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
  notes?: string;
  /** Si se indica, adjunta la factura PDF a una venta POS existente en lugar de crear IMP-*. */
  link_sale_id?: number;
  items: ConfirmSalesInvoiceItemInput[];
}

export interface UpdateSalesInvoiceLinkInput {
  sale_id: number;
  /** Si se omite, se conserva el PDF ya vinculado y solo se actualizan datos fiscales. */
  file_token?: string;
  punto_venta: number;
  numero: number;
  comprobante_tipo: number;
  fecha_emision: string;
  cae: string;
  cae_vto?: string;
  cuit_emisor?: string;
  qr_url?: string;
  total_amount: number;
  notes?: string;
}

export interface UnlinkSalesInvoiceResult {
  sale_id: number;
  sale_number: string;
}

export interface ConfirmSalesInvoiceResult {
  sale_id: number;
  sale_number: string;
  client_id: number;
  client_name: string;
  comprobante_label: string;
  linked_to_pos_sale?: boolean;
  warnings: string[];
}
