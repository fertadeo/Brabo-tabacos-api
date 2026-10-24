// =====================================================
// ENTITIES - ACCRUED EXPENSES MODULE
// Egresos sin factura / Devengamientos
// =====================================================

export type ExpenseType = 'compromise' | 'accrual';
export type ExpenseCategory = 'seguro' | 'impuesto' | 'alquiler' | 'servicio' | 'otro';
export type ExpenseStatus = 'pending' | 'paid' | 'cancelled';

export interface AccruedExpense {
  id: number;
  expense_number: string;
  supplier_id?: number;
  supplier_name?: string;
  expense_type: ExpenseType;
  concept: string;
  category: ExpenseCategory;
  amount: number;
  accrual_date: string;
  due_date?: string;
  payment_date?: string;
  status: ExpenseStatus;
  has_invoice: boolean;
  invoice_id?: number;
  invoice_number?: string;
  paid_amount: number; // Calculado: suma de pagos asociados
  remaining_amount: number; // Calculado: amount - paid_amount
  notes?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  
  // Relaciones opcionales
  supplier?: any;
  invoice?: any;
  payments?: any[];
}

export interface CreateAccruedExpenseData {
  expense_number?: string; // Opcional, se genera si no se proporciona
  supplier_id?: number;
  expense_type: ExpenseType;
  concept: string;
  category?: ExpenseCategory;
  amount: number;
  accrual_date: string;
  due_date?: string;
  notes?: string;
}

export interface UpdateAccruedExpenseData {
  supplier_id?: number;
  expense_type?: ExpenseType;
  concept?: string;
  category?: ExpenseCategory;
  amount?: number;
  accrual_date?: string;
  due_date?: string;
  payment_date?: string;
  status?: ExpenseStatus;
  invoice_id?: number;
  notes?: string;
}

export interface LinkInvoiceToExpenseData {
  invoice_id: number;
}

