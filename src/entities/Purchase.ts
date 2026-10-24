import { PurchaseStatus } from '../types';

export type DebtType = 'compromiso' | 'deuda_directa';

export interface Purchase {
  id: number;
  purchase_number: string;
  supplier_id: number;
  supplier_name?: string;
  supplier_type?: 'productivo' | 'no_productivo' | 'otro_pasivo';
  status: PurchaseStatus;
  debt_type: DebtType;
  total_amount: number;
  commitment_amount: number;
  debt_amount: number;
  allows_partial_delivery: boolean;
  purchase_date: string;
  confirmed_at?: string;
  received_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  has_source_pdf?: boolean;
  source_delivery_note_number?: string | null;
  
  // Relaciones opcionales
  items?: PurchaseItem[];
  invoices?: any[];
  delivery_notes?: any[];
  payments?: any[];
}

export interface CreatePurchaseData {
  supplier_id: number;
  debt_type?: DebtType;
  allows_partial_delivery?: boolean;
  status?: PurchaseStatus;
  total_amount?: number;
  purchase_date?: string;
  notes?: string;
  items: CreatePurchaseItemData[];
}

export interface UpdatePurchaseData {
  supplier_id?: number;
  debt_type?: DebtType;
  allows_partial_delivery?: boolean;
  status?: PurchaseStatus;
  total_amount?: number;
  purchase_date?: string;
  received_date?: string;
  notes?: string;
}

export interface ConfirmPurchaseData {
  confirm: boolean;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name?: string;
  product_code?: string;
  material_code?: string;
  quantity: number;
  received_quantity: number;
  pending_quantity?: number; // Calculado: quantity - received_quantity
  unit_price: number;
  unit_cost?: number;
  total_price: number;
  created_at: string;
}

export interface CreatePurchaseItemData {
  product_id: number;
  material_code?: string;
  quantity: number;
  unit_price: number;
  unit_cost?: number;
  total_price?: number; // Opcional, se calcula si no se proporciona
}

export interface UpdatePurchaseItemData {
  product_id?: number;
  material_code?: string;
  quantity?: number;
  received_quantity?: number;
  unit_price?: number;
  unit_cost?: number;
  total_price?: number;
}
