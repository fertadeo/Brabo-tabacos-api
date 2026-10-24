// =====================================================
// ENTITIES - SUPPLIER INVOICES MODULE
// =====================================================

export type InvoiceStatus = 'draft' | 'received' | 'partial_paid' | 'paid' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue';

export interface SupplierInvoice {
  id: number;
  invoice_number: string;
  supplier_id: number;
  supplier_name?: string;
  supplier_type?: 'productivo' | 'no_productivo' | 'otro_pasivo';
  purchase_id?: number;
  purchase_number?: string;
  invoice_date: string;
  due_date?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  payment_status: PaymentStatus;
  paid_amount: number;
  remaining_amount: number;
  delivery_note_id?: number;
  delivery_note_number?: string;
  notes?: string;
  file_url?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  
  // Relaciones opcionales
  items?: SupplierInvoiceItem[];
  purchase?: any;
  delivery_note?: any;
  payments?: any[];
}

export interface CreateSupplierInvoiceData {
  invoice_number: string;
  supplier_id: number;
  purchase_id?: number;
  invoice_date: string;
  due_date?: string;
  subtotal: number;
  tax_amount?: number;
  total_amount: number;
  notes?: string;
  file_url?: string;
  items: CreateSupplierInvoiceItemData[];
}

export interface UpdateSupplierInvoiceData {
  invoice_number?: string;
  supplier_id?: number;
  purchase_id?: number;
  invoice_date?: string;
  due_date?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  status?: InvoiceStatus;
  payment_status?: PaymentStatus;
  delivery_note_id?: number;
  notes?: string;
  file_url?: string;
}

export interface LinkDeliveryNoteData {
  delivery_note_id: number;
}

export interface SupplierInvoiceItem {
  id: number;
  invoice_id: number;
  material_code?: string; // Opcional para proveedores no productivos
  product_id?: number;
  product_name?: string;
  product_code?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit_cost?: number;
  affects_production_cost: boolean;
  purchase_item_id?: number;
  created_at: string;
}

export interface CreateSupplierInvoiceItemData {
  material_code?: string; // Opcional para proveedores no productivos
  product_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost?: number;
  affects_production_cost?: boolean;
  purchase_item_id?: number;
}

export interface UpdateSupplierInvoiceItemData {
  material_code?: string;
  product_id?: number;
  description?: string;
  quantity?: number;
  unit_price?: number;
  unit_cost?: number;
  total_price?: number;
  affects_production_cost?: boolean;
  purchase_item_id?: number;
}

