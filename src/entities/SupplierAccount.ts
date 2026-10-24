// =====================================================
// ENTITIES - SUPPLIER ACCOUNTS MODULE
// =====================================================

export type MovementType = 'commitment' | 'debt' | 'payment' | 'adjustment';
export type MovementDirection = 'debit' | 'credit';
export type MovementReferenceType = 'purchase' | 'invoice' | 'payment' | 'delivery_note' | 'adjustment';
export type MovementStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface SupplierAccount {
  id: number;
  supplier_id: number;
  supplier_name?: string;
  commitment_balance: number;
  debt_balance: number;
  total_balance: number;
  credit_limit: number;
  available_credit?: number; // Calculado: credit_limit - total_balance
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Relaciones opcionales
  movements?: SupplierAccountMovement[];
  supplier?: any;
}

export interface SupplierAccountSummary extends SupplierAccount {
  pending_invoices: number;
  pending_invoices_amount: number;
  overdue_invoices: number;
  overdue_amount: number;
  next_due_date?: string;
  next_due_amount?: number;
}

export interface SupplierAccountMovement {
  id: number;
  account_id: number; // ID de la cuenta de proveedor (supplier_accounts.id)
  movement_type: MovementType;
  type: MovementDirection;
  amount: number;
  balance_after: number;
  reference_type?: MovementReferenceType;
  reference_id?: number;
  description?: string;
  due_date?: string;
  payment_date?: string;
  status: MovementStatus;
  created_at: string;
  
  // Campos calculados/relaciones opcionales
  reference_number?: string; // Número de referencia (purchase_number, invoice_number, etc.)
  reference?: any; // Puede ser Purchase, Invoice, Payment, etc.
}

export interface CreateSupplierAccountMovementData {
  supplier_id: number; // Se usa supplier_id y el repositorio obtiene/crea la cuenta automáticamente
  movement_type: MovementType;
  type: MovementDirection;
  amount: number;
  reference_type?: MovementReferenceType;
  reference_id?: number;
  description?: string;
  due_date?: string;
  payment_date?: string;
  status?: MovementStatus;
}

export interface UpdateSupplierAccountMovementData {
  movement_type?: MovementType;
  type?: MovementDirection;
  amount?: number;
  reference_type?: MovementReferenceType;
  reference_id?: number;
  description?: string;
  due_date?: string;
  payment_date?: string;
  status?: MovementStatus;
}

