export type PurchaseDocumentProvider = 'invid' | 'generic';

export interface ParsedPurchaseDocumentItem {
  line_number: number;
  quantity: number;
  description: string;
  supplier_product_code?: string;
  material_code: string;
  barcode?: string;
  serial_numbers?: string[];
}

export interface ParsedPurchaseDocument {
  provider: PurchaseDocumentProvider;
  document_type: 'remito' | 'factura' | 'unknown';
  delivery_note_number?: string;
  delivery_date?: string;
  supplier_name?: string;
  supplier_tax_id?: string;
  customer_name?: string;
  customer_tax_id?: string;
  source_invoice_number?: string;
  insured_value?: number;
  customer_order_reference?: string;
  transport_company?: string;
  observations?: string;
  items: ParsedPurchaseDocumentItem[];
  raw_text_preview?: string;
}

export interface MatchedPurchaseDocumentItem extends ParsedPurchaseDocumentItem {
  product_id?: number;
  product_name?: string;
  product_code?: string;
  current_stock?: number;
  purchase_item_id?: number;
  expected_quantity?: number;
  pending_quantity?: number;
  expected_unit_cost?: number;
  cost_variance?: number;
  match_status: 'matched' | 'partial' | 'unmatched';
  match_method?: 'barcode' | 'material_code' | 'product_code' | 'description';
  warnings: string[];
}

export interface PurchaseDocumentSupplierCandidate {
  id: number;
  name: string;
}

export interface ParsePurchaseDocumentResult {
  file_token: string;
  original_filename: string;
  parsed: ParsedPurchaseDocument;
  items: MatchedPurchaseDocumentItem[];
  suggested_supplier_id?: number;
  suggested_supplier_name?: string;
  supplier_candidates?: PurchaseDocumentSupplierCandidate[];
  suggested_purchase_id?: number;
  suggested_purchase_number?: string;
  duplicate_delivery_note?: boolean;
  warnings: string[];
}

export interface ConfirmPurchaseDocumentItemInput {
  material_code: string;
  barcode?: string;
  description: string;
  quantity: number;
  product_id?: number;
  purchase_item_id?: number;
  unit_cost?: number;
  update_stock?: boolean;
  update_cost?: boolean;
}

export interface ConfirmPurchaseDocumentInput {
  file_token: string;
  supplier_id: number;
  purchase_id?: number;
  create_purchase_if_missing?: boolean;
  delivery_note_number: string;
  delivery_date: string;
  source_invoice_number?: string;
  insured_value?: number;
  notes?: string;
  apply_stock: boolean;
  items: ConfirmPurchaseDocumentItemInput[];
}

export interface ConfirmPurchaseDocumentResult {
  delivery_note_id: number;
  delivery_note_number: string;
  purchase_id: number;
  purchase_number: string;
  stock_updates: Array<{
    product_id: number;
    product_name: string;
    quantity_added: number;
    new_stock: number;
  }>;
  cost_updates: Array<{
    product_id: number;
    purchase_item_id?: number;
    unit_cost: number;
  }>;
  warnings: string[];
}
