// =====================================================
// ENTITIES - SUPPLIER DELIVERY NOTES MODULE
// =====================================================

export type DeliveryNoteStatus = 'pending' | 'partial' | 'complete' | 'cancelled';

export interface SupplierDeliveryNote {
  id: number;
  delivery_note_number: string;
  supplier_id: number;
  supplier_name?: string;
  purchase_id: number;
  purchase_number?: string;
  invoice_id?: number;
  invoice_number?: string;
  delivery_date: string;
  received_date: string;
  status: DeliveryNoteStatus;
  matches_invoice: boolean;
  notes?: string;
  received_by?: number;
  received_by_name?: string;
  created_at: string;
  updated_at: string;
  
  // Relaciones opcionales
  items?: SupplierDeliveryNoteItem[];
  purchase?: any;
  invoice?: any;
}

export interface CreateSupplierDeliveryNoteData {
  delivery_note_number: string;
  supplier_id: number;
  purchase_id: number;
  invoice_id?: number;
  delivery_date: string;
  notes?: string;
  items: CreateSupplierDeliveryNoteItemData[];
}

export interface UpdateSupplierDeliveryNoteData {
  delivery_note_number?: string;
  supplier_id?: number;
  purchase_id?: number;
  invoice_id?: number;
  delivery_date?: string;
  status?: DeliveryNoteStatus;
  matches_invoice?: boolean;
  notes?: string;
}

export interface LinkInvoiceData {
  invoice_id: number;
}

export interface SupplierDeliveryNoteItem {
  id: number;
  delivery_note_id: number;
  material_code: string;
  product_id?: number;
  product_name?: string;
  product_code?: string;
  quantity: number;
  purchase_item_id?: number;
  invoice_item_id?: number;
  quality_check: boolean;
  quality_notes?: string;
  created_at: string;
}

export interface CreateSupplierDeliveryNoteItemData {
  material_code: string;
  product_id?: number;
  quantity: number;
  purchase_item_id?: number;
  invoice_item_id?: number;
  quality_check?: boolean;
  quality_notes?: string;
}

export interface UpdateSupplierDeliveryNoteItemData {
  material_code?: string;
  product_id?: number;
  quantity?: number;
  purchase_item_id?: number;
  invoice_item_id?: number;
  quality_check?: boolean;
  quality_notes?: string;
}

